import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useModal } from 'connectkit';
import { useAccount } from 'wagmi';
import { Check, Loader2, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn, formatCurrency } from '../../lib/utils';
import { getTransactionKindMeta, resolveTransactionKind } from './transactionIcons';
import type { TransactionState } from '../../types';

function TransactionHistoryItem({
  tx,
  onSelect,
}: {
  tx: TransactionState;
  onSelect: () => void;
}) {
  const kind = resolveTransactionKind(tx);
  const { Icon, accent, iconColor } = getTransactionKindMeta(kind);

  return (
    <div
      className="flex gap-3 items-start group cursor-pointer"
      onClick={onSelect}
    >
      <div className="relative shrink-0">
        <div
          className={cn(
            'w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
            tx.status === 'failed'
              ? 'bg-red-500/5 border-red-500/20'
              : tx.status === 'completed'
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : accent
          )}
        >
          <Icon
            className={cn(
              'w-4 h-4',
              tx.status === 'failed'
                ? 'text-red-400'
                : tx.status === 'completed'
                  ? 'text-emerald-400'
                  : iconColor
            )}
          />
        </div>
        {tx.status === 'completed' ? (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0F0F12] border border-emerald-500/40 flex items-center justify-center">
            <Check className="w-2 h-2 text-emerald-400" strokeWidth={3} />
          </span>
        ) : tx.status === 'failed' ? (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0F0F12] border border-red-500/40 flex items-center justify-center">
            <X className="w-2 h-2 text-red-400" strokeWidth={3} />
          </span>
        ) : (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0F0F12] border border-blue-500/40 flex items-center justify-center">
            <Loader2 className="w-2 h-2 text-blue-400 animate-spin" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-white truncate">{tx.type}</div>
        <div className="text-[10px] text-[#71717A] font-medium">
          {new Date(tx.timestamp).toLocaleDateString()} • {tx.status.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

export const WalletPanel = () => {
  const { wallet, transactionHistory, setActiveTransaction, isWalletOpen, toggleWallet } = useStore();
  const { address, isConnected } = useAccount();
  const { setOpen } = useModal();

  return (
    <>
      <AnimatePresence>
        {isWalletOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleWallet}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 xl:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'w-72 bg-[#0F0F12] border-l border-[#1F1F23] h-screen flex flex-col text-[#E4E4E7] fixed right-0 top-0 xl:relative z-50 transition-transform duration-300',
          isWalletOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0',
          !isWalletOpen && 'xl:flex hidden'
        )}
      >
        <div className="p-6 shrink-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full h-12 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold text-sm tracking-tight transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            {isConnected && address
              ? address.slice(0, 6) + '...' + address.slice(-4)
              : 'CONNECT WALLET'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-8 no-scrollbar">
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#52525B] font-bold mb-4">
              Assets
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] text-[#71717A] mb-1 font-bold">ETH BALANCE</div>
                  <div className="text-2xl font-semibold tabular-nums text-white">
                    {wallet.ethBalance}{' '}
                    <span className="text-sm text-[#52525B]">ETH</span>
                  </div>
                </div>
                <div className="text-xs text-[#71717A] font-medium mb-1">
                  {formatCurrency(wallet.usdBalance)}
                </div>
              </div>
              <div className="w-full h-1 bg-[#1F1F23] rounded-full overflow-hidden">
                <div className="w-[40%] h-full bg-blue-500" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#52525B] font-bold">
                Collection
              </h3>
              <span className="text-xs text-white font-medium">{wallet.nfts.length} NFT</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {wallet.nfts.slice(0, 4).map((nft) => (
                <div
                  key={nft.id}
                  className="aspect-square bg-[#1F1F23] border border-[#2D2D35] rounded-xl relative group overflow-hidden"
                >
                  <img
                    src={nft.image}
                    alt={nft.name}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#52525B] font-bold mb-4">
              Transaction History
            </h3>
            <div className="space-y-4">
              {transactionHistory.length === 0 ? (
                <p className="text-xs text-[#52525B]">
                  No transactions yet. Complete an action in chat.
                </p>
              ) : null}
              {transactionHistory.map((tx) => (
                <div key={tx.id}>
                  <TransactionHistoryItem
                    tx={tx}
                    onSelect={() => setActiveTransaction(tx)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto p-6 shrink-0">
          <div className="p-3 rounded-lg bg-[#1F1F23] border border-[#2D2D35] flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-[#A1A1AA] font-medium">Mainnet Node Connected</span>
          </div>
        </div>
      </aside>
    </>
  );
};
