import React from 'react';
import { motion } from 'motion/react';
import { Cpu, User, ExternalLink, Zap } from 'lucide-react';
import { Message } from '../../types';
import { cn } from '../../lib/utils';

interface ChatBubbleProps {
  message: Message;
}

// ─── Simple inline markdown renderer (bold + newlines) ───────────────────────

function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\n)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part === '\n') return <br key={i} />;
    return <span key={i}>{part}</span>;
  });
}

// ─── Transaction Receipt Card ─────────────────────────────────────────────────

function TransactionReceiptCard({ tx }: { tx: NonNullable<Message['transaction']> }) {
  const short = (hash: string) => hash.slice(0, 10) + '...' + hash.slice(-6);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-950/30 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-emerald-500/10 bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            Transaction Confirmed
          </span>
        </div>
        <span className="text-[10px] text-emerald-600 font-mono">{tx.network}</span>
      </div>

      {/* Fields */}
      <div className="px-4 py-3 space-y-2">
        <Row label="NFT" value={tx.nftName} mono={false} />
        <Row label="Tx Hash" value={short(tx.txHash)} mono action={
          <button className="text-[#52525B] hover:text-white transition-colors">
            <ExternalLink className="w-3 h-3" />
          </button>
        } />
        <Row label="Block" value={`#${tx.blockNumber.toLocaleString()}`} mono />
        <Row label="Gas Used" value={`${tx.gasUsed} ETH`} mono />
        <div className="flex items-center justify-between pt-1 border-t border-emerald-500/10 mt-2">
          <span className="text-[10px] text-[#71717A] uppercase tracking-widest font-semibold">Gas Paid With</span>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-300">${tx.mockUsdCost} Mock USD</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Row({
  label,
  value,
  mono = true,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-[#71717A] uppercase tracking-widest font-semibold shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            'text-xs text-[#A1A1AA] truncate',
            mono && 'font-mono'
          )}
        >
          {value}
        </span>
        {action}
      </div>
    </div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex items-start gap-3 w-full"
    >
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-violet-700 flex items-center justify-center shrink-0 mt-0.5">
        <Cpu className="w-3.5 h-3.5 text-white" />
      </div>

      <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-[#1C1C22] border border-[#2A2A32] flex items-center gap-1.5 h-10">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#52525B]"
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main ChatBubble ──────────────────────────────────────────────────────────

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('flex w-full gap-3', isAssistant ? 'items-start' : 'justify-end items-start')}
    >
      {/* Assistant avatar */}
      {isAssistant && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-violet-700 flex items-center justify-center shrink-0 mt-0.5">
          <Cpu className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      <div className={cn('flex flex-col gap-1', isAssistant ? 'max-w-[78%]' : 'items-end max-w-[72%]')}>
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isAssistant
              ? 'bg-[#1C1C22] border border-[#2A2A32] text-[#D4D4D8] rounded-tl-none'
              : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none shadow-lg shadow-blue-900/30'
          )}
        >
          <p>{renderContent(message.content)}</p>

          {/* Embedded transaction receipt */}
          {message.transaction && (
            <TransactionReceiptCard tx={message.transaction} />
          )}
        </div>

        <span className="text-[10px] text-[#3F3F46] font-bold uppercase tracking-widest px-1">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* User avatar */}
      {!isAssistant && (
        <div className="w-7 h-7 rounded-full bg-[#1F1F23] border border-[#2A2A32] flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-[#71717A]" />
        </div>
      )}
    </motion.div>
  );
};
