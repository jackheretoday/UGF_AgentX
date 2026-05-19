import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { groupSessionsByDate, truncateSessionTitle } from '../../lib/chatSessions';
import { cn } from '../../lib/utils';

function SessionSkeleton() {
  const widths = ['w-[60%]', 'w-[80%]', 'w-[45%]', 'w-[70%]', 'w-[55%]'];

  return (
    <div className="space-y-2 animate-pulse">
      {widths.map((width, i) => (
        <div key={i} className={cn('h-8 rounded-md bg-[#1F1F23]', width)} />
      ))}
    </div>
  );
}

function SessionRow({
  title,
  isActive,
  isDeleting,
  onSelect,
  onDelete,
}: {
  title: string;
  isActive: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: isDeleting ? 0 : 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2 }}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setConfirmDelete(false);
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors flex items-center gap-2 min-h-[36px]',
          isActive
            ? 'bg-[#2D2D35] text-white'
            : 'text-[#A1A1AA] hover:bg-[#1A1A1F] hover:text-white'
        )}
      >
        <span className="flex-1 truncate">{truncateSessionTitle(title)}</span>
        {hovered && !confirmDelete && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                setConfirmDelete(true);
              }
            }}
            className="shrink-0 p-0.5 rounded hover:bg-[#3F3F46] text-[#71717A] hover:text-[#E4E4E7]"
            aria-label="Delete chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute right-0 top-full z-10 mt-1 flex items-center gap-2 rounded-md border border-[#2D2D35] bg-[#18181B] px-2 py-1.5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[11px] text-[#A1A1AA]">Delete?</span>
            <button
              type="button"
              onClick={onDelete}
              className="text-[11px] font-semibold text-red-400 hover:text-red-300"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-[11px] font-semibold text-[#71717A] hover:text-white"
            >
              No
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function PreviousChats() {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    chatSessions,
    activeSeshId,
    sessionsLoading,
    wallet,
    loadChatSessions,
    loadSession,
    deleteSession,
  } = useStore();

  useEffect(() => {
    if (wallet.isConnected && wallet.address && wallet.token) {
      void loadChatSessions();
    }
  }, [wallet.isConnected, wallet.address, wallet.token, loadChatSessions]);

  const groups = groupSessionsByDate(chatSessions);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <h3 className="text-[11px] uppercase tracking-[0.12em] text-[#52525B] font-bold mb-3 shrink-0">
        Previous Chats
      </h3>

      <div className="flex-1 overflow-y-auto pr-1 space-y-1 sidebar-scroll">
        {sessionsLoading ? (
          <SessionSkeleton />
        ) : chatSessions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[13px] text-[#52525B]">No previous chats yet</p>
            <p className="text-[12px] text-[#3F3F46] mt-1">Start a conversation above</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {groups.map((group) => (
              <motion.div
                key={group.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-3"
              >
                <p className="text-[11px] text-[#52525B] font-medium mb-1.5 px-1">{group.label}</p>
                <div className="space-y-0.5">
                  {group.sessions.map((session) => (
                    <div key={session.id}>
                      <SessionRow
                        title={session.title}
                        isActive={activeSeshId === session.id}
                        isDeleting={deletingId === session.id}
                        onSelect={() => void loadSession(session.id)}
                        onDelete={async () => {
                          setDeletingId(session.id);
                          await deleteSession(session.id);
                          setDeletingId(null);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
