import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import {
  Message,
  TransactionState,
  WalletState,
  TransactionStep,
  MockTransaction,
  ChatSession,
} from '../types';
import {
  submitChatMessage,
  fetchTransactions,
  fetchChatSessions,
  deleteChatSession,
  loadSessionHistory,
  type ChatResponse,
  type DbChatMessage,
} from '../lib/api';
import { getStoredToken } from '../lib/authStorage';
import { mapDbTransactions } from '../lib/transactionHistory';

// ─── Store Shape ───────────────────────────────────────────────────────────────

interface AppState {
  messages: Message[];
  wallet: WalletState;
  activeTransaction: TransactionState | null;
  transactionHistory: TransactionState[];
  isSidebarOpen: boolean;
  isWalletOpen: boolean;
  isProcessing: boolean;
  isTyping: boolean;
  sessionId: string;
  chatSessions: ChatSession[];
  activeSeshId: string | null;
  sessionsLoading: boolean;

  // Actions
  submitPrompt: (prompt: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  setWalletStatus: (status: Partial<WalletState>) => void;
  setActiveTransaction: (tx: TransactionState | null) => void;
  advanceTransactionStep: (
    stepId: string,
    status: TransactionStep['status'],
    txHash?: string
  ) => void;
  addTransactionToHistory: (tx: TransactionState) => void;
  loadTransactionHistory: () => Promise<void>;
  clearTransactionHistory: () => void;
  updateTransactionStep: (stepId: string, status: TransactionStep['status']) => void;
  toggleSidebar: () => void;
  toggleWallet: () => void;
  startNewChat: () => void;
  clearChat: () => void;
  setIsProcessing: (v: boolean) => void;
  setIsTyping: (v: boolean) => void;
  setSessionId: (sessionId: string) => void;
  setChatSessions: (sessions: ChatSession[]) => void;
  setActiveSeshId: (id: string | null) => void;
  loadChatSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const makeId = () => Math.random().toString(36).substr(2, 9);

const makeSessionId = () => {
  const cryptoApi = typeof window !== 'undefined' ? window.crypto : undefined;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const STEP_SIMULATION_DELAY_MS = 1500;
const TIMELINE_CLEAR_DELAY_MS = 2000;

function formatTransactionType(intent: string, recipient: string | null): string {
  switch (intent) {
    case 'MINT_BADGE':
      return recipient ? `MINT BADGE — ${recipient.toUpperCase()}` : 'MINT BADGE';
    case 'CLAIM_CERT':
      return 'CLAIM CERTIFICATE';
    case 'DONATE':
      return recipient ? `DONATE — ${recipient.toUpperCase()}` : 'DONATE';
    case 'SEND_REWARD':
      return recipient ? `SEND REWARD — ${recipient.toUpperCase()}` : 'SEND REWARD';
    default:
      return intent.replace(/_/g, ' ');
  }
}

type JwtClaims = {
  walletAddress?: string;
  userId?: string;
  exp?: number;
};

function createWelcomeMessage(): Message {
  return {
    id: makeId(),
    role: 'assistant',
    content:
      "Hello! I'm **UGF AgentX**. I can help you manage your assets on Base Sepolia — mint NFTs, claim certificates, donate, swap tokens, and more.\n\nWhat would you like to do today?",
    timestamp: Date.now(),
  };
}

function mapHistoryMessages(rows: DbChatMessage[]): Message[] {
  if (rows.length === 0) {
    return [createWelcomeMessage()];
  }

  return rows.map((row) => ({
    id: row.id,
    role: row.sender === 'user' ? 'user' : 'assistant',
    content: row.message,
    timestamp: new Date(row.created_at).getTime(),
  }));
}

function buildInitialWallet(): WalletState {
  const base: WalletState = {
    isConnected: false,
    address: null,
    token: null,
    ethBalance: '0',
    usdBalance: 0,
    nfts: [],
  };

  const token = getStoredToken();
  if (!token) return base;

  try {
    const decoded = jwtDecode<JwtClaims>(token);
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return base;
    }

    if (!decoded.walletAddress) return base;

    return {
      ...base,
      isConnected: true,
      address: decoded.walletAddress,
      token,
    };
  } catch {
    return base;
  }
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  messages: [createWelcomeMessage()],
  wallet: buildInitialWallet(),
  activeTransaction: null,
  transactionHistory: [],
  isSidebarOpen: window.innerWidth > 1024,
  isWalletOpen: false,
  isProcessing: false,
  isTyping: false,
  sessionId: makeSessionId(),
  chatSessions: [],
  activeSeshId: null,
  sessionsLoading: false,

  // ── Core message helpers ───────────────────────────────────────────────────
  addMessage: (msg) => {
    const id = makeId();
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id, timestamp: Date.now() },
      ],
    }));
    return id;
  },

  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  setIsProcessing: (v) => set({ isProcessing: v }),
  setIsTyping: (v) => set({ isTyping: v }),
  setSessionId: (sessionId) => set({ sessionId }),

  // ── Main AI chat orchestration ─────────────────────────────────────────────
  submitPrompt: async (prompt: string) => {
    const {
      addMessage,
      updateMessage,
      setIsProcessing,
      setIsTyping,
      setActiveTransaction,
      addTransactionToHistory,
      wallet,
      sessionId,
      setSessionId,
    } = get();

    if (!prompt.trim() || get().isProcessing) return;

    if (!wallet.isConnected || !wallet.address || !wallet.token) {
      addMessage({
        role: 'assistant',
        content: 'Please connect your wallet and sign the login message to continue.',
      });
      return;
    }

    setIsProcessing(true);

    // 1. Add user message
    addMessage({ role: 'user', content: prompt });

    try {
      // 2. Call backend API
      const chatResponse = await submitChatMessage({
        sessionId,
        message: prompt,
      });

      if (chatResponse.sessionId && chatResponse.sessionId !== sessionId) {
        set({ sessionId: chatResponse.sessionId, activeSeshId: chatResponse.sessionId });
      } else {
        set({ activeSeshId: get().sessionId });
      }

      void get().loadChatSessions();

      const aiSteps = chatResponse.aiSteps ?? [];
      const txSteps = chatResponse.transactionSteps ?? [];
      const intent = chatResponse.intent ?? chatResponse.metadata?.intent ?? 'UNKNOWN';
      const recipient = chatResponse.recipient ?? chatResponse.metadata?.recipient ?? null;
      // 3. Build transaction object (if this intent has steps)
      let activeTx: TransactionState | null = null;

      if (txSteps.length > 0) {
        const startedAt = Date.now();
        const hasRealTx = !!chatResponse.txHash && chatResponse.executionStatus === 'success';

        activeTx = {
          id: chatResponse.messageId,
          intent,
          type: formatTransactionType(intent, recipient),
          status: hasRealTx ? 'completed' : 'active',
          timestamp: startedAt,
          startedAt,
          gasEstimate: chatResponse.gasEstimate ?? null,
          steps: txSteps.map((s) => ({
            id: s.id,
            label: s.label,
            status: hasRealTx ? 'completed' as const : 'pending' as const,
            detail: s.detail,
            txHash: hasRealTx ? (chatResponse.txHash ?? undefined) : s.txHash,
          })),
        };
        setActiveTransaction(activeTx);

        if (hasRealTx) {
          void get().loadTransactionHistory();
          window.setTimeout(() => {
            setActiveTransaction(null);
          }, TIMELINE_CLEAR_DELAY_MS);
        } else {
          const { advanceTransactionStep } = get();

          // First step active immediately
          advanceTransactionStep(txSteps[0].id, 'active');

          // Simulate step progression (demo until UGF SDK drives real updates)
          for (let i = 0; i < txSteps.length; i++) {
            const stepId = txSteps[i].id;
            const timeout = window.setTimeout(() => {
              advanceTransactionStep(stepId, 'completed');

              if (i === txSteps.length - 1) {
                set((state) => {
                  if (!state.activeTransaction) return state;
                  const finalTx: TransactionState = {
                    ...state.activeTransaction,
                    status: 'completed',
                    steps: state.activeTransaction.steps.map((s) => ({
                      ...s,
                      status: 'completed' as const,
                    })),
                  };
                  return { activeTransaction: finalTx };
                });

                void get().loadTransactionHistory();

                window.setTimeout(() => {
                  setActiveTransaction(null);
                }, TIMELINE_CLEAR_DELAY_MS);
              }
            }, STEP_SIMULATION_DELAY_MS * (i + 1));
          }
        }
      }

      // 4. Stream AI messages one by one
      for (let i = 0; i < aiSteps.length; i++) {
        const step = aiSteps[i];

        setIsTyping(true);
        await sleep(step.delayMs);
        setIsTyping(false);

        let txPayload: MockTransaction | null | undefined;
        const mockUsd =
          chatResponse.gasEstimate?.mockUSD ?? chatResponse.metadata?.mockUsdCost;

        if (i === aiSteps.length - 1 && activeTx && mockUsd !== undefined && mockUsd !== '') {
          txPayload = {
            txHash: chatResponse.metadata?.txHash || '0x' + '0'.repeat(64),
            gasUsed: chatResponse.metadata?.gasUsed || String(mockUsd),
            mockUsdCost: String(mockUsd),
            nftName: recipient ?? chatResponse.metadata?.subject ?? 'User',
            blockNumber: chatResponse.metadata?.blockNumber || 0,
            network: 'Base Sepolia',
          };
        }

        addMessage({
          role: 'assistant',
          content: step.message,
          transaction: txPayload ?? null,
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      addMessage({
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to process request'}`,
      });
    }

    setIsProcessing(false);
  },

  // ── Legacy / utility actions ───────────────────────────────────────────────
  setWalletStatus: (status) =>
    set((state) => ({ wallet: { ...state.wallet, ...status } })),

  setActiveTransaction: (tx) => set({ activeTransaction: tx }),

  advanceTransactionStep: (stepId, status, txHash) =>
    set((state) => {
      if (!state.activeTransaction) return state;

      const stepIndex = state.activeTransaction.steps.findIndex((s) => s.id === stepId);
      if (stepIndex === -1) return state;

      const updatedSteps = state.activeTransaction.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              status,
              ...(txHash ? { txHash } : {}),
            }
          : step
      );

      if (status === 'completed' && stepIndex + 1 < updatedSteps.length) {
        updatedSteps[stepIndex + 1] = {
          ...updatedSteps[stepIndex + 1],
          status: 'active',
        };
      }

      const txStatus =
        status === 'error'
          ? 'failed'
          : state.activeTransaction.status === 'completed'
            ? 'completed'
            : 'active';

      return {
        activeTransaction: {
          ...state.activeTransaction,
          status: txStatus,
          steps: updatedSteps,
        },
      };
    }),

  addTransactionToHistory: (tx) =>
    set((state) => {
      const withoutDuplicate = state.transactionHistory.filter((item) => item.id !== tx.id);
      return { transactionHistory: [tx, ...withoutDuplicate] };
    }),

  loadTransactionHistory: async () => {
    const { wallet } = get();
    if (!wallet.address || !wallet.token) {
      set({ transactionHistory: [] });
      return;
    }

    try {
      const { transactions } = await fetchTransactions(wallet.address);
      set({ transactionHistory: mapDbTransactions(transactions) });
    } catch (error) {
      console.error('Failed to load transaction history:', error);
    }
  },

  clearTransactionHistory: () => set({ transactionHistory: [] }),

  updateTransactionStep: (stepId, status) =>
    set((state) => {
      if (!state.activeTransaction) return state;
      return {
        activeTransaction: {
          ...state.activeTransaction,
          steps: state.activeTransaction.steps.map((step) =>
            step.id === stepId ? { ...step, status } : step
          ),
        },
      };
    }),

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleWallet: () => set((state) => ({ isWalletOpen: !state.isWalletOpen })),

  startNewChat: () =>
    set({
      sessionId: makeSessionId(),
      activeSeshId: null,
      messages: [createWelcomeMessage()],
      activeTransaction: null,
      isTyping: false,
      isProcessing: false,
    }),

  clearChat: () => get().startNewChat(),

  setChatSessions: (sessions) => set({ chatSessions: sessions }),

  setActiveSeshId: (id) => set({ activeSeshId: id }),

  loadChatSessions: async () => {
    const { wallet } = get();
    if (!wallet.address || !wallet.token) {
      set({ chatSessions: [], sessionsLoading: false });
      return;
    }

    set({ sessionsLoading: true });
    try {
      const { sessions } = await fetchChatSessions(wallet.address);
      set({ chatSessions: sessions ?? [] });
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    } finally {
      set({ sessionsLoading: false });
    }
  },

  loadSession: async (sessionId: string) => {
    if (get().isProcessing) return;

    set({
      sessionId,
      activeSeshId: sessionId,
      activeTransaction: null,
      isTyping: false,
    });

    try {
      const rows = await loadSessionHistory(sessionId);
      set({ messages: mapHistoryMessages(rows) });
    } catch (error) {
      console.error('Failed to load session:', error);
      set({
        messages: [
          {
            id: makeId(),
            role: 'assistant',
            content: `❌ Could not load chat: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: Date.now(),
          },
        ],
      });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
      const { activeSeshId, sessionId: currentSessionId, chatSessions } = get();

      set({
        chatSessions: chatSessions.filter((s) => s.id !== sessionId),
      });

      if (activeSeshId === sessionId || currentSessionId === sessionId) {
        get().startNewChat();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  },
}));
