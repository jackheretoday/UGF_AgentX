import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export type JwtPayload = {
  walletAddress: string;
  userId: string;
};

type JwtTokenBody = JwtPayload & {
  iat?: number;
  exp?: number;
};

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtTokenBody;
    if (!decoded.walletAddress || !decoded.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    req.user = {
      walletAddress: decoded.walletAddress,
      userId: decoded.userId,
    };
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
}

export function assertWalletAccess(req: Request, walletAddress: string): boolean {
  if (!req.user) return false;
  return req.user.walletAddress.toLowerCase() === walletAddress.toLowerCase();
}
