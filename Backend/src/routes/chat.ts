import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { encodeFunctionData, isAddress, parseUnits } from 'viem';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authMiddleware, assertWalletAccess } from '../middleware/authMiddleware.js';
import { getStepsForIntent } from '../services/responseEngine.js';
import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../config/supabase.js';
import { executeUgfFlow, UgfStepError, getSignerAddress } from '../services/ugfService.js';
import { config, isUgfConfigured } from '../config/env.js';

const router = Router();

type Intent = 'MINT_BADGE' | 'CLAIM_CERT' | 'DONATE' | 'SEND_REWARD' | 'UNKNOWN';
type Confidence = 'rule-based' | 'GeminiAI' | 'failed';

const SYSTEM_PROMPT =
  'You are a blockchain assistant for UGF AgentX.\n' +
  'The user wants to do a blockchain action on Base Sepolia.\n' +
  'Classify into ONE of: MINT_BADGE, CLAIM_CERT, DONATE, SEND_REWARD, UNKNOWN.\n' +
  'Extract recipient name and amount if present.\n' +
  'Reply ONLY in JSON: { intent, recipient, amount, reply }\n' +
  'reply = a friendly one-line message to show the user explaining what you are doing.';

const UNKNOWN_REPLY =
  'I can help you mint badges, claim certificates, donate, or send rewards. What would you like to do?';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function formatUsd(value: number): string {
  return value
    .toFixed(4)
    .replace(/0+$/u, '')
    .replace(/\.$/u, '');
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&apos;';
      default:
        return char;
    }
  });
}

