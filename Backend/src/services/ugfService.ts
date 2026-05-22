import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_TYPE,
  TYI_USD_PAYMENT_COIN,
  UGFClient,
} from '@tychilabs/ugf-testnet-js';
import { JsonRpcProvider, Wallet } from 'ethers';
import {
  config,
  getGlobalUgfSignerAddress,
  isUgfSignerConfigured,
  isUgfUserPayerMode,
} from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  buildSettlementFailureMessage,
  fetchTyiMockUsdBalance,
  parseGatewayErrorBody,
  preflightTyiSettlement,
  submitX402PaymentWithDetails,
} from './ugfSettlement.js';

export class UgfStepError extends Error {
  constructor(
    public step: 'quote' | 'settle' | 'execute' | 'confirm',
    message: string,
    public data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'UgfStepError';
  }
}

const BASE_SEPOLIA_RPC_URL = config.baseSepoliaRpcUrl;
const DEFAULT_POLL_TIMEOUT_MS = Number(process.env.UGF_POLL_TIMEOUT_MS || 120_000);
const DEFAULT_POLL_INTERVAL_MS = Number(process.env.UGF_POLL_INTERVAL_MS || 2_000);
/** Reuse UGF JWT between quote/settle/execute to avoid gateway rate limits (HTTP 429). */
const UGF_AUTH_CACHE_TTL_MS = Number(process.env.UGF_AUTH_CACHE_TTL_MS || 600_000);

let cachedClient: UGFClient | null = null;
let ugfAuthCache: { signerAddress: string; cachedAt: number } | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHttpStatus(error: unknown): number | undefined {
  return (error as { statusCode?: number })?.statusCode;
}

function formatUgfAuthFailure(error: unknown, signerAddress: string): string {
  const status = getHttpStatus(error);
  if (status === 429) {
    return (
      `UGF gateway rate limit (HTTP 429). Wait 30–60 seconds before claiming again. ` +
      `Too many wallet logins in a short time. Signer: ${signerAddress}`
    );
  }
  return `Failed to authenticate with UGF: ${extractUgfErrorMessage(error)}`;
}

function getClient(): UGFClient {
  if (cachedClient) return cachedClient;
  cachedClient = new UGFClient();
  return cachedClient;
}

/** Global UGF identity — always from UGF_SIGNER_PRIVATE_KEY (never the user's wallet). */
export function getSignerAddress(): string {
  return getGlobalUgfSignerAddress();
}

function getSigner(): Wallet {
  if (!isUgfSignerConfigured()) {
    throw new Error('UGF_SIGNER_PRIVATE_KEY is not configured');
  }

  const provider = new JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  return new Wallet(config.ugfSignerPrivateKey.trim(), provider);
}

