import type { TransactionStatusDto } from './api';
import type { TransactionState, TransactionStep } from '../types';

const STEP_ORDER = ['pending', 'quote', 'settle', 'execute', 'mining', 'confirm', 'save'] as const;

const STEP_LABELS: Record<string, string> = {
  pending: 'Initializing transaction',
  quote: 'Getting UGF gas quote',
  settle: 'Settling Mock USD payment',
  execute: 'Executing on Base Sepolia',
  mining: 'Mining on Base Sepolia',
  confirm: 'Verifying receipt',
  save: 'Saving to gallery',
};

function lifecycleIndex(step: string): number {
  const idx = STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number]);
  return idx >= 0 ? idx : 0;
}

export function buildStepsFromStatus(
  templateSteps: TransactionStep[],
  status: TransactionStatusDto
): TransactionStep[] {
  const current =
    status.status === 'awaiting_settlement' ? 'settle' : status.currentStep || status.status;
  const currentIdx = lifecycleIndex(current);
  const failed = status.status === 'failed';
  const confirmed = status.status === 'confirmed';

  const templateIds = templateSteps.length > 0
    ? templateSteps.map((s) => s.id)
    : [...STEP_ORDER];

  const failedStepId =
    failed &&
    STEP_ORDER.includes(current as (typeof STEP_ORDER)[number])
      ? current
      : failed
        ? status.currentStep && STEP_ORDER.includes(status.currentStep as (typeof STEP_ORDER)[number])
          ? status.currentStep
          : 'pending'
        : current;

  const failedIdx = failed ? lifecycleIndex(failedStepId) : currentIdx;

  return templateIds.map((id) => {
    const idx = lifecycleIndex(id);
    let stepStatus: TransactionStep['status'] = 'pending';

    if (failed && id === failedStepId) {
      stepStatus = 'error';
    } else if (failed && idx < failedIdx) {
      stepStatus = 'completed';
    } else if (confirmed) {
      stepStatus = 'completed';
    } else if (idx < currentIdx) {
      stepStatus = 'completed';
    } else if (idx === currentIdx) {
      stepStatus = 'active';
    }

    return {
      id,
      label: templateSteps.find((t) => t.id === id)?.label ?? STEP_LABELS[id] ?? id,
      status: stepStatus,
      txHash: status.txHash ?? undefined,
      detail:
        stepStatus === 'error'
          ? status.failureReason ?? 'Failed'
          : stepStatus === 'active'
            ? status.status
            : stepStatus === 'completed'
              ? 'Verified'
              : 'Awaiting...',
    };
  });
}

export function mapStatusToTransactionState(
  base: TransactionState,
  status: TransactionStatusDto
): TransactionState {
  const txStatus: TransactionState['status'] =
    status.status === 'confirmed'
      ? 'completed'
      : status.status === 'failed'
        ? 'failed'
        : 'active';

  return {
    ...base,
    id: status.id,
    status: txStatus,
    failureReason: status.failureReason,
    steps: buildStepsFromStatus(base.steps, status),
    gasEstimate: status.gasFee != null
      ? {
          mockUSD: status.gasFee,
          currency: 'Mock USD',
          breakdown: 'Live UGF quote',
          chainName: status.chainName,
          paymentCoin: status.paymentCoin ?? 'TYI_USD',
          sponsorStatus: status.sponsorStatus ?? undefined,
        }
      : base.gasEstimate,
    receipt: status.txHash
      ? {
          txHash: status.txHash,
          explorerUrl: status.explorerUrl ?? '',
          gasUsed: status.gasUsed != null ? String(status.gasUsed) : '',
          mockUsdCost: status.gasFee != null ? String(status.gasFee) : '',
          blockNumber: status.blockNumber ?? 0,
          network: status.network,
          confirmedAt: status.confirmedAt ?? undefined,
          failureReason: status.failureReason ?? undefined,
        }
      : undefined,
  };
}
