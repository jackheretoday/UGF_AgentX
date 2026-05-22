import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

interface ChatInputProps {
  /** Optional externally-controlled value for autofill from suggested prompts */
  prefill?: string;
  onPrefillConsumed?: () => void;
}

export const ChatInput = ({ prefill, onPrefillConsumed }: ChatInputProps) => {
  const [input, setInput] = useState('');
  const { submitPrompt, isProcessing } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle external prefill (from suggested prompts)
  useEffect(() => {
    if (prefill) {
      setInput(prefill);
      inputRef.current?.focus();
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;
    submitPrompt(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = input.trim().length > 0 && !isProcessing;

  return (
    <form onSubmit={handleSubmit} className="relative group">
      {/* Glow bg */}
      <div
        className={cn(
          'absolute inset-0 rounded-2xl blur-xl transition-all duration-500 pointer-events-none',
          isProcessing
            ? 'bg-blue-500/5'
            : input.trim()
            ? 'bg-white/6'
            : 'bg-white/3 group-focus-within:bg-white/8'
        )}
      />

      <div
        className={cn(
          'relative flex items-center bg-[#13131A] border rounded-xl px-4 sm:px-5 h-14 transition-all duration-200 gap-3',
          isProcessing
            ? 'border-blue-500/30 bg-blue-950/10'
            : 'border-[#1F1F23] focus-within:border-[#3A3A44]'
        )}
      >
        {/* Sparkles icon */}
        <Sparkles
          className={cn(
            'w-4 h-4 shrink-0 transition-colors duration-200',
            isProcessing ? 'text-blue-400 animate-pulse' : 'text-[#3F3F46]'
          )}
        />

        <input
          ref={inputRef}
          type="text"
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          placeholder={isProcessing ? 'AgentX is processing...' : 'Ask AgentX anything...'}
          className={cn(
            'flex-1 bg-transparent border-none text-sm focus:outline-none focus:ring-0 transition-colors duration-200',
            isProcessing
              ? 'text-[#52525B] placeholder-[#2A2A32] cursor-not-allowed'
              : 'text-white placeholder-[#3F3F46]'
          )}
        />

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[#3F3F46] font-mono font-bold tracking-widest hidden md:inline">
            ENTER
          </span>

          <AnimatePresence mode="wait">
            <motion.button
              key={isProcessing ? 'processing' : 'idle'}
              type="submit"
              disabled={!canSubmit}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              whileTap={{ scale: 0.92 }}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
                canSubmit
                  ? 'bg-white text-black hover:bg-gray-100 shadow-lg shadow-white/10'
                  : 'bg-[#1F1F23] text-[#52525B] cursor-not-allowed'
              )}
            >
              <Send className="w-3.5 h-3.5 fill-current" />
            </motion.button>
          </AnimatePresence>
        </div>
      </div>
    </form>
  );
};