function extractAmount(message: string): number | null {
  const match = message.match(
    /\b(\d+(?:\.\d+)?)(?=\s*(?:usd|usdc|mock\s*usd|mockusd|dollars)\b|\s|$)/i
  );
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractRecipient(message: string): string | null {
  const addressMatch = message.match(/0x[a-fA-F0-9]{40}/u);
  if (addressMatch) return addressMatch[0];

  const nameMatch = message.match(/(?:for|to|recipient)\s+([A-Za-z][A-Za-z0-9_\-']{0,30})/i);
  if (nameMatch) return nameMatch[1];

  return null;
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function deriveSessionTitle(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return 'New Chat';
  if (trimmed.length <= 40) return trimmed;
  return `${trimmed.slice(0, 40)}...`;
}

async function assertSessionOwner(sessionId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.user_id !== userId) {
    throw new AppError(403, 'Session not found or access denied');
  }
}

function mapActionType(intent: Intent): string | null {
  switch (intent) {
    case 'MINT_BADGE':
      return 'mint_badge';
    case 'CLAIM_CERT':
      return 'claim_cert';
    case 'DONATE':
      return 'donate';
    case 'SEND_REWARD':
      return 'send_reward';
    default:
      return null;
  }
}

function ruleBasedParse(message: string): {
  intent: Intent;
  recipient: string | null;
  amount: number | null;
} {
  const lower = message.toLowerCase();

  let intent: Intent = 'UNKNOWN';
  if (/\bmint\b|\bbadge\b/u.test(lower)) {
    intent = 'MINT_BADGE';
  } else if (/\bclaim\b|\bcertificate\b|\bcert\b/u.test(lower)) {
    intent = 'CLAIM_CERT';
  } else if (/\bdonate\b|\bdonation\b|\bcontribute\b/u.test(lower)) {
    intent = 'DONATE';
  } else if (/\bsend\s+reward\b|\breward\b|\btip\b|\bbonus\b/u.test(lower)) {
    intent = 'SEND_REWARD';
  }

  return {
    intent,
    recipient: extractRecipient(message),
    amount: extractAmount(message),
  };
}

function normalizeIntent(intent: unknown): Intent {
  if (typeof intent !== 'string') return 'UNKNOWN';

  switch (intent.toUpperCase()) {
    case 'MINT_BADGE':
      return 'MINT_BADGE';
    case 'CLAIM_CERT':
      return 'CLAIM_CERT';
    case 'DONATE':
      return 'DONATE';
    case 'SEND_REWARD':
      return 'SEND_REWARD';
    default:
      return 'UNKNOWN';
  }
}

function safeJsonFromText(text: string): Record<string, unknown> | null {
  try {
    const trimmed = text.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;

    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isModelNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { message?: string; status?: number; statusText?: string };
  if (maybeError.status === 404) return true;

  const message = maybeError.message?.toLowerCase() ?? '';
  const statusText = maybeError.statusText?.toLowerCase() ?? '';
  return message.includes('not found') || statusText.includes('not found');
}

function isTransientGeminiError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { message?: string; status?: number; statusText?: string };
  const status = maybeError.status;
  if (status === 429 || status === 500 || status === 502 || status === 503) return true;

  const message = maybeError.message?.toLowerCase() ?? '';
  const statusText = maybeError.statusText?.toLowerCase() ?? '';
  if (message.includes('resource exhausted') || message.includes('unavailable') || message.includes('overloaded')) {
    return true;
  }
  if (statusText.includes('unavailable') || statusText.includes('too many requests')) {
    return true;
  }
  return false;
}

function dedupeModelNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ensureSession(options: {
  sessionId?: string | null;
  userId: string | null;
  message: string;
}): Promise<string> {
  const existingId = options.sessionId && isUuid(options.sessionId) ? options.sessionId : null;
  const sessionId = existingId ?? randomUUID();
  const payload: Record<string, string | null> = {
    id: sessionId,
    user_id: options.userId,
    updated_at: new Date().toISOString(),
  };

  if (!existingId) {
    payload.title = deriveSessionTitle(options.message);
  }

  const { error } = await supabaseAdmin.from('chat_sessions').upsert(payload, { onConflict: 'id' });
  if (error) {
    throw new Error(error.message);
  }

  return sessionId;
}

async function insertChatMessage(payload: {
  sessionId: string;
  sender: 'user' | 'assistant';
  message: string;
  messageType?: string;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      session_id: payload.sessionId,
      sender: payload.sender,
      message: payload.message,
      message_type: payload.messageType ?? 'normal',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data?.id ?? null;
}

async function patchChatMessage(messageId: string, newMessage: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('chat_messages')
    .update({ message: newMessage })
    .eq('id', messageId);

  if (error) {
    logger.warn('Failed to patch chat message', { messageId, error: error.message });
  }
}

async function recordAiAction(payload: {
  userId: string | null;
  prompt: string;
  intent: Intent;
  recipient: string | null;
  amount: number | null;
  confidence: Confidence;
}): Promise<void> {
  const parserType = payload.confidence === 'rule-based' ? 'regex' : 'gemini';
  const { error } = await supabaseAdmin.from('ai_actions').insert({
    user_id: payload.userId,
    original_prompt: payload.prompt,
    parsed_action: payload.intent,
    extracted_data: {
      recipient: payload.recipient,
      amount: payload.amount,
      confidence: payload.confidence,
    },
    parser_type: parserType,
    success: payload.intent !== 'UNKNOWN',
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function createTransaction(payload: {
  userId: string | null;
  intent: Intent;
  gasFeeMockUsd: number;
}): Promise<string | null> {
  const actionType = mapActionType(payload.intent);
  if (!actionType) return null;

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .insert({
      user_id: payload.userId,
      action_type: actionType,
      status: 'pending',
      gas_fee_mockusd: payload.gasFeeMockUsd,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

async function patchTransaction(transactionId: string, patch: {
  status: string;
  txHash?: string | null;
  ugfQuoteId?: string | null;
  gasFeesMockUsd?: number | null;
  blockNumber?: number | null;
  confirmedAt?: string | null;
  contractAddress?: string | null;
}): Promise<void> {
  const update: Record<string, unknown> = { status: patch.status };
  if (patch.txHash !== undefined) update.tx_hash = patch.txHash;
  if (patch.ugfQuoteId !== undefined) update.ugf_quote_id = patch.ugfQuoteId;
  if (patch.gasFeesMockUsd !== undefined) update.gas_fee_mockusd = patch.gasFeesMockUsd;
  if (patch.blockNumber !== undefined) update.block_number = patch.blockNumber;
  if (patch.confirmedAt !== undefined) update.confirmed_at = patch.confirmedAt;
  if (patch.contractAddress !== undefined) update.contract_address = patch.contractAddress;

  const { error } = await supabaseAdmin
    .from('transactions')
    .update(update)
    .eq('id', transactionId);

  if (error) {
    logger.warn('Failed to patch transaction', { transactionId, error: error.message });
  }
}

async function patchMintedBadgeTxHash(transactionId: string, txHash: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('minted_badges')
    .update({ tx_hash: txHash })
    .eq('transaction_id', transactionId);

  if (error) {
    logger.warn('Failed to patch minted_badge tx_hash', { transactionId, error: error.message });
  }
}

const NFT_ABI = [
  {
    type: 'function',
    name: 'mintBadge',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'donate',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const MOCK_USD_DECIMALS = 6;

type UgfExecutionResult = {
  txHash: string | null;
  blockNumber: number | null;
  confirmedAt: string | null;
  quoteId: string | null;
  gasFeeUSD: number | null;
  status: 'success' | 'failed' | 'skipped' | 'pending';
  failureStep?: string;
  failureMessage?: string;
};

async function tryExecuteOnChain(options: {
  intent: Intent;
  userWallet: string;
  recipient: string | null;
  amount: number | null;
  tokenURI: string | null;
}): Promise<UgfExecutionResult> {
  const skipped: UgfExecutionResult = {
    txHash: null, blockNumber: null, confirmedAt: null,
    quoteId: null, gasFeeUSD: null, status: 'skipped',
  };

  if (!isUgfConfigured()) {
    logger.info('UGF not configured — skipping on-chain execution');
    return skipped;
  }

  const contractAddress = config.nftContractAddress;
  if (!isAddress(contractAddress)) {
    logger.warn('NFT_CONTRACT_ADDRESS is invalid — skipping on-chain execution');
    return skipped;
  }

  let calldata: `0x${string}`;

  try {
    if (options.intent === 'DONATE') {
      if (!options.recipient || !isAddress(options.recipient)) {
        logger.warn('DONATE intent missing valid recipient address — skipping execution');
        return skipped;
      }
      const amountUnits = parseUnits(String(options.amount ?? 0), MOCK_USD_DECIMALS);
      calldata = encodeFunctionData({
        abi: NFT_ABI,
        functionName: 'donate',
        args: [options.recipient as `0x${string}`, amountUnits],
      });
    } else {
      // MINT_BADGE, CLAIM_CERT, SEND_REWARD — all use mintBadge calldata
      if (!options.tokenURI) {
        logger.warn(`${options.intent} intent missing tokenURI — skipping execution`);
        return skipped;
      }
      const mintTo: `0x${string}` =
        options.recipient && isAddress(options.recipient)
          ? (options.recipient as `0x${string}`)
          : (options.userWallet as `0x${string}`);

      calldata = encodeFunctionData({
        abi: NFT_ABI,
        functionName: 'mintBadge',
        args: [mintTo, options.tokenURI],
      });
    }
  } catch (err) {
    logger.warn('Failed to encode calldata for UGF execution', err);
    return skipped;
  }

  try {
    const result = await executeUgfFlow({
      // Use the server signer's derived address as payer_address so UGF can
      // debit its TYI Mock USD vault. Falls back to userWallet if key missing.
      from: (() => {
        try {
          return getSignerAddress();
        } catch {
          return options.userWallet;
        }
      })(),
      to: contractAddress,
      data: calldata,
      value: '0',
    });

    return {
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      confirmedAt: result.confirmedAt,
      quoteId: result.quoteId,
      gasFeeUSD: result.estimatedGasFeeUSD,
      status: 'success',
    };
  } catch (err) {
    if (err instanceof UgfStepError) {
      const data = err.data as Record<string, unknown> | undefined;
      return {
        txHash: (data?.txHash as string | null) ?? null,
        blockNumber: null,
        confirmedAt: null,
        quoteId: (data?.quoteId as string | null) ?? null,
        gasFeeUSD: (data?.estimatedGasFeeUSD as number | null) ?? null,
        status: 'failed',
        failureStep: err.step,
        failureMessage: err.message,
      };
    }
    logger.warn('Unexpected UGF error', err);
    return { txHash: null, blockNumber: null, confirmedAt: null, quoteId: null, gasFeeUSD: null, status: 'failed', failureMessage: String(err) };
  }
}

async function createMintedBadge(payload: {
  transactionId: string;
  userId: string | null;
  recipient: string | null;
  tokenURI: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('minted_badges').insert({
    transaction_id: payload.transactionId,
    user_id: payload.userId,
    badge_name: `UGF AgentX Badge — ${payload.recipient ?? 'User'}`,
    recipient_name: payload.recipient,
    metadata_uri: payload.tokenURI,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function getGeminiIntent(message: string): Promise<{
  intent: Intent;
  recipient: string | null;
  amount: number | null;
  reply: string | null;
} | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const maxTransientRetries = Math.min(
    4,
    Math.max(0, parseInt(process.env.GEMINI_MAX_RETRIES || '2', 10) || 0)
  );
  const retryDelayMs = Math.min(
    5000,
    Math.max(200, parseInt(process.env.GEMINI_RETRY_DELAY_MS || '600', 10) || 600)
  );

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelCandidates = dedupeModelNames([
      process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro',
    ]);

    const parseModelOutput = (text: string) => {
      const parsed = safeJsonFromText(text);
      if (!parsed) return null;

      const intent = normalizeIntent(parsed.intent);
      const recipient = typeof parsed.recipient === 'string' ? parsed.recipient : null;
      const amountRaw = parsed.amount;
      const amount =
        typeof amountRaw === 'number'
          ? amountRaw
          : typeof amountRaw === 'string'
            ? Number(amountRaw)
            : null;

      return {
        intent,
        recipient,
        amount: Number.isFinite(amount) ? amount : null,
        reply: typeof parsed.reply === 'string' ? parsed.reply : null,
      };
    };

    const generateAndParse = async (
      modelName: string,
      jsonMime: boolean
    ): Promise<{
      intent: Intent;
      recipient: string | null;
      amount: number | null;
      reply: string | null;
    } | null> => {
      const generationConfig = jsonMime
        ? { temperature: 0.1, responseMimeType: 'application/json' as const }
        : { temperature: 0.1 };

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig,
      });

      const result = await model.generateContent(message);
      const text = result.response.text();
      return parseModelOutput(text);
    };

    const isJsonMimeUnsupportedError = (error: unknown): boolean => {
      const messageText =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message).toLowerCase()
          : '';
      return (
        messageText.includes('responsemimetype') ||
        messageText.includes('mime type') ||
        messageText.includes('json mode') ||
        messageText.includes('response mime')
      );
    };

    for (const modelName of modelCandidates) {
      let skipModel = false;

      for (const jsonMime of [true, false]) {
        for (let transientAttempt = 0; transientAttempt <= maxTransientRetries; transientAttempt += 1) {
          try {
            const parsed = await generateAndParse(modelName, jsonMime);
            if (parsed) {
              return parsed;
            }
            break;
          } catch (error) {
            if (isModelNotFound(error)) {
              skipModel = true;
              break;
            }

            if (jsonMime && isJsonMimeUnsupportedError(error)) {
              break;
            }

            if (isTransientGeminiError(error) && transientAttempt < maxTransientRetries) {
              logger.warn('Gemini transient error, retrying', {
                modelName,
                attempt: transientAttempt + 1,
                max: maxTransientRetries,
              });
              await sleep(retryDelayMs * (transientAttempt + 1));
              continue;
            }

            throw error;
          }
        }

        if (skipModel) {
          break;
        }
      }
    }

    return null;
  } catch (error) {
    logger.warn('Gemini intent parsing failed', error);
    return null;
  }
}

function buildReply(intent: Intent, recipient: string | null, amount: number | null): string {
  switch (intent) {
    case 'MINT_BADGE':
      if (recipient && recipient.toLowerCase() === 'jay') {
        return "Let's mint badge for you!";
      }
      return recipient
        ? `Minting a Blockchain Innovator Badge for ${recipient}...`
        : 'Minting a Blockchain Innovator Badge...';
    case 'CLAIM_CERT':
      return 'Claiming your UGF AgentX Certificate...';
    case 'DONATE': {
      const amountText = amount !== null ? ` of $${formatUsd(amount)}` : '';
      const recipientText = recipient ? ` to ${recipient}` : '';
      return `Sending your donation${amountText}${recipientText}...`;
    }
    case 'SEND_REWARD': {
      const amountText = amount !== null ? ` of $${formatUsd(amount)}` : '';
      const recipientText = recipient ? ` to ${recipient}` : '';
      return `Sending your reward${amountText}${recipientText}...`;
    }
    default:
      return UNKNOWN_REPLY;
  }
}

function buildSvg(intent: Intent, recipient: string | null): string {
  const typeLabel = intent === 'CLAIM_CERT' ? 'Certificate' : 'Badge';
  const safeRecipient = escapeXml(recipient ?? 'User');

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">',
    '<rect width="400" height="200" fill="#0f0f0f" rx="16" />',
    '<rect x="16" y="16" width="368" height="168" fill="none" stroke="#7c3aed" stroke-width="2" rx="12" />',
    `<text x="32" y="52" fill="#7c3aed" font-size="18" font-family="Arial, sans-serif">UGF AgentX ${typeLabel}</text>`,
    `<text x="32" y="90" fill="#ffffff" font-size="20" font-family="Arial, sans-serif">Recipient: ${safeRecipient}</text>`,
    '<text x="32" y="124" fill="#ffffff" font-size="14" font-family="Arial, sans-serif">Base Sepolia</text>',
    '<text x="32" y="150" fill="#ffffff" font-size="12" font-family="Arial, sans-serif">Powered by UGF</text>',
    '</svg>',
  ].join('');
}

function buildTokenURI(intent: Intent, recipient: string | null): string | null {
  if (intent !== 'MINT_BADGE' && intent !== 'CLAIM_CERT') {
    return null;
  }

  const svg = buildSvg(intent, recipient);
  const svgBase64 = Buffer.from(svg).toString('base64');
  const displayRecipient = recipient ?? 'User';

  const metadata =
    intent === 'MINT_BADGE'
      ? {
        name: `UGF AgentX Badge — ${displayRecipient}`,
        description: 'Blockchain Innovator Badge minted via UGF AgentX on Base Sepolia.',
        image: `data:image/svg+xml;base64,${svgBase64}`,
        attributes: [
          { trait_type: 'Type', value: 'Badge' },
          { trait_type: 'Recipient', value: displayRecipient },
          { trait_type: 'Issued By', value: 'UGF AgentX' },
          { trait_type: 'Network', value: 'Base Sepolia' },
        ],
      }
      : {
        name: 'UGF AgentX Certificate',
        description: 'Workshop completion certificate issued on Base Sepolia.',
        image: `data:image/svg+xml;base64,${svgBase64}`,
        attributes: [
          { trait_type: 'Type', value: 'Certificate' },
          { trait_type: 'Issued By', value: 'UGF AgentX' },
          { trait_type: 'Network', value: 'Base Sepolia' },
        ],
      };

  const encoded = Buffer.from(JSON.stringify(metadata)).toString('base64');
  return `data:application/json;base64,${encoded}`;
}

function buildGasEstimate(intent: Intent, recipient: string | null, amount: number | null): {
  mockUSD: number;
  breakdown: string;
  note: string;
} {
  let base = 0.04;
  let extra = 0;
  let breakdown = 'Base: $0.04';

  if (intent === 'MINT_BADGE') {
    base = 0.05;
    extra = 0.01 * (recipient?.length ?? 0);
    breakdown = `Base: $${formatUsd(base)} + Name fee: $${formatUsd(extra)}`;
  } else if (intent === 'CLAIM_CERT') {
    base = 0.04;
    breakdown = `Base: $${formatUsd(base)}`;
  } else if (intent === 'DONATE') {
    base = 0.03;
    extra = amount !== null ? amount * 0.005 : 0;
    breakdown = `Base: $${formatUsd(base)} + 0.5%: $${formatUsd(extra)}`;
  } else if (intent === 'SEND_REWARD') {
    base = 0.04;
    extra = amount !== null ? amount * 0.003 : 0;
    breakdown = `Base: $${formatUsd(base)} + 0.3%: $${formatUsd(extra)}`;
  }

  const variance = 0.9 + Math.random() * 0.2;
  const mockUSD = round4((base + extra) * variance);

  return {
    mockUSD,
    breakdown,
    note: 'Paid in Mock USD via UGF. No ETH required.',
  };
}


/**
 * POST /api/chat
 * Process user message and return AI response.
 */
router.post(
  '/chat',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { sessionId, message } = req.body;
      const walletAddress = req.user!.walletAddress;
      const userId = req.user!.userId;

      if (!message) {
        throw new Error('Missing required fields: message');
      }

      const messageText = String(message);

      logger.info('Chat request received', {
        sessionId,
        walletAddress,
        preview: messageText.substring(0, 50),
      });
      const effectiveSessionId = await ensureSession({
        sessionId,
        userId,
        message: messageText,
      });

      // Persist user message before processing.
      await insertChatMessage({
        sessionId: effectiveSessionId,
        sender: 'user',
        message: messageText,
      });

      // Rule-based intent parsing.
      const ruleBased = ruleBasedParse(messageText);
      let intent: Intent = ruleBased.intent;
      let recipient = ruleBased.recipient;
      let amount = ruleBased.amount;
      let reply = buildReply(intent, recipient, amount);
      let confidence: Confidence = 'rule-based';

      // Gemini fallback only when rule-based intent is UNKNOWN.
      if (intent === 'UNKNOWN') {
        const geminiResult = await getGeminiIntent(messageText);

        if (geminiResult && geminiResult.intent !== 'UNKNOWN') {
          intent = geminiResult.intent;
          recipient = geminiResult.recipient ?? recipient;
          amount = geminiResult.amount ?? amount;
          reply = geminiResult.reply ?? buildReply(intent, recipient, amount);
          confidence = 'GeminiAI';
        } else {
          intent = 'UNKNOWN';
          recipient = geminiResult?.recipient ?? ruleBased.recipient;
          amount = geminiResult?.amount ?? ruleBased.amount;
          reply = UNKNOWN_REPLY;
          confidence = 'failed';
        }
      }

      // Generate token metadata when required.
      const tokenURI = buildTokenURI(intent, recipient);

      // Calculate Mock USD gas estimate for all intents.
      const gasEstimate = buildGasEstimate(intent, recipient, amount);
      const { aiSteps, transactionSteps } = getStepsForIntent(intent);

      await recordAiAction({
        userId,
        prompt: messageText,
        intent,
        recipient,
        amount,
        confidence,
      });

      const transactionId = await createTransaction({
        userId,
        intent,
        gasFeeMockUsd: gasEstimate.mockUSD,
      });

      if (intent === 'MINT_BADGE' && tokenURI && transactionId) {
        await createMintedBadge({
          transactionId,
          userId,
          recipient,
          tokenURI,
        });
      }

      // ── UGF Auto-Execution ──────────────────────────────────────────────────
      // Attempt on-chain execution immediately after DB insert.
      // Runs only when UGF_SIGNER_PRIVATE_KEY + NFT_CONTRACT_ADDRESS are set.
      let onChainResult: UgfExecutionResult | null = null;

      const isBlockchainIntent =
        intent === 'MINT_BADGE' ||
        intent === 'CLAIM_CERT' ||
        intent === 'DONATE' ||
        intent === 'SEND_REWARD';

      if (isBlockchainIntent && transactionId) {
        if (!isUgfConfigured()) {
          logger.info('UGF not configured — skipping on-chain execution');
          onChainResult = {
            txHash: null,
            blockNumber: null,
            confirmedAt: null,
            quoteId: null,
            gasFeeUSD: null,
            status: 'skipped',
          };
        } else {
          logger.info(`Auto-executing UGF flow for intent=${intent} (async)`, { transactionId });
          onChainResult = {
            txHash: null,
            blockNumber: null,
            confirmedAt: null,
            quoteId: null,
            gasFeeUSD: null,
            status: 'pending',
          };
        }
      }

      // Build the assistant reply
      let finalReply = reply;
      if (onChainResult?.status === 'success' && onChainResult.txHash) {
        finalReply = `${reply}\n\n✅ Transaction confirmed on Base Sepolia!\nTx Hash: \`${onChainResult.txHash}\``;
      } else if (onChainResult?.status === 'failed') {
        finalReply = `${reply}\n\n⚠️ On-chain execution failed at step: **${onChainResult.failureStep}**. Your request was saved and will retry when conditions allow.`;
      }

      // Persist assistant reply after processing.
      const assistantMessageId = await insertChatMessage({
        sessionId: effectiveSessionId,
        sender: 'assistant',
        message: finalReply,
      });

      // ── UGF Asynchronous Auto-Execution ──────────────────────────────────────
      if (isBlockchainIntent && transactionId && isUgfConfigured()) {
        (async () => {
          try {
            const backgroundResult = await tryExecuteOnChain({
              intent,
              userWallet: walletAddress,
              recipient,
              amount,
              tokenURI,
            });

            if (backgroundResult.status !== 'skipped') {
              await patchTransaction(transactionId, {
                status: backgroundResult.status,
                txHash: backgroundResult.txHash,
                ugfQuoteId: backgroundResult.quoteId,
                gasFeesMockUsd: backgroundResult.gasFeeUSD ?? gasEstimate.mockUSD,
                blockNumber: backgroundResult.blockNumber,
                confirmedAt: backgroundResult.confirmedAt,
                contractAddress: config.nftContractAddress || null,
              });

              if (
                backgroundResult.status === 'success' &&
                backgroundResult.txHash &&
                (intent === 'MINT_BADGE' || intent === 'CLAIM_CERT')
              ) {
                await patchMintedBadgeTxHash(transactionId, backgroundResult.txHash);
              }

              let asyncReply = reply;
              if (backgroundResult.status === 'success' && backgroundResult.txHash) {
                asyncReply = `${reply}\n\n✅ Transaction confirmed on Base Sepolia!\nTx Hash: \`${backgroundResult.txHash}\``;
                logger.info(`UGF execution succeeded asynchronously`, {
                  transactionId,
                  txHash: backgroundResult.txHash,
                  blockNumber: backgroundResult.blockNumber,
                });
              } else if (backgroundResult.status === 'failed') {
                asyncReply = `${reply}\n\n⚠️ On-chain execution failed at step: **${backgroundResult.failureStep}**. Your request was saved and will retry when conditions allow.`;
                logger.warn(`UGF execution failed asynchronously at step: ${backgroundResult.failureStep}`, {
                  transactionId,
                  message: backgroundResult.failureMessage,
                });
              }

              if (assistantMessageId) {
                await patchChatMessage(assistantMessageId, asyncReply);
              }
            }
          } catch (err) {
            logger.error('Unhandled background UGF execution error', { transactionId, err });
          }
        })();
      }
      // ────────────────────────────────────────────────────────────────────────

      const response = {
        success: true,
        reply: finalReply,
        intent,
        recipient,
        amount,
        confidence,
        tokenURI,
        gasEstimate:
          intent !== 'UNKNOWN'
            ? {
              mockUSD: onChainResult?.gasFeeUSD ?? gasEstimate.mockUSD,
              currency: 'Mock USD',
              breakdown: gasEstimate.breakdown,
              note: gasEstimate.note,
            }
            : null,
        aiSteps,
        transactionSteps,
        sessionId: effectiveSessionId,
        transactionId,
        // On-chain execution fields
        txHash: onChainResult?.txHash ?? null,
        blockNumber: onChainResult?.blockNumber ?? null,
        confirmedAt: onChainResult?.confirmedAt ?? null,
        executionStatus: onChainResult?.status ?? 'skipped',
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      logger.error('Chat route failed', error);
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  })
);

/**
 * GET /api/chat/sessions?walletAddress=...
 */
router.get(
  '/chat/sessions',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = String(req.query.walletAddress || '').trim();

    if (!walletAddress) {
      throw new AppError(400, 'Missing required query: walletAddress');
    }

    if (!assertWalletAccess(req, walletAddress)) {
      throw new AppError(403, 'Wallet address does not match authenticated user');
    }

    const userId = req.user!.userId;

    const { data: sessions, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new AppError(500, error.message);
    }

    const sessionRows = sessions ?? [];
    const sessionIds = sessionRows.map((s) => s.id);

    const countMap = new Map<string, number>();
    if (sessionIds.length > 0) {
      const { data: messageRows, error: messageError } = await supabaseAdmin
        .from('chat_messages')
        .select('session_id')
        .in('session_id', sessionIds);

      if (messageError) {
        throw new AppError(500, messageError.message);
      }

      for (const row of messageRows ?? []) {
        const sid = row.session_id as string;
        countMap.set(sid, (countMap.get(sid) ?? 0) + 1);
      }
    }

    const sessionsNeedingTitle = sessionRows.filter(
      (s) => !s.title || s.title === 'New Session' || s.title === 'New Chat'
    );

    const titleFallbackMap = new Map<string, string>();
    if (sessionsNeedingTitle.length > 0) {
      const { data: firstMessages } = await supabaseAdmin
        .from('chat_messages')
        .select('session_id, message, created_at')
        .in(
          'session_id',
          sessionsNeedingTitle.map((s) => s.id)
        )
        .eq('sender', 'user')
        .order('created_at', { ascending: true });

      for (const row of firstMessages ?? []) {
        const sid = row.session_id as string;
        if (!titleFallbackMap.has(sid) && typeof row.message === 'string') {
          titleFallbackMap.set(sid, deriveSessionTitle(row.message));
        }
      }
    }

    const enriched = sessionRows.map((session) => ({
      id: session.id,
      title:
        titleFallbackMap.get(session.id) ??
        (session.title && session.title !== 'New Session' ? session.title : 'New Chat'),
      created_at: session.created_at,
      updated_at: session.updated_at,
      messageCount: countMap.get(session.id) ?? 0,
    }));

    return res.json({ success: true, sessions: enriched });
  })
);

/**
 * DELETE /api/chat/sessions/:sessionId
 */
router.delete(
  '/chat/sessions/:sessionId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    if (!sessionId || !isUuid(sessionId)) {
      throw new AppError(400, 'Invalid session id');
    }

    await assertSessionOwner(sessionId, userId);

    const { error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId);

    if (messagesError) {
      throw new AppError(500, messagesError.message);
    }

    const { error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (sessionError) {
      throw new AppError(500, sessionError.message);
    }

    return res.json({ success: true });
  })
);

/**
 * GET /api/chat/history/:sessionId
 * Get chat history for a session, ordered oldest -> newest.
 */
router.get(
  '/chat/history/:sessionId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.userId;

      if (!sessionId) {
        throw new Error('Missing required param: sessionId');
      }

      await assertSessionOwner(sessionId, userId);

      logger.info(`Fetching chat history for session ${sessionId}`);

      const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .select('id, session_id, sender, message, message_type, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(error.message ?? 'Failed to retrieve chat history');
      }

      res.json({
        success: true,
        messages: data ?? [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      logger.error('Chat history route failed', error);
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  })
);

export default router;
