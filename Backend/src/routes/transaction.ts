import { Router, Request, Response } from 'express';
import { isAddress } from 'viem';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authMiddleware, assertWalletAccess } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../config/supabase.js';
import { config, isUgfUserPayerMode } from '../config/env.js';
import { ensureUser, getUserIdByWallet, normalizeWalletAddress } from '../services/userService.js';
import {
  assertTransactionOwner,
  getTransactionStatusForUser,
} from '../services/transactionStatusService.js';
import { subscribeTransaction } from '../services/transactionEventBus.js';
import { finalizeUserWalletExecution } from '../services/transactionExecutor.js';

const router = Router();

/**
 * POST /api/transaction
 */
router.post(
  '/transaction',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      walletAddress,
      actionType,
      status,
      txHash,
      gasFeeMockUsd,
      contractAddress,
      blockNumber,
    } = req.body;

    if (!walletAddress || !actionType) {
      throw new AppError(400, 'Missing required fields: walletAddress, actionType');
    }

    if (!assertWalletAccess(req, walletAddress)) {
      throw new AppError(403, 'Wallet address does not match authenticated user');
    }

    const userId = req.user!.userId;

    logger.info(`Transaction created for ${walletAddress}`, { actionType });

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        action_type: actionType,
        status: status ?? 'pending',
        tx_hash: txHash ?? null,
        gas_fee_mockusd: gasFeeMockUsd ?? null,
        contract_address: contractAddress ?? null,
        block_number: blockNumber ?? null,
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      throw new AppError(500, error.message);
    }

    return res.json({
      transactionId: data?.id,
      status: data?.status ?? 'pending',
      createdAt: data?.created_at ?? new Date().toISOString(),
    });
  })
);

/**
 * GET /api/transaction/history/:sessionId
 */
router.get(
  '/transaction/history/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    logger.info(`Fetching transaction history for session ${sessionId}`);

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      throw new AppError(500, sessionError.message);
    }

    if (!session?.user_id) {
      return res.json({
        sessionId,
        transactions: [],
      });
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, action_type, status, tx_hash, gas_fee_mockusd, network, created_at')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(500, error.message);
    }

    return res.json({
      sessionId,
      transactions: data ?? [],
    });
  })
);

/**
 * GET /api/transaction/:id/detail — full record + linked badge for activity UI
 */
router.get(
  '/transaction/:id/detail',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const transactionId = String(req.params.id || '').trim();
    const userId = req.user!.userId;

    if (!transactionId) {
      throw new AppError(400, 'Missing transaction id');
    }

    const owns = await assertTransactionOwner(transactionId, userId);
    if (!owns) {
      throw new AppError(404, 'Transaction not found');
    }

    const { data: row, error } = await supabaseAdmin
      .from('transactions')
      .select(
        'id, action_type, status, tx_hash, gas_fee_mockusd, network, created_at, confirmed_at, explorer_url, block_number, current_step, failure_reason, gas_used, gas_price, updated_at, contract_address, ugf_digest, ugf_quote_id, payment_coin, sponsor_status, execution_time_ms'
      )
      .eq('id', transactionId)
      .maybeSingle();

    if (error) {
      throw new AppError(500, error.message);
    }

    if (!row) {
      throw new AppError(404, 'Transaction not found');
    }

    const { data: badge } = await supabaseAdmin
      .from('minted_badges')
      .select('id, badge_name, recipient_name, metadata_uri, image_url, tx_hash, minted_at')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    const status = await getTransactionStatusForUser(transactionId, userId);

    return res.json({
      transaction: row,
      badge: badge ?? null,
      status,
    });
  })
);

/**
 * GET /api/transaction/status/:id
 */
router.get(
  '/transaction/status/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const transactionId = String(req.params.id || '').trim();
    const userId = req.user!.userId;

    if (!transactionId) {
      throw new AppError(400, 'Missing transaction id');
    }

    const status = await getTransactionStatusForUser(transactionId, userId);
    if (!status) {
      throw new AppError(404, 'Transaction not found');
    }

    return res.json(status);
  })
);

/**
 * GET /api/transaction/events/:id — Server-Sent Events for live status
 */
router.get(
  '/transaction/events/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const transactionId = String(req.params.id || '').trim();
    const userId = req.user!.userId;

    if (!transactionId) {
      throw new AppError(400, 'Missing transaction id');
    }

    const owns = await assertTransactionOwner(transactionId, userId);
    if (!owns) {
      throw new AppError(404, 'Transaction not found');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const current = await getTransactionStatusForUser(transactionId, userId);
    if (current) {
      send({ type: 'status', payload: current });
    }

    const unsubscribe = subscribeTransaction(transactionId, (event) => {
      send({ type: 'status', payload: event.payload });
    });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  })
);

/**
 * POST /api/transaction/:id/ugf/complete — browser finished settle + sponsorAndExecute
 */
