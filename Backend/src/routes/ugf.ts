import { Router, Request, Response } from 'express';
import { encodeFunctionData, isAddress, parseUnits } from 'viem';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authMiddleware, assertWalletAccess } from '../middleware/authMiddleware.js';
import { supabaseAdmin } from '../config/supabase.js';
import { executeUgfFlow, UgfStepError } from '../services/ugfService.js';

const router = Router();

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

function assertAddress(value: string, label: string): `0x${string}` {
  if (!isAddress(value)) {
    throw new AppError(400, `Invalid ${label} address`);
  }
  return value;
}

function resolveMintRecipient(recipient: string | null, fallback: `0x${string}`): `0x${string}` {
  if (recipient && isAddress(recipient)) return recipient;
  return fallback;
}

function getBadgeName(intent: string, recipient: string | null, fallback: string): string {
  const displayRecipient = recipient ?? fallback;
  return `UGF AgentX ${intent} — ${displayRecipient}`;
}

router.post(
  '/ugf/execute',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { intent, userWallet, recipient, amount, tokenURI, sessionId } = req.body;

    if (!intent || !userWallet || !sessionId) {
      throw new AppError(400, 'Missing required fields: intent, userWallet, sessionId');
    }

    if (!assertWalletAccess(req, userWallet)) {
      throw new AppError(403, 'Wallet address does not match authenticated user');
    }

    if (!['MINT_BADGE', 'CLAIM_CERT', 'DONATE', 'SEND_REWARD'].includes(intent)) {
      throw new AppError(400, `Unsupported intent: ${intent}`);
    }

    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    if (!contractAddress || !isAddress(contractAddress)) {
      throw new AppError(500, 'NFT_CONTRACT_ADDRESS is missing or invalid');
    }

    const userAddress = assertAddress(userWallet, 'user wallet');
    const userId = req.user!.userId;

    let calldata: `0x${string}`;
    let resolvedRecipient: string | null = recipient ?? null;

    if (intent === 'DONATE') {
      if (amount === null || amount === undefined) {
        throw new AppError(400, 'Missing required field: amount');
      }
      if (!recipient || !isAddress(recipient)) {
        throw new AppError(400, 'Missing or invalid recipient address for donation');
      }

      const amountUnits = parseUnits(String(amount), MOCK_USD_DECIMALS);
      calldata = encodeFunctionData({
        abi: NFT_ABI,
        functionName: 'donate',
        args: [recipient, amountUnits],
      });
    } else {
      if (!tokenURI) {
        throw new AppError(400, 'Missing required field: tokenURI');
      }

      const mintTo = resolveMintRecipient(recipient ?? null, userAddress);
      resolvedRecipient = recipient ?? null;

      calldata = encodeFunctionData({
        abi: NFT_ABI,
        functionName: 'mintBadge',
        args: [mintTo, tokenURI],
      });
    }

    let flowResult = null;
    let failure: UgfStepError | null = null;

    try {
      flowResult = await executeUgfFlow({
        to: contractAddress,
        data: calldata,
        value: '0',
      });
    } catch (error) {
      if (error instanceof UgfStepError) {
        failure = error;
      } else {
        throw error;
      }
    }

    const resultData = (flowResult ?? failure?.data ?? {}) as Record<string, unknown>;
    const status = flowResult
      ? flowResult.status
      : failure?.step === 'confirm'
        ? 'pending'
        : 'failed';

    const { data: txRow, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        action_type: intent,
        status,
        tx_hash: (resultData.txHash as string | undefined) ?? null,
        ugf_quote_id: (resultData.quoteId as string | undefined) ?? null,
        gas_fee_mockusd: (resultData.estimatedGasFeeUSD as number | undefined) ?? null,
        network: 'Base Sepolia',
        contract_address: contractAddress,
        block_number: (resultData.blockNumber as number | undefined) ?? null,
        confirmed_at: (resultData.confirmedAt as string | undefined) ?? null,
      })
      .select('id')
      .single();

    if (txError) {
      throw new AppError(500, txError.message);
    }

    if (
      flowResult?.status === 'success' &&
      (intent === 'MINT_BADGE' || intent === 'CLAIM_CERT') &&
      tokenURI
    ) {
      const { error: badgeError } = await supabaseAdmin.from('minted_badges').insert({
        transaction_id: txRow?.id,
        user_id: userId,
        badge_name: getBadgeName(intent, resolvedRecipient, userAddress),
        recipient_name: resolvedRecipient,
        metadata_uri: tokenURI,
        tx_hash: flowResult.txHash ?? null,
      });

      if (badgeError) {
        throw new AppError(500, badgeError.message);
      }
    }

    if (!flowResult) {
      return res.json({
        success: false,
        error: failure?.message ?? 'Transaction execution failed',
        step: failure?.step ?? 'execute',
        txHash: (resultData.txHash as string | undefined) ?? null,
        supabaseId: txRow?.id ?? null,
      });
    }

    return res.json({
      success: true,
      intent,
      txHash: flowResult.txHash,
      blockNumber: flowResult.blockNumber,
      gasFeeUSD: flowResult.estimatedGasFeeUSD,
      confirmedAt: flowResult.confirmedAt,
      supabaseId: txRow?.id ?? null,
    });
  })
);

export default router;
