import { Router, Request, Response } from 'express';
import {
  getGlobalUgfSignerAddress,
  isNftContractConfigured,
  isUgfConfigured,
  isUgfSignerConfigured,
} from '../config/env.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const ugfSignerConfigured = isUgfSignerConfigured();
  const nftContractConfigured = isNftContractConfigured();
  const ugfConfigured = isUgfConfigured();

  let ugfSignerAddress: string | null = null;
  if (ugfSignerConfigured) {
    try {
      ugfSignerAddress = getGlobalUgfSignerAddress();
    } catch {
      ugfSignerAddress = null;
    }
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ugfSignerConfigured,
    nftContractConfigured,
    ugfConfigured,
    onChainEnabled: ugfConfigured,
    ugfSignerAddress,
  });
});

export default router;
