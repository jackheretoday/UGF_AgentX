import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getAddress, isAddress, verifyMessage } from 'viem';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { config } from '../config/env.js';
import { buildLoginMessage, deleteNonce, getNonce, setNonce } from '../services/nonceStore.js';
import { ensureUser } from '../services/userService.js';

const router = Router();

function formatUserResponse(user: Awaited<ReturnType<typeof ensureUser>>) {
  return {
    id: user.id,
    walletAddress: user.wallet_address,
    mockusdBalance: Number(user.mockusd_balance ?? 0),
    ethBalance: Number(user.eth_balance ?? 0),
    totalTransactions: Number(user.total_transactions ?? 0),
    totalNfts: Number(user.total_nfts ?? 0),
  };
}

/**
 * POST /api/auth/nonce
 */
router.post(
  '/auth/nonce',
  asyncHandler(async (req: Request, res: Response) => {
    const { walletAddress } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new AppError(400, 'Missing required field: walletAddress');
    }

    if (!isAddress(walletAddress)) {
      throw new AppError(400, 'Invalid wallet address');
    }

    const normalized = getAddress(walletAddress);
    const uuid = randomUUID();
    const nonce = buildLoginMessage(uuid);

    setNonce(normalized, nonce);

    return res.json({ nonce });
  })
);

/**
 * POST /api/auth/verify
 */
router.post(
  '/auth/verify',
  asyncHandler(async (req: Request, res: Response) => {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
      throw new AppError(400, 'Missing required fields: walletAddress, signature');
    }

    if (!isAddress(walletAddress)) {
      throw new AppError(400, 'Invalid wallet address');
    }

    const normalized = getAddress(walletAddress);
    const entry = getNonce(normalized);

    if (!entry) {
      throw new AppError(400, 'Nonce expired or not found');
    }

    const valid = await verifyMessage({
      address: normalized,
      message: entry.nonce,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    deleteNonce(normalized);

    const user = await ensureUser(normalized);
    const token = jwt.sign(
      { walletAddress: normalized, userId: user.id },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: formatUserResponse(user),
    });
  })
);

export default router;
