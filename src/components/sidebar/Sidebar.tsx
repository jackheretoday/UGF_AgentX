import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { PreviousChats } from './PreviousChats';

export const Sidebar = () => {
  const { isSidebarOpen, toggleSidebar, startNewChat } = useStore();

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
          opacity: isSidebarOpen ? 1 : 0,
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          'bg-[#0F0F12] border-r border-[#1F1F23] flex flex-col h-screen overflow-hidden fixed lg:relative z-50',
          !isSidebarOpen && 'border-none'
        )}
      >
        <div className="p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
              <div className="w-4 h-4 bg-black rounded-sm" />
            </div>
            <span className="font-bold text-lg tracking-tight text-[#E4E4E7]">UGF AgentX</span>
          </div>
        </div>

        <div className="px-6 mb-4 shrink-0">
          <button
            onClick={startNewChat}
            className="w-full py-2.5 px-4 bg-[#1F1F23] border border-[#2D2D35] hover:bg-[#2D2D35] text-white rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="font-medium text-sm">New Chat</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-6 pb-4">
          <PreviousChats />
        </div>

        <div className="mt-auto p-6 border-t border-[#1F1F23] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-[#71717A] font-bold uppercase tracking-wider">
              Base Sepolia
            </span>
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>

          <div className="bg-[#1F1F23] rounded py-1 px-2 text-[10px] inline-block text-white font-bold tracking-tight">
            UGF ENABLED
          </div>
        </div>
      </motion.aside>
    </>
  );
};
