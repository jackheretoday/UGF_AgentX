import type { TransactionState, TransactionStep } from '../types';

export type DbTransaction = {
  id: string;
  action_type: string;
  status: string;
  tx_hash?: string | null;
  gas_fee_mockusd?: number | null;
  network?: string | null;
  created_at: string;
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

function mapStepStatus(txStatus: TransactionState['status']): TransactionStep['status'] {
  if (txStatus === 'completed') return 'completed';
  if (txStatus === 'failed') return 'error';
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
  const stepStatus = mapStepStatus(status);

  return {
    id: row.id,
    type: formatActionLabel(row.action_type),
    intent: row.action_type,
    status,
    timestamp: new Date(row.created_at).getTime(),
    steps: [
      {
        id: 'record',
        label: row.network ? `Recorded on ${row.network}` : 'Transaction recorded',
        status: stepStatus,
        txHash: row.tx_hash ?? undefined,
      },
    ],
    gasEstimate:
      row.gas_fee_mockusd != null
        ? { mockUSD: Number(row.gas_fee_mockusd), currency: 'Mock USD' }
        : null,
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
