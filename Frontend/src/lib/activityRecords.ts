import type { TransactionState } from '../types';
import type { DbTransactionRow } from './api';
import { buildBasescanTxUrl, getActivityDisplay } from './activityLabels';

export type MintedBadgeRow = {
  id: string;
  transaction_id?: string | null;
  badge_name?: string | null;
  recipient_name?: string | null;
  metadata_uri?: string | null;
  image_url?: string | null;
  tx_hash?: string | null;
  minted_at?: string | null;
};

export type ActivityBadge = {
  id: string;
  badgeName: string;
  recipientName: string | null;
  metadataUri: string | null;
  imageUrl: string | null;
  mintedAt: string | null;
};

export type ActivityRecord = TransactionState & {
  actionType: string;
  displayTitle: string;
  displaySubtitle: string;
  explorerUrl: string | null;
  contractAddress: string | null;
  blockNumber: number | null;
  gasFeeUsd: number | null;
  gasUsed: number | null;
  network: string;
  currentStep: string | null;
  ugfDigest: string | null;
  paymentCoin: string | null;
  sponsorStatus: string | null;
  executionTimeMs: number | null;
  createdAt: string;
  confirmedAt: string | null;
  badge: ActivityBadge | null;
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

function badgeFromRow(row: MintedBadgeRow | undefined): ActivityBadge | null {
  if (!row?.id) return null;
  return {
    id: row.id,
    badgeName: row.badge_name ?? 'UGF AgentX Badge',
    recipientName: row.recipient_name ?? null,
    metadataUri: row.metadata_uri ?? null,
    imageUrl: row.image_url ?? null,
    mintedAt: row.minted_at ?? null,
  };
}

export function mapDbRowToActivityRecord(
  row: DbTransactionRow,
  badge?: MintedBadgeRow
): ActivityRecord {
  const status = mapDbStatus(row.status);
  const { title, subtitle } = getActivityDisplay(row.action_type);
  const txHash = row.tx_hash ?? badge?.tx_hash ?? null;
  const explorerUrl = row.explorer_url ?? buildBasescanTxUrl(txHash);

  const stepStatus: ActivityRecord['steps'][0]['status'] =
    status === 'completed' ? 'completed' : status === 'failed' ? 'error' : 'active';

  return {
    id: row.id,
    type: title,
    intent: row.action_type,
    actionType: row.action_type,
    displayTitle: title,
    displaySubtitle: subtitle,
    status,
    timestamp: new Date(row.created_at).getTime(),
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at ?? null,
    explorerUrl,
    contractAddress: row.contract_address ?? null,
    blockNumber: row.block_number != null ? Number(row.block_number) : null,
    gasFeeUsd: row.gas_fee_mockusd != null ? Number(row.gas_fee_mockusd) : null,
    gasUsed: row.gas_used != null ? Number(row.gas_used) : null,
    network: row.network ?? 'Base Sepolia',
    currentStep: row.current_step ?? null,
    failureReason: row.failure_reason ?? null,
    ugfDigest: row.ugf_digest ?? row.ugf_quote_id ?? null,
    paymentCoin: row.payment_coin ?? 'TYI_USD',
    sponsorStatus: row.sponsor_status ?? null,
    executionTimeMs: row.execution_time_ms != null ? Number(row.execution_time_ms) : null,
    steps: [
      {
        id: 'confirm',
        label: row.network ? `On ${row.network}` : 'On-chain',
        status: stepStatus,
        txHash: txHash ?? undefined,
        detail: row.failure_reason ?? row.current_step ?? undefined,
      },
    ],
    gasEstimate:
      row.gas_fee_mockusd != null
        ? {
            mockUSD: Number(row.gas_fee_mockusd),
            currency: 'TYI Mock USD',
            chainName: row.network ?? 'Base Sepolia',
            paymentCoin: 'TYI_USD',
          }
        : null,
    receipt: txHash
      ? {
          txHash,
          explorerUrl: explorerUrl ?? '',
          gasUsed: row.gas_used != null ? String(row.gas_used) : '',
          mockUsdCost: row.gas_fee_mockusd != null ? String(row.gas_fee_mockusd) : '',
          blockNumber: row.block_number != null ? Number(row.block_number) : null,
          network: row.network ?? 'Base Sepolia',
          confirmedAt: row.confirmed_at ?? undefined,
          failureReason: row.failure_reason ?? undefined,
          nftName: badge?.badge_name ?? undefined,
        }
      : undefined,
    badge: badgeFromRow(badge),
  };
}

export function mergeTransactionsWithBadges(
  transactions: DbTransactionRow[],
  badges: MintedBadgeRow[]
): ActivityRecord[] {
  const badgeByTx = new Map<string, MintedBadgeRow>();
  for (const b of badges) {
    if (b.transaction_id) {
      badgeByTx.set(b.transaction_id, b);
    }
  }

  return transactions.map((row) => mapDbRowToActivityRecord(row, badgeByTx.get(row.id)));
}
