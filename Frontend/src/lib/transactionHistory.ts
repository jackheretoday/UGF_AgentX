import type { TransactionState, TransactionStep } from '../types';

export type DbTransaction = {
  id: string;
  action_type: string;
  status: string;
  tx_hash?: string | null;
  gas_fee_mockusd?: number | null;
  network?: string | null;
  created_at: string;
  confirmed_at?: string | null;
  explorer_url?: string | null;
  block_number?: number | null;
  current_step?: string | null;
  failure_reason?: string | null;
  gas_used?: number | null;
};

function mapDbStatus(status: string): TransactionState['status'] {
  const normalized = status.toLowerCase();
  if (['success', 'completed', 'confirmed'].includes(normalized)) {
    return 'completed';
  }
  if (['failed', 'error', 'reverted'].includes(normalized)) {
    return 'failed';
  }
  return 'active';
}

function formatActionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    mint_badge: 'MINT BADGE',
    claim_cert: 'CLAIM CERTIFICATE',
    donate: 'DONATE',
    send_reward: 'SEND REWARD',
  };
  return labels[actionType] ?? actionType.replace(/_/g, ' ').toUpperCase();
}

export function mapDbTransactionToState(row: DbTransaction): TransactionState {
  const status = mapDbStatus(row.status);
  const hasHash = row.tx_hash && /^0x[a-fA-F0-9]{64}$/u.test(row.tx_hash);

  const stepStatus: TransactionStep['status'] =
    status === 'completed' ? 'completed' : status === 'failed' ? 'error' : 'active';

  return {
    id: row.id,
    type: formatActionLabel(row.action_type),
    intent: row.action_type,
    status,
    timestamp: new Date(row.created_at).getTime(),
    steps: [
      {
        id: 'confirm',
        label: row.network ? `On ${row.network}` : 'On-chain status',
        status: stepStatus,
        txHash: hasHash ? row.tx_hash! : undefined,
        detail: row.failure_reason ?? row.current_step ?? undefined,
      },
    ],
    gasEstimate:
      row.gas_fee_mockusd != null
        ? { mockUSD: Number(row.gas_fee_mockusd), currency: 'Mock USD', chainName: row.network ?? 'Base Sepolia' }
        : null,
    receipt: hasHash
      ? {
          txHash: row.tx_hash!,
          explorerUrl: row.explorer_url ?? '',
          gasUsed: row.gas_used != null ? String(row.gas_used) : '',
          mockUsdCost:
            row.gas_fee_mockusd != null ? String(row.gas_fee_mockusd) : '',
          blockNumber: row.block_number != null ? Number(row.block_number) : 0,
          network: row.network ?? 'Base Sepolia',
          confirmedAt: row.confirmed_at ?? undefined,
          failureReason: row.failure_reason ?? undefined,
        }
      : undefined,
  };
}

export function mapDbTransactions(rows: unknown[]): TransactionState[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is DbTransaction => {
      return (
        row !== null &&
        typeof row === 'object' &&
        'id' in row &&
        'action_type' in row &&
        'created_at' in row
      );
    })
    .map(mapDbTransactionToState);
}
