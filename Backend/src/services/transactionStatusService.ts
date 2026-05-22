import { supabaseAdmin } from '../config/supabase.js';
import { buildExplorerTxUrl, getChainDisplayName } from './explorerService.js';
import { emitTransactionStatus } from './transactionEventBus.js';
import type {
  TransactionLifecycleStatus,
  TransactionStatusPayload,
} from '../types/transaction.js';
import { logger } from '../utils/logger.js';

export type TransactionRowPatch = {
  status?: TransactionLifecycleStatus | string;
  current_step?: string | null;
  tx_hash?: string | null;
  explorer_url?: string | null;
  ugf_quote_id?: string | null;
  ugf_digest?: string | null;
  gas_fee_mockusd?: number | null;
  gas_used?: number | null;
  gas_price?: number | null;
  block_number?: number | null;
  confirmed_at?: string | null;
  contract_address?: string | null;
  failure_reason?: string | null;
  execution_time_ms?: number | null;
  quote_response?: unknown;
  settlement_response?: unknown;
  receipt_json?: unknown;
  payment_coin?: string | null;
  sponsor_status?: string | null;
  updated_at?: string;
};

function normalizeDbStatus(status: string): TransactionLifecycleStatus {
  const raw = status.toLowerCase();
  if (raw === 'success' || raw === 'completed') return 'confirmed';
  if (
    raw === 'pending' ||
    raw === 'quoted' ||
    raw === 'awaiting_settlement' ||
    raw === 'settling' ||
    raw === 'executing' ||
    raw === 'mining' ||
    raw === 'confirmed' ||
    raw === 'failed'
  ) {
    return raw as TransactionLifecycleStatus;
  }
  return 'pending';
}

function rowToPayload(row: Record<string, unknown>): TransactionStatusPayload {
  const status = normalizeDbStatus(String(row.status ?? 'pending'));
  const txHash = (row.tx_hash as string | null) ?? null;

  return {
    id: String(row.id),
    status,
    txHash,
    explorerUrl:
      (row.explorer_url as string | null) ??
      (txHash ? buildExplorerTxUrl(txHash) : null),
    blockNumber: row.block_number != null ? Number(row.block_number) : null,
    gasFee: row.gas_fee_mockusd != null ? Number(row.gas_fee_mockusd) : null,
    gasUsed: row.gas_used != null ? Number(row.gas_used) : null,
    gasPrice: row.gas_price != null ? Number(row.gas_price) : null,
    confirmedAt: (row.confirmed_at as string | null) ?? null,
    currentStep: (row.current_step as string | null) ?? status,
    failureReason: (row.failure_reason as string | null) ?? null,
    network: (row.network as string) || 'Base Sepolia',
    paymentCoin: (row.payment_coin as string | null) ?? 'TYI_USD',
    sponsorStatus: (row.sponsor_status as string | null) ?? null,
    chainName: getChainDisplayName(),
    ugfDigest: (row.ugf_digest as string | null) ?? (row.ugf_quote_id as string | null) ?? null,
    executionTimeMs: row.execution_time_ms != null ? Number(row.execution_time_ms) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

export async function patchTransactionRow(
  transactionId: string,
  patch: TransactionRowPatch
): Promise<void> {
  const update: Record<string, unknown> = {
    ...patch,
    updated_at: patch.updated_at ?? new Date().toISOString(),
  };

  if (patch.tx_hash && !patch.explorer_url) {
    update.explorer_url = buildExplorerTxUrl(patch.tx_hash);
  }

  const { error } = await supabaseAdmin
    .from('transactions')
    .update(update)
    .eq('id', transactionId);

  if (error) {
    const message = error.message ?? '';
    const missingColumn = /column.*does not exist/i.test(message);
    if (missingColumn) {
      const minimal: Record<string, unknown> = {
        status: patch.status,
        updated_at: update.updated_at,
      };
      if (patch.tx_hash !== undefined) minimal.tx_hash = patch.tx_hash;
      if (patch.failure_reason !== undefined) minimal.failure_reason = patch.failure_reason;
      if (patch.gas_fee_mockusd !== undefined) minimal.gas_fee_mockusd = patch.gas_fee_mockusd;

      const { error: retryError } = await supabaseAdmin
        .from('transactions')
        .update(minimal)
        .eq('id', transactionId);

      if (retryError) {
        logger.warn('Failed to patch transaction row (retry)', {
          transactionId,
          error: retryError.message,
        });
        throw new Error(retryError.message);
      }
      logger.warn('Transaction patch used minimal columns — run migration 002_transaction_lifecycle.sql', {
        transactionId,
      });
      return;
    }

    logger.warn('Failed to patch transaction row', { transactionId, error: message });
    throw new Error(message);
  }
}

export async function publishTransactionStatus(transactionId: string): Promise<TransactionStatusPayload | null> {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const payload = rowToPayload(data as Record<string, unknown>);
  emitTransactionStatus({
    transactionId,
    payload,
    at: new Date().toISOString(),
  });
  return payload;
}

export async function updateTransactionLifecycle(
  transactionId: string,
  patch: TransactionRowPatch
): Promise<TransactionStatusPayload | null> {
  await patchTransactionRow(transactionId, patch);
  return publishTransactionStatus(transactionId);
}

export async function getTransactionStatusForUser(
  transactionId: string,
  userId: string
): Promise<TransactionStatusPayload | null> {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  return rowToPayload(data as Record<string, unknown>);
}

export async function assertTransactionOwner(
  transactionId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return !!data;
}
