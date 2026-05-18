import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MessageSquare, 
  Wallet, 
  ShieldCheck, 
  Settings,
  History,
  Cpu,
  LogOut,
  ChevronLeft
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export const Sidebar = () => {
  const { isSidebarOpen, toggleSidebar, clearChat } = useStore();

  const suggestedActions = [
    { label: 'Mint badge for Jay', icon: ShieldCheck },
    { label: 'Claim certificate', icon: Cpu },
    { label: 'Donate 5 USD', icon: Wallet },
    { label: 'Send workshop badge', icon: History },
  ];

  return (
    <>
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 0, 
          x: isSidebarOpen ? 0 : -280,
          opacity: isSidebarOpen ? 1 : 0 
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "bg-[#0F0F12] border-r border-[#1F1F23] flex flex-col h-screen overflow-hidden fixed lg:relative z-50",
          !isSidebarOpen && "border-none"
        )}
      >
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
            <div className="w-4 h-4 bg-black rounded-sm"></div>
          </div>
          <span className="font-bold text-lg tracking-tight text-[#E4E4E7]">UGF AgentX</span>
        </div>
      </div>

      <div className="px-6 mb-8">
        <button
          onClick={clearChat}
          className="w-full py-2.5 px-4 bg-[#1F1F23] border border-[#2D2D35] hover:bg-[#2D2D35] text-white rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
        >
          <Plus className="w-4 h-4 text-white" />
          <span className="font-medium text-sm">New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-8">
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#52525B] font-bold mb-4">
            Suggested Prompts
          </h3>
          <ul className="space-y-2">
            {suggestedActions.map((action, i) => (
              <li
                key={i}
                className="text-xs text-[#A1A1AA] hover:text-white cursor-pointer transition-colors flex items-center gap-2"
              >
                {action.label}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#52525B] font-bold mb-4">
            Previous Actions
          </h3>
          <ul className="space-y-3">
            {[
              { label: 'Swap 0.5 ETH to USDC', color: 'bg-green-500' },
              { label: 'Deploy ERC-721', color: 'bg-green-500' }
            ].map((action, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-xs text-[#A1A1AA]"
              >
                <div className={cn("w-1.5 h-1.5 rounded-full", action.color)}></div>
                {action.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-[#1F1F23]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-[#71717A] font-bold uppercase tracking-wider">Base Sepolia</span>
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
        </div>
        
        <div className="bg-[#1F1F23] rounded py-1 px-2 text-[10px] inline-block text-white font-bold tracking-tight">
          UGF ENABLED
        </div>
      </div>
    </motion.aside>
    </>
  );
};
