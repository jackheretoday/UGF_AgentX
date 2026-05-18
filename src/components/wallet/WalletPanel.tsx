import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ConnectKitButton } from 'connectkit';
import { Wallet, Info, ArrowUpRight, Grid, LayoutGrid } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn, formatCurrency } from '../../lib/utils';

export const WalletPanel = () => {
  const { wallet, transactionHistory, setActiveTransaction, isWalletOpen, toggleWallet } = useStore();

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

      <aside className={cn(
        "w-72 bg-[#0F0F12] border-l border-[#1F1F23] h-screen flex flex-col text-[#E4E4E7] fixed right-0 top-0 xl:relative z-50 transition-transform duration-300",
        isWalletOpen ? "translate-x-0" : "translate-x-full xl:translate-x-0",
        !isWalletOpen && "xl:flex hidden"
      )}>
      <div className="p-6 shrink-0">
        <ConnectKitButton.Custom>
          {({ isConnected, isConnecting, show, hide, address, ensName }) => {
            return (
              <button
                onClick={show}
                className="w-full h-12 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold text-sm tracking-tight transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                {isConnected ? ensName ?? address?.slice(0, 6) + '...' + address?.slice(-4) : 'CONNECT WALLET'}
              </button>
            );
          }}
        </ConnectKitButton.Custom>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-8 no-scrollbar">
        {/* Balances */}
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#52525B] font-bold mb-4">Assets</h3>
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] text-[#71717A] mb-1 font-bold">ETH BALANCE</div>
                  <div className="text-2xl font-semibold tabular-nums text-white">
                    {wallet.ethBalance} <span className="text-sm text-[#52525B]">ETH</span>
                  </div>
                </div>
                <div className="text-xs text-[#71717A] font-medium mb-1">
                  {formatCurrency(wallet.usdBalance)}
                </div>
              </div>
              <div className="w-full h-1 bg-[#1F1F23] rounded-full overflow-hidden">
                <div className="w-[40%] h-full bg-blue-500"></div>
              </div>
            </div>
          </div>
        </div>

        {/* NFT Gallery */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#52525B] font-bold">Collection</h3>
            <span className="text-xs text-white font-medium">{wallet.nfts.length} NFT</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {wallet.nfts.slice(0, 4).map((nft) => (
              <div key={nft.id} className="aspect-square bg-[#1F1F23] border border-[#2D2D35] rounded-xl relative group overflow-hidden">
                <img src={nft.image} alt={nft.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#52525B] font-bold mb-4">Transaction History</h3>
          <div className="space-y-4">
            {transactionHistory.map((tx) => (
              <div 
                key={tx.id} 
                className="flex gap-3 items-start group cursor-pointer"
                onClick={() => setActiveTransaction(tx)}
              >
                <div className={cn(
                  "w-8 h-8 rounded shrink-0 border flex items-center justify-center text-xs transition-colors",
                  tx.status === 'completed' 
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500 group-hover:bg-emerald-500/10" 
                    : tx.status === 'failed'
                    ? "bg-red-500/5 border-red-500/20 text-red-500 group-hover:bg-red-500/10"
                    : "bg-[#1F1F23] border-[#2D2D35] text-white group-hover:bg-[#2D2D35]"
                )}>
                  {tx.status === 'completed' ? '✓' : tx.status === 'failed' ? '✕' : '•'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{tx.type}</div>
                  <div className="text-[10px] text-[#71717A] font-medium">
                    {new Date(tx.timestamp).toLocaleDateString()} • {tx.status.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto p-6 shrink-0">
        <div className="p-3 rounded-lg bg-[#1F1F23] border border-[#2D2D35] flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-xs text-[#A1A1AA] font-medium">Mainnet Node Connected</span>
        </div>
      </div>
    </aside>
    </>
  );
};
