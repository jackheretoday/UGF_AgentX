import {
  Award,
  ScrollText,
  Heart,
  Gift,
  ArrowLeftRight,
  CircleDot,
  type LucideIcon,
} from 'lucide-react';
import type { TransactionState } from '../../types';

export type TransactionKind =
  | 'mint_badge'
  | 'claim_cert'
  | 'donate'
  | 'send_reward'
  | 'swap'
  | 'unknown';

const KIND_META: Record<
  TransactionKind,
  { Icon: LucideIcon; accent: string; iconColor: string }
> = {
  mint_badge: {
    Icon: Award,
    accent: 'border-violet-500/25 bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/15',
    iconColor: 'text-violet-400',
  },
  claim_cert: {
    Icon: ScrollText,
    accent: 'border-sky-500/25 bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/15',
    iconColor: 'text-sky-400',
  },
  donate: {
    Icon: Heart,
    accent: 'border-rose-500/25 bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/15',
    iconColor: 'text-rose-400',
  },
  send_reward: {
    Icon: Gift,
    accent: 'border-amber-500/25 bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/15',
    iconColor: 'text-amber-400',
  },
  swap: {
    Icon: ArrowLeftRight,
    accent: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/15',
    iconColor: 'text-cyan-400',
  },
  unknown: {
    Icon: CircleDot,
    accent: 'border-[#2D2D35] bg-[#1F1F23] text-[#A1A1AA] group-hover:bg-[#2D2D35]',
    iconColor: 'text-[#A1A1AA]',
  },
};

const ACTION_TYPE_KIND: Record<string, TransactionKind> = {
  claim_cert: 'claim_cert',
  mint_badge: 'mint_badge',
  donate: 'donate',
  send_reward: 'send_reward',
};

export function resolveTransactionKind(tx: TransactionState): TransactionKind {
  const intent = tx.intent?.toLowerCase().trim().replace(/\s+/g, '_');
  if (intent && intent in KIND_META) {
    return intent as TransactionKind;
  }
  if (intent && ACTION_TYPE_KIND[intent]) {
    return ACTION_TYPE_KIND[intent];
  }

  const type = tx.type.toUpperCase();
  if (type.includes('MINT') && type.includes('BADGE')) return 'mint_badge';
  if (type.includes('CLAIM') || type.includes('CERT')) return 'claim_cert';
  if (type.includes('DONATE')) return 'donate';
  if (type.includes('REWARD')) return 'send_reward';
  if (type.includes('SWAP')) return 'swap';
  if (type.startsWith('MINT')) return 'mint_badge';

  return 'unknown';
}

export function getTransactionKindMeta(kind: TransactionKind) {
  return KIND_META[kind] ?? KIND_META.unknown;
}
