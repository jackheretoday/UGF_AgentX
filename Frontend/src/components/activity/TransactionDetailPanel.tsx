import React, { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Hash,
  Fuel,
  AlertCircle,
  Award,
  Link2,
} from 'lucide-react';
import type { ActivityRecord } from '../../lib/activityRecords';
import { buildBasescanTxUrl } from '../../lib/activityLabels';
import { cn, formatCurrency } from '../../lib/utils';
import { getTransactionKindMeta, resolveTransactionKind } from '../wallet/transactionIcons';
import { showToast } from '../../lib/toast';

function DetailRow({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#52525B]">{label}</span>
      {children ?? (
        <span
          className={cn(
            'text-sm text-[#E4E4E7] break-all',
            mono && 'font-mono text-xs text-[#A1A1AA]'
          )}
        >
          {value || '—'}
        </span>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        showToast(`${label} copied`);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded-lg border border-[#2D2D35] hover:bg-[#1C1C22] text-[#71717A] hover:text-white transition-colors shrink-0"
      title={`Copy ${label}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function TransactionDetailPanel({ record }: { record: ActivityRecord }) {
  const kind = resolveTransactionKind(record);
  const { Icon, accent, iconColor } = getTransactionKindMeta(kind);
  const explorerUrl =
    record.explorerUrl ?? buildBasescanTxUrl(record.receipt?.txHash ?? record.steps[0]?.txHash);

  const statusLabel =
    record.status === 'completed'
      ? 'Confirmed'
      : record.status === 'failed'
        ? 'Failed'
        : 'In progress';

  const statusClass =
    record.status === 'completed'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : record.status === 'failed'
        ? 'bg-red-500/10 text-red-400 border-red-500/30'
        : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

  const txHash = record.receipt?.txHash ?? record.steps[0]?.txHash;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-6 border-b border-[#1F1F23] shrink-0">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-xl border flex items-center justify-center shrink-0',
              accent
            )}
          >
            <Icon className={cn('w-6 h-6', iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white tracking-tight">{record.displayTitle}</h2>
            <p className="text-xs text-[#71717A] mt-1">{record.displaySubtitle}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border',
                  statusClass
                )}
              >
                {statusLabel}
              </span>
              <span className="text-[10px] text-[#52525B] font-mono">{record.actionType}</span>
            </div>
          </div>
        </div>

        {explorerUrl && txHash ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View on Base Sepolia Basescan
          </a>
        ) : (
          <p className="mt-4 text-xs text-[#52525B] text-center">
            Transaction hash not available yet — check back after confirmation.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailRow
            label="Created"
            value={new Date(record.createdAt).toLocaleString()}
          />
          <DetailRow
            label="Confirmed"
            value={record.confirmedAt ? new Date(record.confirmedAt).toLocaleString() : null}
          />
          <DetailRow label="Network" value={record.network} />
          <DetailRow label="Current step" value={record.currentStep} />
        </section>

        {record.failureReason ? (
          <section className="p-4 rounded-xl border border-red-500/25 bg-red-500/5 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">
                Failure reason
              </p>
              <p className="text-xs text-[#FCA5A5] break-words whitespace-pre-wrap">
                {record.failureReason}
              </p>
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#52525B] flex items-center gap-2">
            <Fuel className="w-3.5 h-3.5" />
            Gas & payment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#13131A] border border-[#1F1F23]">
            <DetailRow
              label="Gas fee (TYI Mock USD)"
              value={
                record.gasFeeUsd != null ? `${formatCurrency(record.gasFeeUsd)} mock` : null
              }
            />
            <DetailRow label="Payment coin" value={record.paymentCoin ?? 'TYI_USD'} />
            <DetailRow label="Sponsor" value={record.sponsorStatus} />
            <DetailRow
              label="Execution time"
              value={
                record.executionTimeMs != null
                  ? `${(record.executionTimeMs / 1000).toFixed(1)}s`
                  : null
              }
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#52525B] flex items-center gap-2">
            <Hash className="w-3.5 h-3.5" />
            On-chain identifiers
          </h3>
          <div className="space-y-4 p-4 rounded-xl bg-[#13131A] border border-[#1F1F23]">
            {txHash ? (
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#52525B]">
                  Transaction hash
                </span>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs text-blue-400 break-all flex-1">{txHash}</span>
                  <CopyButton text={txHash} label="Transaction hash" />
                </div>
              </div>
            ) : (
              <DetailRow label="Transaction hash" value={null} />
            )}

            {record.blockNumber != null ? (
              <DetailRow label="Block number" value={String(record.blockNumber)} mono />
            ) : null}

            {record.contractAddress ? (
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#52525B]">
                  Contract
                </span>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs text-[#A1A1AA] break-all flex-1">
                    {record.contractAddress}
                  </span>
                  <CopyButton text={record.contractAddress} label="Contract address" />
                </div>
              </div>
            ) : null}

            {record.ugfDigest ? (
              <DetailRow label="UGF quote / digest" value={record.ugfDigest} mono />
            ) : null}

            <DetailRow label="Activity ID" value={record.id} mono />
          </div>
        </section>

        {record.badge ? (
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#52525B] flex items-center gap-2">
              <Award className="w-3.5 h-3.5" />
              Certificate / badge
            </h3>
            <div className="p-4 rounded-xl bg-[#13131A] border border-[#1F1F23] flex gap-4">
              {record.badge.imageUrl ? (
                <img
                  src={record.badge.imageUrl}
                  alt={record.badge.badgeName}
                  className="w-20 h-20 rounded-xl object-cover border border-[#2D2D35] shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-[#1F1F23] border border-[#2D2D35] flex items-center justify-center shrink-0">
                  <Award className="w-8 h-8 text-violet-400/60" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <DetailRow label="Badge name" value={record.badge.badgeName} />
                {record.badge.recipientName ? (
                  <DetailRow label="Recipient" value={record.badge.recipientName} />
                ) : null}
                {record.badge.metadataUri ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#52525B]">
                      Metadata URI
                    </span>
                    <a
                      href={record.badge.metadataUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline break-all flex items-center gap-1"
                    >
                      <Link2 className="w-3 h-3 shrink-0" />
                      {record.badge.metadataUri}
                    </a>
                  </div>
                ) : null}
                {record.badge.mintedAt ? (
                  <DetailRow
                    label="Minted at"
                    value={new Date(record.badge.mintedAt).toLocaleString()}
                  />
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
