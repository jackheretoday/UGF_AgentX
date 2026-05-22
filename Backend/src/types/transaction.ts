export type TransactionLifecycleStatus =
  | 'pending'
  | 'quoted'
  | 'awaiting_settlement'
  | 'settling'
  | 'executing'
  | 'mining'
  | 'confirmed'
  | 'failed';

export type TransactionTimelineStepId =
  | 'pending'
  | 'quote'
  | 'settle'
  | 'execute'
  | 'mining'
  | 'confirm'
  | 'save';

export const LIFECYCLE_TO_TIMELINE_STEP: Record<TransactionLifecycleStatus, TransactionTimelineStepId> = {
  pending: 'pending',
  quoted: 'quote',
  awaiting_settlement: 'settle',
  settling: 'settle',
  executing: 'execute',
  mining: 'mining',
  confirmed: 'confirm',
  failed: 'quote',
};

export const TIMELINE_STEP_ORDER: TransactionTimelineStepId[] = [
  'pending',
  'quote',
  'settle',
  'execute',
  'mining',
  'confirm',
  'save',
];

export interface TransactionStatusPayload {
  id: string;
  status: TransactionLifecycleStatus;
  txHash: string | null;
  explorerUrl: string | null;
  blockNumber: number | null;
  gasFee: number | null;
  gasUsed: number | null;
  gasPrice: number | null;
  confirmedAt: string | null;
  currentStep: string | null;
  failureReason: string | null;
  network: string;
  paymentCoin: string | null;
  sponsorStatus: string | null;
  chainName: string;
  ugfDigest: string | null;
  executionTimeMs: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface TransactionStatusEvent {
  transactionId: string;
  payload: TransactionStatusPayload;
  at: string;
}
