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

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }

  const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : null;
  return queryToken?.trim() || null;
}

function attachUserFromToken(req: Request, res: Response, token: string): boolean {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtTokenBody;
    if (!decoded.walletAddress || !decoded.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return false;
    }

    req.user = {
      walletAddress: decoded.walletAddress,
      userId: decoded.userId,
    };
    return true;
  } catch {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  if (attachUserFromToken(req, res, token)) {
    next();
  }
}

export function assertWalletAccess(req: Request, walletAddress: string): boolean {
  if (!req.user) return false;
  return req.user.walletAddress.toLowerCase() === walletAddress.toLowerCase();
}
