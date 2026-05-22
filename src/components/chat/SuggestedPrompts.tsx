import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Cpu, Wallet, History, ArrowLeftRight, BarChart3 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const prompts = [
  { text: "Let's mint badge for you!", icon: ShieldCheck, color: 'text-violet-400 group-hover:text-violet-300' },
  { text: 'Claim certificate', icon: Cpu, color: 'text-blue-400 group-hover:text-blue-300' },
  { text: 'Donate 5 USD', icon: Wallet, color: 'text-emerald-400 group-hover:text-emerald-300' },
  { text: 'Swap ETH to USDC', icon: ArrowLeftRight, color: 'text-yellow-400 group-hover:text-yellow-300' },
  { text: 'Check balance', icon: BarChart3, color: 'text-pink-400 group-hover:text-pink-300' },
  { text: 'History', icon: History, color: 'text-[#71717A] group-hover:text-white' },
];

export const SuggestedPrompts = ({ onSelect }: SuggestedPromptsProps) => {
  const isProcessing = useStore((state) => state.isProcessing);

  return (
    <div className="flex flex-wrap gap-1.5">
      {prompts.map((prompt, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.2 }}
          whileTap={{ scale: 0.95 }}
          disabled={isProcessing}
          onClick={() => onSelect(prompt.text)}
          className={cn(
            'group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer border',
            isProcessing
              ? 'border-[#1A1A1F] bg-[#0A0A0B] text-[#2A2A32] cursor-not-allowed'
              : 'border-[#1F1F23] bg-[#0F0F12] hover:bg-[#1C1C22] hover:border-[#2A2A32] text-[#71717A] hover:text-white'
          )}
        >
          <prompt.icon className={cn('w-3 h-3 transition-colors duration-150', isProcessing ? 'text-[#2A2A32]' : prompt.color)} />
          {prompt.text}
        </motion.button>
      ))}
    </div>
  );
};
