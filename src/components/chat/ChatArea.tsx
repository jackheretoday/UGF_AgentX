import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import { ChatBubble, TypingIndicator } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { TransactionTimeline } from './TransactionTimeline';
import { SuggestedPrompts } from './SuggestedPrompts';
import { Menu, Wallet as WalletIcon, Sparkles } from 'lucide-react';

export const ChatArea = () => {
  const { messages, activeTransaction, toggleSidebar, toggleWallet, isTyping, isProcessing } =
    useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Prefill state for suggested prompts → ChatInput
  const [prefill, setPrefill] = useState<string | undefined>(undefined);

  // Auto-scroll whenever messages / typing / transaction change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Smooth scroll to bottom
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping, activeTransaction]);

  const handleSuggestedPrompt = useCallback((text: string) => {
    setPrefill(text);
  }, []);

  const handlePrefillConsumed = useCallback(() => {
    setPrefill(undefined);
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] relative overflow-hidden h-full">
      {/* ── Top Nav ──────────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-[#1A1A1F] flex items-center px-4 sm:px-6 justify-between shrink-0 bg-[#0A0A0B]/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-[#1F1F23] rounded-lg lg:hidden transition-colors"
          >
            <Menu className="w-4 h-4 text-[#71717A]" />
          </button>
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#52525B]">
            <span>Session:</span>
            <span className="text-white font-semibold font-mono">Agent Operations #042</span>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 ml-2 text-blue-400"
              >
                <Sparkles className="w-3 h-3 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Processing</span>
              </motion.div>
            )}
          </div>
          <div className="text-sm font-bold text-white sm:hidden">AgentX</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleWallet}
            className="p-2 hover:bg-[#1F1F23] rounded-lg xl:hidden transition-colors"
          >
            <WalletIcon className="w-4 h-4 text-[#71717A]" />
          </button>
          {/* Status dots */}
          <div className="hidden lg:flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#1F1F23]" />
          </div>
        </div>
      </header>

      {/* ── Message Scroll Area ───────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 scroll-smooth no-scrollbar"
      >
        <div className="max-w-3xl mx-auto space-y-5">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && <TypingIndicator key="typing" />}
          </AnimatePresence>

          {/* Active Transaction Timeline — inline in the conversation */}
          <AnimatePresence>
            {activeTransaction && (
              <motion.div
                key={activeTransaction.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="max-w-sm"
              >
                <TransactionTimeline transaction={activeTransaction} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Spacer so input doesn't overlap last message */}
        <div className="h-44" />
      </div>

      {/* ── Fixed Bottom Input Area ───────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 w-full">
        {/* Gradient fade */}
        <div className="h-16 bg-gradient-to-t from-[#0A0A0B] to-transparent pointer-events-none" />
        <div className="bg-[#0A0A0B] px-4 sm:px-8 pb-5 pt-1">
          <div className="max-w-3xl mx-auto space-y-3">
            <SuggestedPrompts onSelect={handleSuggestedPrompt} />
            <ChatInput prefill={prefill} onPrefillConsumed={handlePrefillConsumed} />
            <p className="text-[9px] sm:text-[10px] text-center text-[#2A2A32] font-bold uppercase tracking-widest">
              UGF AGENTX CAN EXECUTE TRANSACTIONS — ALWAYS VERIFY ON-CHAIN
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