router.post(
  '/transaction/:id/ugf/complete',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!isUgfUserPayerMode()) {
      throw new AppError(400, 'User-wallet UGF mode is not enabled');
    }

    const transactionId = String(req.params.id || '').trim();
    const userId = req.user!.userId;
    const walletAddress = String(req.body?.walletAddress || req.user!.walletAddress || '').trim();
    const txHash = String(req.body?.txHash || '').trim();
    const quoteId = req.body?.quoteId ? String(req.body.quoteId) : null;

    if (!transactionId || !walletAddress || !txHash) {
      throw new AppError(400, 'Missing transactionId, walletAddress, or txHash');
    }

    if (!assertWalletAccess(req, walletAddress)) {
      throw new AppError(403, 'Wallet address does not match authenticated user');
    }

    const owns = await assertTransactionOwner(transactionId, userId);
    if (!owns) {
      throw new AppError(404, 'Transaction not found');
    }

    const { data: row, error } = await supabaseAdmin
      .from('transactions')
      .select('quote_response, contract_address')
      .eq('id', transactionId)
      .maybeSingle();

    if (error) {
      throw new AppError(500, error.message);
    }

    const storedQuote = row?.quote_response as Record<string, unknown> | null;
    const agentx = storedQuote?._agentx as
      | { calldata?: string; contractAddress?: string; userWallet?: string }
      | undefined;

    const calldata = agentx?.calldata as `0x${string}` | undefined;
    if (!calldata?.startsWith('0x')) {
      throw new AppError(400, 'Missing stored calldata');
    }

    const contractAddress =
      agentx?.contractAddress || (row?.contract_address as string) || config.nftContractAddress;
    if (!isAddress(contractAddress)) {
      throw new AppError(500, 'Invalid contract address');
    }

    const digest = quoteId || (storedQuote?.digest as string | undefined) || null;

    void (async () => {
      try {
        await finalizeUserWalletExecution(
          {
            transactionId,
            userWallet: agentx?.userWallet || walletAddress,
            calldata,
            contractAddress,
          },
          txHash,
          digest
        );
      } catch (err) {
        logger.error('UGF finalize failed', { transactionId, err });
      }
    })();

    return res.json({
      success: true,
      transactionId,
      txHash,
      message: 'Verifying on-chain transaction',
    });
  })
);

/** @deprecated Use /ugf/complete — kept for older frontends */
router.post(
  '/transaction/:id/ugf/continue',
  authMiddleware,
  asyncHandler(async (_req: Request, _res: Response) => {
    throw new AppError(
      400,
      'Wallet execution must finish in the browser. Update the app and claim again — use /ugf/complete after mint.'
    );
  })
);

/**
 * GET /api/transactions/:walletAddress
 */
router.get(
  '/transactions/:walletAddress',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = String(req.params.walletAddress || '').trim();

    if (!walletAddress) {
      throw new AppError(400, 'Missing required param: walletAddress');
    }

    if (!assertWalletAccess(req, walletAddress)) {
      throw new AppError(403, 'Wallet address does not match authenticated user');
    }

    const userId = await getUserIdByWallet(walletAddress);
    if (!userId) {
      return res.json({ transactions: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select(
        'id, action_type, status, tx_hash, gas_fee_mockusd, network, created_at, confirmed_at, explorer_url, block_number, current_step, failure_reason, gas_used, updated_at, contract_address, ugf_digest, ugf_quote_id, payment_coin, sponsor_status, execution_time_ms'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(500, error.message);
    }

    return res.json({ transactions: data ?? [] });
  })
);

/**
 * GET /api/gallery/:walletAddress
 */
router.get(
  '/gallery/:walletAddress',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = String(req.params.walletAddress || '').trim();

    if (!walletAddress) {
      throw new AppError(400, 'Missing required param: walletAddress');
    }

    if (!assertWalletAccess(req, walletAddress)) {
      throw new AppError(403, 'Wallet address does not match authenticated user');
    }

    const userId = await getUserIdByWallet(walletAddress);
    if (!userId) {
      return res.json({ badges: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('minted_badges')
      .select(
        'id, transaction_id, badge_name, recipient_name, metadata_uri, image_url, tx_hash, minted_at'
      )
      .eq('user_id', userId)
      .order('minted_at', { ascending: false });

    if (error) {
      throw new AppError(500, error.message);
    }

    return res.json({ badges: data ?? [] });
  })
);

/**
 * GET /api/wallet?walletAddress=...
 */
router.get(
  '/wallet',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = String(req.query.walletAddress || '').trim();

    if (!walletAddress) {
      throw new AppError(400, 'Missing required query: walletAddress');
    }

    if (!assertWalletAccess(req, walletAddress)) {
      throw new AppError(403, 'Wallet address does not match authenticated user');
    }

    const normalized = normalizeWalletAddress(walletAddress);

    let { data, error } = await supabaseAdmin
      .from('users')
      .select(
        'id, wallet_address, username, auth_type, mockusd_balance, eth_balance, total_transactions, total_nfts, last_active'
      )
      .eq('wallet_address', normalized)
      .maybeSingle();

    if (error) {
      throw new AppError(500, error.message);
    }

    if (!data) {
      data = await ensureUser(walletAddress);
    }

    return res.json({ wallet: data });
  })
);

export default router;
