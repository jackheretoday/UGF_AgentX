import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Loader2, Circle, AlertCircle, ExternalLink, Copy, Check } from 'lucide-react';
import { TransactionState, TransactionStep } from '../../types';
import { cn } from '../../lib/utils';
import { showToast } from '../../lib/toast';

interface TransactionTimelineProps {
  transaction: TransactionState;
}

function StepIcon({ status, index }: { status: TransactionStep['status']; index: number }) {
  if (status === 'completed') {
    return (
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      </motion.div>
    );
  }
  if (status === 'active') {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/50 flex items-center justify-center">
        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/40 flex items-center justify-center">
        <AlertCircle className="w-4 h-4 text-red-400" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full border border-[#2A2A32] flex items-center justify-center text-[#52525B] text-[11px] font-bold">
      {index + 1}
    </div>
  );
}

function ConnectorLine({ completed }: { completed: boolean }) {
  return (
    <div className="absolute left-[15px] top-8 bottom-[-24px] w-[1px] bg-[#2A2A32] overflow-hidden">
      <AnimatePresence>
        {completed && (
          <motion.div
            className="absolute top-0 left-0 w-full bg-emerald-500/40"
            initial={{ height: 0 }}
            animate={{ height: '100%' }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StepRow({
  step,
  index,
  isLast,
  explorerUrl,
}: {
  step: TransactionStep;
  index: number;
  isLast: boolean;
  explorerUrl?: string;
}) {
  const isActive = step.status === 'active';
  const isCompleted = step.status === 'completed';
  const isError = step.status === 'error';
  const txHash = step.txHash;
  const hashLink = txHash && explorerUrl ? explorerUrl : txHash && /^0x[a-fA-F0-9]{64}$/u.test(txHash) ? undefined : null;

  return (
    <div className="relative flex gap-4">
      {!isLast && <ConnectorLine completed={isCompleted} />}

      <StepIcon status={step.status} index={index} />

      <div className="flex-1 pb-6 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'text-xs font-semibold transition-colors duration-300',
              isCompleted
                ? 'text-[#E4E4E7]'
                : isActive
                  ? 'text-blue-300'
                  : isError
                    ? 'text-red-400'
                    : 'text-[#52525B]'
            )}
          >
            {step.label}
          </p>
          {txHash && /^0x[a-fA-F0-9]{64}$/u.test(txHash) && (explorerUrl || hashLink) ? (
            <a
              href={explorerUrl ?? hashLink!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#52525B] hover:text-white transition-colors shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : null}
        </div>

        <p
          className={cn(
            'text-[10px] mt-0.5 transition-colors duration-300',
            isActive ? 'text-blue-500/70' : 'text-[#3F3F46]'
          )}
        >
          {isError
            ? step.detail ?? 'Step failed'
            : isCompleted
              ? 'Complete'
              : isActive
                ? step.detail ?? 'Processing...'
                : 'Awaiting...'}
        </p>

        {isActive && (
          <motion.div
            className="mt-2 h-0.5 rounded-full bg-gradient-to-r from-blue-600/0 via-blue-400 to-blue-600/0"
            animate={{ opacity: [0.4, 1, 0.4], scaleX: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
          />
        )}
      </div>
    </div>
  );
}

export const TransactionTimeline = ({ transaction }: TransactionTimelineProps) => {
  const allCompleted = transaction.status === 'completed';
  const hasFailed = transaction.status === 'failed';
  const isProcessing = !allCompleted && !hasFailed;

  const badgeColor = allCompleted
    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    : hasFailed
      ? 'bg-red-500/10 border-red-500/20 text-red-400'
      : 'bg-blue-500/10 border-blue-500/20 text-blue-400';

  const badgeLabel = allCompleted ? 'CONFIRMED' : hasFailed ? 'FAILED' : 'PROCESSING';
  const explorerUrl = transaction.receipt?.explorerUrl;
  const txHash = transaction.receipt?.txHash;

  const copyHash = async () => {
    if (!txHash) return;
    try {
      await navigator.clipboard.writeText(txHash);
      showToast('Tx hash copied');
    } catch {
      showToast('Copy failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-[#0F0F12] border border-[#1F1F23] rounded-xl overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-[#1F1F23] bg-[#13131A] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isProcessing && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          )}
          <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">
            {transaction.type}
          </h3>
        </div>
        <div
          className={cn(
            'px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest',
            badgeColor
          )}
        >
          {badgeLabel}
        </div>
      </div>

      {transaction.failureReason && transaction.status === 'failed' ? (
        <div className="px-5 py-2 border-b border-red-500/20 bg-red-950/40 text-[11px] text-red-300 leading-relaxed">
          {transaction.failureReason}
        </div>
      ) : null}

      {transaction.gasEstimate ? (
        <div className="px-5 py-2 border-b border-[#1F1F23] bg-[#0F0F12]/80 text-[10px] text-[#71717A] flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Gas:{' '}
            <span className="text-yellow-300/90 font-semibold">
              ${transaction.gasEstimate.mockUSD} {transaction.gasEstimate.currency ?? 'Mock USD'}
            </span>
          </span>
          {transaction.gasEstimate.chainName ? (
            <span>Chain: {transaction.gasEstimate.chainName}</span>
          ) : null}
          {transaction.gasEstimate.paymentCoin ? (
            <span>Coin: {transaction.gasEstimate.paymentCoin}</span>
          ) : null}
          {transaction.gasEstimate.sponsorStatus ? (
            <span>Sponsor: {transaction.gasEstimate.sponsorStatus}</span>
          ) : null}
        </div>
      ) : null}

      <div className="px-5 pt-5 pb-2">
        {transaction.steps.map((step, i) => (
          <div key={step.id}>
            <StepRow
              step={step}
              index={i}
              isLast={i === transaction.steps.length - 1}
              explorerUrl={explorerUrl}
            />
          </div>
        ))}
      </div>

      {txHash && /^0x[a-fA-F0-9]{64}$/u.test(txHash) ? (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg px-2.5 py-1 inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              View on Explorer
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void copyHash()}
            className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] hover:text-white border border-[#2A2A32] rounded-lg px-2.5 py-1 inline-flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            Copy Hash
          </button>
        </div>
      ) : null}

      <div className="px-5 pb-4">
        <div className="flex items-center justify-between text-[10px] text-[#3F3F46] font-mono pt-3 border-t border-[#1F1F23]">
          <span>{transaction.gasEstimate?.chainName ?? 'Base Sepolia'}</span>
          <span>
            {new Date(transaction.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
