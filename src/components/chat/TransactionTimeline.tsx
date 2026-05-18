import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Loader2, Circle, AlertCircle, ExternalLink } from 'lucide-react';
import { TransactionState, TransactionStep } from '../../types';
import { cn } from '../../lib/utils';

interface TransactionTimelineProps {
  transaction: TransactionState;
}

// ─── Step Icon ────────────────────────────────────────────────────────────────

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
  // pending
  return (
    <div className="w-8 h-8 rounded-full border border-[#2A2A32] flex items-center justify-center text-[#52525B] text-[11px] font-bold">
      {index + 1}
    </div>
  );
}

// ─── Connector Line ───────────────────────────────────────────────────────────

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

// ─── Step Row ─────────────────────────────────────────────────────────────────

function StepRow({
  step,
  index,
  isLast,
}: {
  step: TransactionStep;
  index: number;
  isLast: boolean;
}) {
  const isActive = step.status === 'active';
  const isCompleted = step.status === 'completed';
  const isError = step.status === 'error';

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
          {step.txHash && (
            <button className="text-[#52525B] hover:text-white transition-colors shrink-0">
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        <p
          className={cn(
            'text-[10px] mt-0.5 transition-colors duration-300',
            isActive ? 'text-blue-500/70' : 'text-[#3F3F46]'
          )}
        >
          {isCompleted
            ? 'Verified on-chain ✓'
            : isActive
            ? step.detail ?? 'Processing...'
            : isError
            ? 'Step failed'
            : 'Awaiting...' }
        </p>

        {/* Active pulsing bar */}
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

// ─── Transaction Timeline Card ────────────────────────────────────────────────

export const TransactionTimeline = ({ transaction }: TransactionTimelineProps) => {
  const allCompleted = transaction.steps.every((s) => s.status === 'completed');
  const hasFailed = transaction.steps.some((s) => s.status === 'error');

  const badgeColor = allCompleted
    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    : hasFailed
    ? 'bg-red-500/10 border-red-500/20 text-red-400'
    : 'bg-blue-500/10 border-blue-500/20 text-blue-400';

  const badgeLabel = allCompleted ? 'CONFIRMED' : hasFailed ? 'FAILED' : 'PROCESSING';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-[#0F0F12] border border-[#1F1F23] rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[#1F1F23] bg-[#13131A] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {!allCompleted && !hasFailed && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          )}
          <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">
            {transaction.type}
          </h3>
        </div>
        <div className={cn('px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest', badgeColor)}>
          {badgeLabel}
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 pt-5 pb-2">
        {transaction.steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            index={i}
            isLast={i === transaction.steps.length - 1}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between text-[10px] text-[#3F3F46] font-mono pt-3 border-t border-[#1F1F23]">
          <span>Base Sepolia Testnet</span>
          <span>{new Date(transaction.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </motion.div>
  );
};
