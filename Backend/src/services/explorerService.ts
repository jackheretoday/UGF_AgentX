import { config } from '../config/env.js';

/**
 * Builds a block explorer URL for a transaction hash.
 * Default: Base Sepolia (sepolia.basescan.org).
 * Override with EXPLORER_TX_URL_TEMPLATE, e.g. https://sepolia.basescan.org/tx/{txHash}
 */
export function buildExplorerTxUrl(txHash: string): string | null {
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/u.test(txHash)) {
    return null;
  }

  const template =
    process.env.EXPLORER_TX_URL_TEMPLATE ||
    'https://sepolia.basescan.org/tx/{txHash}';

  return template.replace(/\{txHash\}/gi, txHash);
}

export function getChainDisplayName(): string {
  return process.env.CHAIN_DISPLAY_NAME || 'Base Sepolia';
}

export function getExplorerOrigin(): string {
  const template =
    process.env.EXPLORER_TX_URL_TEMPLATE ||
    'https://sepolia.basescan.org/tx/{txHash}';
  return template.replace(/\{txHash\}/gi, '').replace(/\/tx\/?$/i, '') || config.baseSepoliaRpcUrl;
}
