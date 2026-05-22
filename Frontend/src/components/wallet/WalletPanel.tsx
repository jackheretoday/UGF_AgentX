import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useModal } from 'connectkit';
import { useAccount, useDisconnect } from 'wagmi';
import { Check, Copy, Loader2, X, KeyRound, Mail, LogIn, LogOut, Wallet2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn, formatCurrency } from '../../lib/utils';
import { getTransactionKindMeta, resolveTransactionKind } from './transactionIcons';
import type { TransactionState } from '../../types';
import { loginWithGoogle } from '../../lib/api';
import { useWalletBalances } from '../../hooks/useWalletBalances';
import { clearAuthSession, setStoredToken } from '../../lib/authStorage';
import { showToast } from '../../lib/toast';

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Visual fill for the assets bar (0–100%), scales with balance. */
function getAssetBarFillPercent(ethBalance: string, usdBalance: number): number {
  const eth = parseFloat(ethBalance) || 0;
  const ethPct = Math.min(100, (eth / 1) * 100);
  const usdPct = Math.min(100, (usdBalance / 100) * 100);
  const fill = Math.max(ethPct, usdPct);
  if (fill <= 0) return 0;
  return Math.max(4, fill);
}

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
  const {
    wallet,
    transactionHistory,
    openActivityDetail,
    setMainView,
    isWalletOpen,
    toggleWallet,
  } = useStore();
  const setWalletStatus = useStore((s) => s.setWalletStatus);
  const loadTransactionHistory = useStore((s) => s.loadTransactionHistory);
  const loadChatSessions = useStore((s) => s.loadChatSessions);

  const { address, isConnected } = useAccount();
  const { setOpen } = useModal();
  const { disconnect } = useDisconnect();

  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState('');

  const isLoggedIn = wallet.isConnected && Boolean(wallet.address);
  const displayAddress = wallet.address ? truncateAddress(wallet.address) : '';
  const displayName =
    wallet.name ||
    (wallet.authType === 'google' && wallet.email
      ? wallet.email.split('@')[0]
      : null);
  const {
    ethDisplay,
    usdTotal,
    mockUsdBalance,
    isLoading: balancesLoading,
    isRefreshing: balancesRefreshing,
  } = useWalletBalances(isLoggedIn, wallet.address, wallet.token);

  const assetBarFill = getAssetBarFillPercent(
    balancesLoading ? wallet.ethBalance : ethDisplay,
    balancesLoading ? wallet.usdBalance : usdTotal
  );

  const handleMockGoogleLogin = async (email: string, name: string) => {
    try {
      const result = await loginWithGoogle(undefined, {
        sub: `google-sub-${email}`,
        email: email,
        name: name,
      });

      if (!result.success || !result.token) {
        throw new Error('Google Sign-In failed');
      }

      setStoredToken(result.token);
      setWalletStatus({
        isConnected: true,
        address: result.user.walletAddress,
        token: result.token,
        authType: 'google',
        email: email,
        name: name || result.user.displayName || undefined,
        ethBalance: String(result.user.ethBalance ?? 0),
        usdBalance: result.user.mockusdBalance ?? 0,
        profilePicture: undefined,
      });

      setIsGoogleModalOpen(false);
      showToast(`Welcome back, ${name}!`);

      await loadTransactionHistory();
      await loadChatSessions();
    } catch (error) {
      console.error('[GoogleAuth] Sign-in error:', error);
      showToast(error instanceof Error ? error.message : 'Google login failed');
    }
  };

  const copyAddress = () => {
    if (!wallet.address) return;
    void navigator.clipboard.writeText(wallet.address);
    showToast('Address copied to clipboard');
  };

  const handleDisconnect = () => {
    if (wallet.authType !== 'google' && isConnected) {
      disconnect();
    }
    clearAuthSession();
    showToast('Logged out successfully.');
  };

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

      <AnimatePresence>
        {isGoogleModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGoogleModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#0F0F12] border border-[#2D2D35] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative z-10 p-6 space-y-6 text-left"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Google Secure Auth</h2>
                    <p className="text-[10px] text-[#71717A]">Sandbox Environment</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGoogleModalOpen(false)}
                  className="p-1 hover:bg-[#1C1C22] rounded-lg transition-colors text-[#52525B] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  Select a secure Google Account to authenticate and provision a unique, deterministic cryptographic wallet.
                </p>

                <div className="space-y-2">
                  {/* Jay Option */}
                  <button
                    onClick={() => handleMockGoogleLogin('jay@example.com', 'Jay')}
                    className="w-full p-3 bg-[#13131A] hover:bg-[#1C1C22] border border-[#1F1F23] hover:border-[#3A3A44] rounded-xl flex items-center gap-3 text-left transition-all active:scale-[0.98] group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs border border-violet-500/20">
                      J
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        Jay
                        <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1 py-0.2 rounded uppercase tracking-wider font-extrabold">
                          Admin
                        </span>
                      </div>
                      <div className="text-[10px] text-[#71717A] truncate">jay@example.com</div>
                    </div>
                    <LogIn className="w-3.5 h-3.5 text-[#52525B] group-hover:text-white transition-colors" />
                  </button>

                  {/* Demo User Option */}
                  <button
                    onClick={() => handleMockGoogleLogin('demo@example.com', 'Demo User')}
                    className="w-full p-3 bg-[#13131A] hover:bg-[#1C1C22] border border-[#1F1F23] hover:border-[#3A3A44] rounded-xl flex items-center gap-3 text-left transition-all active:scale-[0.98] group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center font-bold text-white text-xs border border-emerald-500/20">
                      D
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white">Demo User</div>
                      <div className="text-[10px] text-[#71717A] truncate">demo@example.com</div>
                    </div>
                    <LogIn className="w-3.5 h-3.5 text-[#52525B] group-hover:text-white transition-colors" />
                  </button>
                </div>
              </div>

              {/* Custom Input Option */}
              <div className="border-t border-[#1F1F23] pt-4 space-y-2">
                <label className="text-[10px] text-[#52525B] font-bold uppercase tracking-wider">
                  Or Login with Custom Email
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B]" />
                    <input
                      type="email"
                      placeholder="name@gmail.com"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      className="w-full pl-9 pr-3 h-9 bg-[#13131A] border border-[#1F1F23] focus:border-[#3A3A44] rounded-lg text-xs text-white placeholder-[#52525B] focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (customEmail.includes('@')) {
                        const name = customEmail.split('@')[0];
                        handleMockGoogleLogin(customEmail, name.charAt(0).toUpperCase() + name.slice(1));
                      } else {
                        showToast('Please enter a valid email address.');
                      }
                    }}
                    className="px-3 h-9 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-lg transition-colors flex items-center gap-1 active:scale-95"
                  >
                    LOG IN
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'w-72 bg-[#0F0F12] border-l border-[#1F1F23] h-screen flex flex-col text-[#E4E4E7] fixed right-0 top-0 xl:relative z-50 transition-transform duration-300',
          isWalletOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0',
          !isWalletOpen && 'xl:flex hidden'
        )}
      >
        <div className="p-6 shrink-0 flex flex-col gap-2">
          {isLoggedIn ? (
            <div className="flex flex-col gap-3 bg-[#13131A] p-4 border border-[#1F1F23] rounded-2xl">
              {wallet.authType === 'google' ? (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm border border-violet-500/30 shadow-lg shadow-violet-500/10">
                      {(displayName || wallet.email || 'G').charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0F0F12] border border-blue-500/40 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate capitalize">
                      {displayName || 'Google User'}
                    </div>
                    {wallet.email ? (
                      <div className="text-[10px] text-[#71717A] font-semibold truncate">
                        {wallet.email}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1F1F23] border border-[#2D2D35] flex items-center justify-center">
                    <Wallet2 className="w-4 h-4 text-[#A1A1AA]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {displayName || 'Connected Wallet'}
                    </div>
                    <div className="text-[10px] text-[#71717A] font-semibold uppercase tracking-wider">
                      Web3 Wallet
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={copyAddress}
                className="w-full h-12 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold text-sm tracking-tight transition-all flex items-center justify-center gap-2 active:scale-[0.98] font-mono"
              >
                {displayAddress}
              </button>

              <div className="p-2.5 bg-[#0F0F12] border border-[#1F1F23] rounded-xl flex items-center justify-between gap-2">
                <span className="text-[9px] font-mono text-[#52525B] font-bold uppercase tracking-wider shrink-0">
                  {wallet.authType === 'google' ? 'Embedded Wallet' : 'Wallet Address'}
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-mono text-blue-400 font-bold truncate">
                    {displayAddress}
                  </span>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="p-1 hover:bg-[#1C1C22] rounded transition-colors text-[#52525B] hover:text-white shrink-0"
                    title="Copy address"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDisconnect}
                className="w-full h-10 border border-red-500/20 hover:border-red-500/40 bg-red-950/5 hover:bg-red-950/15 text-red-400 rounded-xl font-bold text-xs tracking-tight transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                <LogOut className="w-3.5 h-3.5" />
                {wallet.authType === 'google' ? 'DISCONNECT GOOGLE' : 'DISCONNECT WALLET'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full h-12 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold text-sm tracking-tight transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {isConnected && address ? truncateAddress(address) : 'CONNECT WALLET'}
              </button>

              <button
                type="button"
                onClick={() => setIsGoogleModalOpen(true)}
                className="w-full h-12 bg-[#13131A] hover:bg-[#1C1C22] text-white border border-[#1F1F23] hover:border-[#2D2D35] rounded-xl font-bold text-sm tracking-tight transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] shadow-lg shadow-black/25"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                SIGN IN WITH GOOGLE
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-2 space-y-8 no-scrollbar">
          <div className="min-w-0 w-full">
            <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#52525B] font-bold mb-4">
              Assets
            </h3>
            <div className="space-y-4 min-w-0 w-full">
              <div className="flex justify-between items-end gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-[#71717A] mb-1 font-bold">ETH BALANCE</div>
                  <div className="text-2xl font-semibold tabular-nums text-white truncate flex items-baseline gap-1">
                    {balancesLoading ? (
                      <Loader2 className="w-5 h-5 text-[#52525B] animate-spin" />
                    ) : (
                      <>
                        <span>{ethDisplay}</span>
                        <span className="text-sm text-[#52525B]">ETH</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 mb-1">
                  <div className="text-xs text-[#71717A] font-medium tabular-nums">
                    {balancesLoading ? (
                      <span className="text-[#52525B]">—</span>
                    ) : (
                      formatCurrency(usdTotal)
                    )}
                  </div>
                  {!balancesLoading && mockUsdBalance > 0 ? (
                    <div className="text-[9px] text-[#52525B] mt-0.5 tabular-nums">
                      {formatCurrency(mockUsdBalance)} mock gas
                    </div>
                  ) : null}
                </div>
              </div>
              {balancesRefreshing && !balancesLoading ? (
                <p className="text-[9px] text-[#52525B] -mt-2">Updating balances…</p>
              ) : null}
              <div
                className="w-full min-w-0 h-1.5 bg-[#1F1F23] rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={assetBarFill}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Portfolio balance indicator"
              >
                <div
                  className="h-full max-w-full bg-blue-500 rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${assetBarFill}%` }}
                />
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#52525B] font-bold">
                Transaction History
              </h3>
              {transactionHistory.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setMainView('activity')}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300"
                >
                  View all →
                </button>
              ) : null}
            </div>
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
                    onSelect={() => openActivityDetail(tx.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto p-6 shrink-0">
          <div className="p-3 rounded-lg bg-[#1F1F23] border border-[#2D2D35] flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-[#A1A1AA] font-medium">Base Sepolia Connected</span>
          </div>
        </div>
      </aside>
    </>
  );
};
