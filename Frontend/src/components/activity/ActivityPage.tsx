import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Loader2, ScrollText, RefreshCw } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { getTransactionKindMeta, resolveTransactionKind } from '../wallet/transactionIcons';
import { TransactionDetailPanel } from './TransactionDetailPanel';
import type { ActivityRecord } from '../../lib/activityRecords';

function ActivityListItem({
  record,
  selected,
  onClick,
}: {
  record: ActivityRecord;
  selected: boolean;
  onClick: () => void;
}) {
  const kind = resolveTransactionKind(record);
  const { Icon, accent, iconColor } = getTransactionKindMeta(kind);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all',
        selected
          ? 'bg-[#1C1C22] border-blue-500/40 shadow-lg shadow-blue-500/5'
          : 'bg-[#13131A] border-[#1F1F23] hover:border-[#3A3A44] hover:bg-[#1C1C22]'
      )}
    >
      <div className="flex gap-3 items-start">
        <div
          className={cn(
            'w-10 h-10 rounded-lg border flex items-center justify-center shrink-0',
            record.status === 'failed'
              ? 'bg-red-500/5 border-red-500/20'
              : record.status === 'completed'
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : accent
          )}
        >
          <Icon
            className={cn(
              'w-5 h-5',
              record.status === 'failed'
                ? 'text-red-400'
                : record.status === 'completed'
                  ? 'text-emerald-400'
                  : iconColor
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{record.displayTitle}</div>
          <div className="text-[11px] text-[#71717A] mt-0.5">
            {new Date(record.createdAt).toLocaleString()}
          </div>
          <div className="text-[10px] text-[#52525B] mt-1 uppercase font-bold tracking-wider">
            {record.status}
            {record.receipt?.txHash ? ' • Has tx' : ''}
          </div>
        </div>
      </div>
    </button>
  );
}

export function ActivityPage() {
  const {
    activityRecords,
    selectedActivityId,
    activityLoading,
    loadActivityRecords,
    selectActivity,
    setMainView,
    refreshSelectedActivity,
  } = useStore();

  const selected = activityRecords.find((r) => r.id === selectedActivityId) ?? null;

  useEffect(() => {
    void loadActivityRecords();
  }, [loadActivityRecords]);

  useEffect(() => {
    if (selectedActivityId) {
      void refreshSelectedActivity();
    }
  }, [selectedActivityId, refreshSelectedActivity]);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#050505]">
      <header className="shrink-0 px-6 py-4 border-b border-[#1F1F23] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMainView('chat')}
            className="lg:hidden p-2 rounded-lg border border-[#2D2D35] hover:bg-[#1C1C22] text-[#A1A1AA]"
            aria-label="Back to chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-sky-400 shrink-0" />
              My certificates & activity
            </h1>
            <p className="text-xs text-[#71717A] mt-0.5">
              Claim certificate, mint badge, donations — tap any item for full details
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadActivityRecords()}
          disabled={activityLoading}
          className="shrink-0 flex items-center gap-2 px-3 h-9 rounded-lg border border-[#2D2D35] hover:bg-[#1C1C22] text-xs font-bold text-[#A1A1AA] hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', activityLoading && 'animate-spin')} />
          Refresh
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        <div
          className={cn(
            'w-full lg:w-[380px] shrink-0 border-r border-[#1F1F23] flex flex-col min-h-0',
            selected && 'hidden lg:flex'
          )}
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            {activityLoading && activityRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#52525B]">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-xs">Loading activity…</p>
              </div>
            ) : activityRecords.length === 0 ? (
              <div className="text-center py-16 px-4">
                <p className="text-sm text-[#71717A]">No on-chain activity yet.</p>
                <p className="text-xs text-[#52525B] mt-2">
                  Try &quot;Claim certificate&quot; or &quot;Mint badge&quot; in chat.
                </p>
                <button
                  type="button"
                  onClick={() => setMainView('chat')}
                  className="mt-4 text-xs font-bold text-blue-400 hover:text-blue-300"
                >
                  Go to chat →
                </button>
              </div>
            ) : (
              activityRecords.map((record) => (
                <ActivityListItem
                  key={record.id}
                  record={record}
                  selected={record.id === selectedActivityId}
                  onClick={() => selectActivity(record.id)}
                />
              ))
            )}
          </div>
        </div>

        <div
          className={cn(
            'flex-1 min-w-0 flex flex-col min-h-0 bg-[#0A0A0B]',
            !selected && 'hidden lg:flex'
          )}
        >
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full min-h-0"
              >
                <div className="lg:hidden shrink-0 px-4 py-3 border-b border-[#1F1F23]">
                  <button
                    type="button"
                    onClick={() => selectActivity(null)}
                    className="flex items-center gap-2 text-xs font-bold text-[#A1A1AA] hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    All activity
                  </button>
                </div>
                <TransactionDetailPanel record={selected} />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              >
                <ScrollText className="w-12 h-12 text-[#3F3F46] mb-4" />
                <p className="text-sm text-[#71717A] max-w-sm">
                  Select a certificate or transaction from the list to view Basescan link, gas
                  fees, badge metadata, and more.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
