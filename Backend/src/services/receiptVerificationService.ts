import { JsonRpcProvider } from 'ethers';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type ReceiptVerificationResult = {
  verified: boolean;
  receipt: Record<string, unknown> | null;
  blockNumber: number | null;
  gasUsed: bigint | null;
  gasPrice: bigint | null;
  failureReason: string | null;
};

function serializeReceipt(
  receipt: Awaited<ReturnType<JsonRpcProvider['getTransactionReceipt']>>
): Record<string, unknown> {
  if (!receipt) return {};
  return {
    blockNumber: receipt.blockNumber,
    status: receipt.status,
    gasUsed: receipt.gasUsed?.toString() ?? null,
    gasPrice: receipt.gasPrice?.toString() ?? null,
    to: receipt.to,
    from: receipt.from,
    contractAddress: receipt.contractAddress,
    transactionHash: receipt.hash,
    logsCount: Array.isArray(receipt.logs) ? receipt.logs.length : 0,
  };
}

export async function verifyTransactionReceipt(options: {
  txHash: string;
  expectedContractAddress?: string | null;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<ReceiptVerificationResult> {
  const provider = new JsonRpcProvider(config.baseSepoliaRpcUrl);
  const deadline = Date.now() + (options.timeoutMs ?? 90_000);
  const intervalMs = options.pollIntervalMs ?? 2_000;
  const expected = options.expectedContractAddress?.toLowerCase() ?? null;

  while (Date.now() < deadline) {
    try {
      const receipt = await provider.getTransactionReceipt(options.txHash);

      if (receipt) {
        const statusOk = receipt.status === 1;
        const toAddress = (receipt.to ?? receipt.contractAddress ?? '').toLowerCase();
        const contractOk = !expected || toAddress === expected;

        if (!statusOk) {
          return {
            verified: false,
            receipt: serializeReceipt(receipt),
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            gasPrice: receipt.gasPrice ?? null,
            failureReason: 'Transaction reverted on-chain',
          };
        }

        if (!contractOk) {
          return {
            verified: false,
            receipt: serializeReceipt(receipt),
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            gasPrice: receipt.gasPrice ?? null,
            failureReason: `Contract address mismatch (expected ${expected}, got ${toAddress})`,
          };
        }

        const tx = await provider.getTransaction(options.txHash);
        if (!tx) {
          return {
            verified: false,
            receipt: serializeReceipt(receipt),
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            gasPrice: receipt.gasPrice ?? null,
            failureReason: 'Transaction not found on RPC',
          };
        }

        return {
          verified: true,
          receipt: serializeReceipt(receipt),
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          gasPrice: receipt.gasPrice ?? tx.gasPrice ?? null,
          failureReason: null,
        };
      }
    } catch (error) {
      logger.warn('Receipt poll error', { txHash: options.txHash, error });
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    verified: false,
    receipt: null,
    blockNumber: null,
    gasUsed: null,
    gasPrice: null,
    failureReason: 'Receipt confirmation timeout',
  };
}