function toIsoTimestamp(expiresAt: unknown): string | null {
  if (expiresAt === null || expiresAt === undefined) return null;
  const value = typeof expiresAt === 'string' ? Number(expiresAt) : Number(expiresAt);
  if (!Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

export function extractUgfErrorMessage(error: unknown): string {
  if (error instanceof UgfStepError) {
    const data = error.data ?? {};
    const gateway = data.gatewayBody ?? data.ugfResponse;
    if (gateway !== undefined) {
      return `${error.message} | gateway_response=${JSON.stringify(gateway)}`;
    }
    return error.message;
  }

  if (error instanceof Error) {
    const extended = error as Error & {
      code?: string;
      statusCode?: number;
      gatewayBody?: unknown;
    };
    const parts = [extended.message];
    if (extended.code) parts.push(`code=${extended.code}`);
    if (extended.statusCode) parts.push(`status=${extended.statusCode}`);
    if (extended.gatewayBody !== undefined) {
      parts.push(`gateway_response=${JSON.stringify(extended.gatewayBody)}`);
    }
    return parts.join(' ');
  }
  return String(error);
}

export function parseUsdAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeStatus(value: unknown): 'success' | 'failed' | 'pending' {
  const raw = String(value ?? '').toLowerCase();
  if (['success', 'completed', 'confirmed', 'done', 'ok'].includes(raw)) return 'success';
  if (['failed', 'error', 'reverted', 'expired'].includes(raw)) return 'failed';
  return 'pending';
}

async function fetchStatus(client: UGFClient, digest: string): Promise<Record<string, unknown>> {
  const statusApi = client.status as unknown as {
    get: (arg: unknown) => Promise<Record<string, unknown>>;
  };
  if (!statusApi || typeof statusApi.get !== 'function') {
    throw new Error('UGF status API not available');
  }
  try {
    return await statusApi.get({ digest });
  } catch {
    return await statusApi.get(digest);
  }
}

export async function pollUgfStatus(
  client: UGFClient,
  digest: string,
  timeoutMs = DEFAULT_POLL_TIMEOUT_MS,
  intervalMs = DEFAULT_POLL_INTERVAL_MS
): Promise<{
  status: 'success' | 'failed' | 'pending';
  txHash: string | null;
  blockNumber: number | null;
  confirmedAt: string | null;
  raw: Record<string, unknown>;
}> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const statusResponse = await fetchStatus(client, digest);
    const normalized = normalizeStatus(
      statusResponse?.status ??
        statusResponse?.tx_status ??
        statusResponse?.state ??
        statusResponse?.stage
    );

    const txHash =
      (statusResponse?.user_tx_hash as string | undefined) ??
      (statusResponse?.tx_hash as string | undefined) ??
      (statusResponse?.userTxHash as string | undefined) ??
      null;

    const blockNumber =
      (statusResponse?.block_number as number | undefined) ??
      (statusResponse?.blockNumber as number | undefined) ??
      null;

    const confirmedAt =
      (statusResponse?.confirmed_at as string | undefined) ??
      (statusResponse?.completed_at as string | undefined) ??
      (statusResponse?.confirmedAt as string | undefined) ??
      null;

    if (normalized !== 'pending') {
      return {
        status: normalized,
        txHash,
        blockNumber: blockNumber ? Number(blockNumber) : null,
        confirmedAt: confirmedAt ? String(confirmedAt) : null,
        raw: statusResponse,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    status: 'pending',
    txHash: null,
    blockNumber: null,
    confirmedAt: null,
    raw: {},
  };
}

export type UgfFlowPayload = {
  /** On-chain `from` for the destination tx (contract owner / executor) */
  from?: string;
  /** Contract call target (NFT_CONTRACT_ADDRESS) */
  to: string;
  data: `0x${string}`;
  value?: string | bigint;
};

export type UgfQuoteParties = {
  payerAddress: string;
  executorAddress: string;
};

/**
 * UGF sponsors Base Sepolia ETH to the wallet that pays TYI and sends the tx.
 * User-payer mode: payer and executor must both be the connected wallet.
 */
export function resolveUgfQuoteParties(userWallet: string): UgfQuoteParties {
  if (isUgfUserPayerMode()) {
    return {
      payerAddress: userWallet,
      executorAddress: userWallet,
    };
  }
  const executor = getGlobalUgfSignerAddress();
  return { payerAddress: executor, executorAddress: executor };
}

export function toUgfQuoteSnapshot(quote: UgfQuoteResult['quote']): Record<string, unknown> {
  return { ...(quote as object) };
}

export type UgfQuoteResult = {
  quote: Awaited<ReturnType<UGFClient['quote']['get']>>;
  quoteId: string;
  estimatedGasFeeUSD: number;
  expiresAt: string | null;
  paymentCoin: string;
  paymentMode: string | null;
  sponsorStatus: string | null;
};

export type UgfFlowResult = {
  quoteId: string;
  estimatedGasFeeUSD: number;
  expiresAt: string | null;
  settlementId: string;
  txId: string;
  txHash: string | null;
  status: 'success';
  blockNumber: number | null;
  confirmedAt: string | null;
  quoteResponse: Record<string, unknown>;
  settlementResponse: Record<string, unknown>;
  ugfStatusResponse: Record<string, unknown>;
};

export type UgfProgressHook = (
  phase: 'quote' | 'settle' | 'execute' | 'mining',
  detail?: Record<string, unknown>
) => void | Promise<void>;

async function loginWithBackoff(client: UGFClient, signer: Wallet): Promise<void> {
  const delays = [0, 2_000, 5_000];
  let lastError: unknown;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      logger.info(`UGF auth retry ${attempt + 1}/${delays.length} after HTTP 429`);
      await sleep(delays[attempt]);
    }
    try {
      await client.auth.login(signer);
      return;
    } catch (error) {
      lastError = error;
      if (getHttpStatus(error) !== 429 || attempt === delays.length - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function ensureUgfAuth(): Promise<{
  client: UGFClient;
  signer: Wallet;
}> {
  const client = getClient();
  let signer: Wallet;

  try {
    signer = getSigner();
  } catch (error) {
    logger.error('UGF signer initialization failed', error);
    throw new UgfStepError('quote', 'Failed to initialize UGF signer');
  }

  const signerAddress = signer.address.toLowerCase();
  const existingToken = client.auth.getToken();
  const cacheValid =
    existingToken &&
    ugfAuthCache?.signerAddress === signerAddress &&
    Date.now() - ugfAuthCache.cachedAt < UGF_AUTH_CACHE_TTL_MS;

  if (cacheValid) {
    return { client, signer };
  }

  try {
    await loginWithBackoff(client, signer);
    ugfAuthCache = { signerAddress, cachedAt: Date.now() };
  } catch (error) {
    ugfAuthCache = null;
    logger.warn('UGF auth failed', error);
    throw new UgfStepError('quote', formatUgfAuthFailure(error, signer.address), {
      statusCode: getHttpStatus(error),
      payerAddress: signer.address,
    });
  }

  return { client, signer };
}

async function requestUgfQuote(
  client: UGFClient,
  payload: UgfFlowPayload,
  parties: UgfQuoteParties
): Promise<UgfQuoteResult> {
  const value =
    payload.value === undefined
      ? '0'
      : typeof payload.value === 'bigint'
        ? payload.value.toString()
        : String(payload.value);

  const txFrom = payload.from ?? parties.executorAddress;

  let quote: Awaited<ReturnType<UGFClient['quote']['get']>>;
  try {
    quote = await client.quote.get({
      payment_coin: TYI_USD_PAYMENT_COIN,
      payer_address: parties.payerAddress,
      payment_chain: BASE_SEPOLIA_CHAIN_ID,
      payment_chain_type: BASE_SEPOLIA_CHAIN_TYPE,
      tx_object: JSON.stringify({
        from: txFrom,
        to: payload.to,
        data: payload.data,
        value,
      }),
      dest_chain_id: BASE_SEPOLIA_CHAIN_ID,
      dest_chain_type: BASE_SEPOLIA_CHAIN_TYPE,
    });
  } catch (error) {
    const status = getHttpStatus(error);
    if (status === 401) {
      ugfAuthCache = null;
    }
    logger.warn('UGF quote failed', error);
    throw new UgfStepError(
      'quote',
      status === 429
        ? `UGF gateway rate limit (HTTP 429). Wait before retrying. ${extractUgfErrorMessage(error)}`
        : `Failed to get UGF quote: ${extractUgfErrorMessage(error)}`,
      { statusCode: status }
    );
  }

  const quoteId = String(quote?.digest ?? '');
  const estimatedGasFeeUSD = parseUsdAmount(quote?.payment_amount ?? quote?.gas_amount);
  const expiresAt = toIsoTimestamp(quote?.expires_at);

  return {
    quote,
    quoteId,
    estimatedGasFeeUSD,
    expiresAt,
    paymentCoin: TYI_USD_PAYMENT_COIN,
    paymentMode: quote?.payment_mode ? String(quote.payment_mode) : null,
    sponsorStatus: quote?.payment_mode === 'vault' ? 'vault_sponsor' : 'x402',
  };
}

export async function getUgfQuote(
  payload: UgfFlowPayload,
  userWallet?: string
): Promise<UgfQuoteResult> {
  const { client } = await ensureUgfAuth();
  const parties = resolveUgfQuoteParties(userWallet ?? getGlobalUgfSignerAddress());
  return requestUgfQuote(client, payload, parties);
}

export async function preflightPayerTyiBalance(
  quote: UgfQuoteResult['quote'],
  payerAddress: string
): Promise<Awaited<ReturnType<typeof preflightTyiSettlement>>> {
  const { client } = await ensureUgfAuth();
  return preflightTyiSettlement(client, quote, payerAddress);
}

/** On-chain execute + confirm only (after user wallet completed x402 settlement). */
export async function executeUgfChainPhase(
  payload: UgfFlowPayload,
  quoteResult: UgfQuoteResult,
  onProgress?: UgfProgressHook
): Promise<UgfFlowResult> {
  const startedAt = Date.now();
  const { client, signer } = await ensureUgfAuth();
  const { quote, quoteId, estimatedGasFeeUSD, expiresAt } = quoteResult;
  const quoteResponse = { ...(quote as object) } as Record<string, unknown>;
  const settlementResponse: Record<string, unknown> = {
    mode: quote?.payment_mode ?? 'unknown',
    settledBy: 'user_wallet',
  };

  let txHash: string | null = null;

  await onProgress?.('execute', { message: 'Submitting sponsored transaction' });

  try {
    const value =
      payload.value === undefined
        ? 0n
        : typeof payload.value === 'bigint'
          ? payload.value
          : BigInt(payload.value);

    const execution = await client.chains.evm.sponsorAndExecute(quoteId, signer, async () => ({
      to: payload.to,
      data: payload.data,
      value,
    }));

    txHash = (execution as { userTxHash?: string })?.userTxHash ?? null;
  } catch (error) {
    logger.warn('UGF execution failed', error);
    throw new UgfStepError('execute', `Transaction execution failed: ${extractUgfErrorMessage(error)}`, {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
      settlementId: quoteId,
      txId: quoteId,
      txHash,
      quoteResponse,
      settlementResponse,
    });
  }

  await onProgress?.('execute', { txHash, quoteId });
  await onProgress?.('mining', { txHash, message: 'Waiting for on-chain confirmation' });

  const statusResult = await pollUgfStatus(client, quoteId);

  if (statusResult.status === 'pending') {
    throw new UgfStepError('confirm', 'Confirmation timeout', {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
      settlementId: quoteId,
      txId: quoteId,
      txHash,
      status: 'pending',
      quoteResponse,
      settlementResponse,
      executionTimeMs: Date.now() - startedAt,
    });
  }

  if (statusResult.status === 'failed') {
    throw new UgfStepError('execute', 'Transaction failed on-chain', {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
      settlementId: quoteId,
      txId: quoteId,
      txHash: statusResult.txHash ?? txHash,
      status: 'failed',
      blockNumber: statusResult.blockNumber,
      confirmedAt: statusResult.confirmedAt,
      quoteResponse,
      settlementResponse,
      ugfStatusResponse: statusResult.raw,
    });
  }

  const finalTxHash = statusResult.txHash ?? txHash;

  await onProgress?.('mining', {
    txHash: finalTxHash,
    blockNumber: statusResult.blockNumber,
    confirmedAt: statusResult.confirmedAt,
  });

  return {
    quoteId,
    estimatedGasFeeUSD,
    expiresAt,
    settlementId: quoteId,
    txId: quoteId,
    txHash: finalTxHash,
    status: 'success',
    blockNumber: statusResult.blockNumber,
    confirmedAt: statusResult.confirmedAt,
    quoteResponse,
    settlementResponse,
    ugfStatusResponse: statusResult.raw,
  };
}

export async function executeUgfFlow(
  payload: UgfFlowPayload,
  onProgress?: UgfProgressHook
): Promise<UgfFlowResult> {
  const startedAt = Date.now();
  const { client, signer } = await ensureUgfAuth();

  await onProgress?.('quote', { message: 'Fetching live UGF quote' });

  const parties = resolveUgfQuoteParties(signer.address);

  let quoteResult: UgfQuoteResult;
  try {
    quoteResult = await requestUgfQuote(client, payload, parties);
  } catch (error) {
    if (error instanceof UgfStepError) throw error;
    throw new UgfStepError('quote', `Failed to get UGF quote: ${extractUgfErrorMessage(error)}`);
  }

  const { quote, quoteId, estimatedGasFeeUSD, expiresAt } = quoteResult;
  const quoteResponse = { ...(quote as object) } as Record<string, unknown>;

  await onProgress?.('quote', {
    quoteId,
    estimatedGasFeeUSD,
    paymentCoin: quoteResult.paymentCoin,
    sponsorStatus: quoteResult.sponsorStatus,
    payerAddress: parties.payerAddress,
    executorAddress: parties.executorAddress,
  });

  await onProgress?.('settle', { message: 'Settling Mock USD via UGF' });

  let settlementResponse: Record<string, unknown> = { mode: quote?.payment_mode ?? 'unknown' };
  let tyiBalance = null as Awaited<ReturnType<typeof fetchTyiMockUsdBalance>> | null;

  try {
    const preflight = await preflightTyiSettlement(client, quote, parties.payerAddress);
    tyiBalance = preflight?.balance ?? null;

    if (preflight && preflight.shortfall > 0n) {
      const detail = buildSettlementFailureMessage({
        gatewayMessage: 'Insufficient TYI Mock USD balance before settlement',
        httpStatus: 400,
        paymentMode: String(quote.payment_mode),
        payerAddress: signer.address,
        paymentAmountRaw: String(quote.payment_amount),
        balance: preflight.balance,
      });
      throw new UgfStepError('settle', `Mock USD settlement failed: ${detail}`, {
        quoteId,
        estimatedGasFeeUSD,
        expiresAt,
        quoteResponse,
        paymentMode: quote?.payment_mode,
        payerAddress: signer.address,
        code: 'INSUFFICIENT_TYI_BALANCE',
        tyiBalance: {
          raw: preflight.balance.balanceRaw.toString(),
          formatted: preflight.balance.balanceFormatted,
          token: preflight.balance.tokenAddress,
        },
      });
    }

    if (quote?.payment_mode === 'vault') {
      await client.payment.vault.payAndSubmit(
        quote,
        signer,
        BASE_SEPOLIA_CHAIN_ID,
        TYI_USD_PAYMENT_COIN
      );
      settlementResponse = { mode: 'vault', status: 'submitted' };
    } else {
      const { settlementResponse: x402Response, gatewayBody } = await submitX402PaymentWithDetails(
        client,
        quote,
        signer
      );
      settlementResponse = x402Response;
      await onProgress?.('settle', { gatewayBody });
    }
  } catch (error) {
    if (error instanceof UgfStepError) {
      throw error;
    }

    if (!tyiBalance) {
      try {
        tyiBalance = await fetchTyiMockUsdBalance(client, signer.address);
      } catch {
        // ignore
      }
    }

    const httpStatus =
      (error as { statusCode?: number }).statusCode ??
      (error instanceof UgfStepError ? 400 : 500);
    const gatewayBody = (error as { gatewayBody?: unknown }).gatewayBody;
    const gatewayMessage =
      gatewayBody !== undefined
        ? parseGatewayErrorBody(gatewayBody, httpStatus)
        : error instanceof Error
          ? error.message
          : String(error);

    const detail = buildSettlementFailureMessage({
      gatewayMessage,
      httpStatus,
      paymentMode: String(quote?.payment_mode ?? 'unknown'),
      payerAddress: signer.address,
      paymentAmountRaw: String(quote?.payment_amount ?? '0'),
      balance: tyiBalance,
      gatewayBody,
    });

    logger.warn('UGF settlement failed', {
      detail,
      paymentMode: quote?.payment_mode,
      payer: signer.address,
      paymentAmount: quote?.payment_amount,
      tyiBalance: tyiBalance?.balanceRaw?.toString(),
      gatewayBody,
    });

    throw new UgfStepError('settle', `Mock USD settlement failed: ${detail}`, {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
      quoteResponse,
      settlementResponse,
      paymentMode: quote?.payment_mode,
      payerAddress: signer.address,
      gatewayBody,
      tyiBalance: tyiBalance
        ? {
            raw: tyiBalance.balanceRaw.toString(),
            formatted: tyiBalance.balanceFormatted,
            token: tyiBalance.tokenAddress,
          }
        : null,
    });
  }

  await onProgress?.('settle', { quoteId, settlementResponse });

  let txHash: string | null = null;

  await onProgress?.('execute', { message: 'Submitting sponsored transaction' });

  try {
    const value =
      payload.value === undefined
        ? 0n
        : typeof payload.value === 'bigint'
          ? payload.value
          : BigInt(payload.value);

    const execution = await client.chains.evm.sponsorAndExecute(quoteId, signer, async () => ({
      to: payload.to,
      data: payload.data,
      value,
    }));

    txHash = (execution as { userTxHash?: string })?.userTxHash ?? null;
  } catch (error) {
    logger.warn('UGF execution failed', error);
    throw new UgfStepError('execute', 'Transaction execution failed', {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
      settlementId: quoteId,
      txId: quoteId,
      txHash,
      quoteResponse,
      settlementResponse,
    });
  }

  await onProgress?.('execute', { txHash, quoteId });

  await onProgress?.('mining', { txHash, message: 'Waiting for on-chain confirmation' });

  const statusResult = await pollUgfStatus(client, quoteId);

  if (statusResult.status === 'pending') {
    throw new UgfStepError('confirm', 'Confirmation timeout', {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
      settlementId: quoteId,
      txId: quoteId,
      txHash,
      status: 'pending',
      quoteResponse,
      settlementResponse,
      executionTimeMs: Date.now() - startedAt,
    });
  }

  if (statusResult.status === 'failed') {
    throw new UgfStepError('execute', 'Transaction failed on-chain', {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
      settlementId: quoteId,
      txId: quoteId,
      txHash: statusResult.txHash ?? txHash,
      status: 'failed',
      blockNumber: statusResult.blockNumber,
      confirmedAt: statusResult.confirmedAt,
      quoteResponse,
      settlementResponse,
      ugfStatusResponse: statusResult.raw,
    });
  }

  const finalTxHash = statusResult.txHash ?? txHash;

  await onProgress?.('mining', {
    txHash: finalTxHash,
    blockNumber: statusResult.blockNumber,
    confirmedAt: statusResult.confirmedAt,
  });

  return {
    quoteId,
    estimatedGasFeeUSD,
    expiresAt,
    settlementId: quoteId,
    txId: quoteId,
    txHash: finalTxHash,
    status: 'success',
    blockNumber: statusResult.blockNumber,
    confirmedAt: statusResult.confirmedAt,
    quoteResponse,
    settlementResponse,
    ugfStatusResponse: statusResult.raw,
  };
}
