import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authMiddleware, assertWalletAccess } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../config/supabase.js';
import { getUserIdByWallet } from '../services/userService.js';

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
      .select('id, action_type, status, tx_hash, gas_fee_mockusd, network, created_at')
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
      .select('id, badge_name, recipient_name, metadata_uri, image_url, tx_hash, minted_at')
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

    const { data, error } = await supabaseAdmin
      .from('users')
      .select(
        'id, wallet_address, username, auth_type, mockusd_balance, eth_balance, total_transactions, total_nfts, last_active'
      )
      .eq('id', req.user!.userId)
      .single();

    if (error) {
      throw new AppError(500, error.message);
    }

    return res.json({ wallet: data });
  })
);

export default router;
