import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useModal } from 'connectkit';
import { Check, Loader2, X, KeyRound, Mail, LogIn, Sparkles, Wallet2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { loginWithGoogle } from '../../lib/api';
import { setStoredToken } from '../../lib/authStorage';
import { showToast } from '../../lib/toast';

export const LoginPage = () => {
  const { setWalletStatus, loadTransactionHistory, loadChatSessions } = useStore();
  const { setOpen } = useModal();

  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleMockGoogleLogin = async (email: string, name: string) => {
    setIsLoading(true);
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
        profilePicture: undefined,
      });

      setIsGoogleModalOpen(false);
      showToast(`Welcome back, ${name}!`);

      await loadTransactionHistory();
      await loadChatSessions();
    } catch (error) {
      console.error('[GoogleAuth] Sign-in error:', error);
      showToast(error instanceof Error ? error.message : 'Google login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050505] flex items-center justify-center overflow-hidden p-4 font-sans select-none">
      {/* ─── Premium Glowing Mesh Backdrop ─────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        {/* Violet glow spot */}
        <motion.div
          animate={{
            x: [0, 40, -20, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[45vw] h-[45vw] max-w-[600px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none"
        />

        {/* Indigo/Blue glow spot */}
        <motion.div
          animate={{
            x: [0, -30, 50, 0],
            y: [0, 40, -30, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[50vw] h-[50vw] max-w-[700px] rounded-full bg-indigo-600/10 blur-[140px] pointer-events-none"
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Radial fade to cover sharp edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent,rgba(5,5,5,0.75))] pointer-events-none" />

      {/* ─── Main Glassmorphic Login Card ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[440px] bg-[#0E0E11]/65 backdrop-blur-xl border border-zinc-800/40 rounded-3xl p-8 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.85)] flex flex-col items-center text-center space-y-8"
      >
        {/* Gasless Active Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-bold text-indigo-300 uppercase tracking-widest"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Gasless Base Sepolia
        </motion.div>

        {/* Brand Orb Logo */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500" />
          <img
            src="/logo.png"
            alt="UGF AgentX Logo"
            className="relative w-16 h-16 rounded-2xl border border-zinc-800/80 shadow-2xl object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            UGF AgentX
          </h1>
          <p className="text-xs text-[#8A8A93] leading-relaxed max-w-[320px]">
            Slick, sponsored Web3 transactions powered by Gemini AI and the Universal Gas Framework.
          </p>
        </div>

        {/* Call to Actions / Login Buttons */}
        <div className="w-full flex flex-col gap-3">
          {/* Sign in with Google */}
          <button
            type="button"
            onClick={() => setIsGoogleModalOpen(true)}
            className="w-full h-12 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] shadow-lg cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Sign in with Google
          </button>

          {/* Connect Web3 Wallet */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full h-12 bg-[#131318] hover:bg-[#1A1A22] text-[#E4E4E7] border border-[#27272F] hover:border-[#383845] rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer"
          >
            <Wallet2 className="w-4 h-4 text-zinc-400" />
            Connect Web3 Wallet
          </button>
        </div>

        {/* Footer info */}
        <div className="text-[10px] text-zinc-600 font-medium">
          No gas needed. Under the hood, TYI Mock USD settles all gas payments.
        </div>
      </motion.div>

      {/* ─── Custom Google Sandbox Modal ─────────────────────────────────────────── */}
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
                  Select a Google Account to generate your deterministic embedded address and log in instantly.
                </p>

                {isLoading ? (
                  <div className="w-full p-8 flex flex-col items-center justify-center gap-2.5">
                    <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Signing in...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Jay Option */}
                    <button
                      onClick={() => handleMockGoogleLogin('jay@example.com', 'Jay')}
                      className="w-full p-3 bg-[#13131A] hover:bg-[#1C1C22] border border-[#1F1F23] hover:border-[#3A3A44] rounded-xl flex items-center gap-3 text-left transition-all active:scale-[0.98] group cursor-pointer"
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
                      className="w-full p-3 bg-[#13131A] hover:bg-[#1C1C22] border border-[#1F1F23] hover:border-[#3A3A44] rounded-xl flex items-center gap-3 text-left transition-all active:scale-[0.98] group cursor-pointer"
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
                )}
              </div>

              {/* Custom Input Option */}
              {!isLoading && (
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
                      className="px-3 h-9 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-lg transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
                    >
                      LOG IN
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
