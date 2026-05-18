import { create } from 'zustand';
import { Message, TransactionState, WalletState, TransactionStep, MockTransaction } from '../types';
import {
  detectIntent,
  extractSubject,
  responseFlows,
  createMockTransaction,
} from '../lib/aiResponseEngine';

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

  // Actions
  submitPrompt: (prompt: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  setWalletStatus: (status: Partial<WalletState>) => void;
  setActiveTransaction: (tx: TransactionState | null) => void;
  advanceTransactionStep: (stepIndex: number) => void;
  addTransactionToHistory: (tx: TransactionState) => void;
  updateTransactionStep: (stepId: string, status: TransactionStep['status']) => void;
  toggleSidebar: () => void;
  toggleWallet: () => void;
  clearChat: () => void;
  setIsProcessing: (v: boolean) => void;
  setIsTyping: (v: boolean) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const makeId = () => Math.random().toString(36).substr(2, 9);

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  messages: [
    {
      id: '1',
      role: 'assistant',
      content:
        "Hello! I'm **UGF AgentX**. I can help you manage your assets on Base Sepolia — mint NFTs, claim certificates, donate, swap tokens, and more.\n\nWhat would you like to do today?",
      timestamp: Date.now(),
    },
  ],
  wallet: {
    isConnected: true,
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    ethBalance: '1.245',
    usdBalance: 420.69,
    nfts: [
      {
        id: '1',
        name: 'Alchemist #42',
        collection: 'UGF Origins',
        image:
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&auto=format&fit=crop',
      },
      {
        id: '2',
        name: 'Workshop Badge',
        collection: 'UGF Events',
        image:
          'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200&h=200&auto=format&fit=crop',
      },
    ],
  },
  activeTransaction: null,
  transactionHistory: [
    {
      id: 'h1',
      type: 'SWAP ETH TO USDC',
      status: 'completed',
      timestamp: Date.now() - 3600000 * 2,
      steps: [
        { id: 's1', label: 'Approve Router', status: 'completed' },
        { id: 's2', label: 'Execute Swap', status: 'completed', txHash: '0x123...abc' },
      ],
    },
    {
      id: 'h2',
      type: 'MINT UGF ORIGINS',
      status: 'failed',
      timestamp: Date.now() - 86400000,
      steps: [
        { id: 's3', label: 'Upload Metadata', status: 'completed' },
        { id: 's4', label: 'Mint NFT', status: 'error' },
      ],
    },
  ],
  isSidebarOpen: window.innerWidth > 1024,
  isWalletOpen: false,
  isProcessing: false,
  isTyping: false,

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

  // ── Main AI chat orchestration ─────────────────────────────────────────────
  submitPrompt: async (prompt: string) => {
    const {
      addMessage,
      updateMessage,
      setIsProcessing,
      setIsTyping,
      setActiveTransaction,
      addTransactionToHistory,
    } = get();

    if (!prompt.trim() || get().isProcessing) return;

    setIsProcessing(true);

    // 1. Add user message
    addMessage({ role: 'user', content: prompt });

    // 2. Detect intent
    const intent = detectIntent(prompt);
    const subject = extractSubject(prompt);
    const flow = responseFlows[intent];

    // 3. Build transaction object (if this intent has steps)
    let activeTx: TransactionState | null = null;
    if (flow.transactionSteps.length > 0) {
      activeTx = {
        id: makeId(),
        type: intent.toUpperCase() + ' ' + (intent === 'mint' ? `BADGE — ${subject.toUpperCase()}` : ''),
        status: 'active',
        timestamp: Date.now(),
        steps: flow.transactionSteps.map((s) => ({
          id: s.id,
          label: s.label,
          status: 'pending' as const,
          detail: s.detail,
        })),
      };
      setActiveTransaction(activeTx);
    }

    // 4. Stream AI messages one by one
    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];

      // Show typing indicator
      setIsTyping(true);
      await sleep(step.delayMs);
      setIsTyping(false);

      // Advance corresponding transaction step
      if (activeTx && i < flow.transactionSteps.length) {
        // Mark previous as completed
        if (i > 0) {
          set((state) => {
            if (!state.activeTransaction) return state;
            const updatedSteps = state.activeTransaction.steps.map((s, idx) =>
              idx === i - 1 ? { ...s, status: 'completed' as const } : s
            );
            return { activeTransaction: { ...state.activeTransaction, steps: updatedSteps } };
          });
        }
        // Mark current as active
        set((state) => {
          if (!state.activeTransaction) return state;
          const updatedSteps = state.activeTransaction.steps.map((s, idx) =>
            idx === i ? { ...s, status: 'active' as const } : s
          );
          return { activeTransaction: { ...state.activeTransaction, steps: updatedSteps } };
        });
      }

      // Build message payload
      let txPayload: MockTransaction | null | undefined;
      if (step.attachTx && activeTx) {
        txPayload = createMockTransaction(flow.nftName(subject));
      }

      addMessage({
        role: 'assistant',
        content: step.message,
        transaction: txPayload ?? null,
      });
    }

    // 5. Finalise transaction
    if (activeTx) {
      // Mark all steps completed
      set((state) => {
        if (!state.activeTransaction) return state;
        const finalSteps = state.activeTransaction.steps.map((s) => ({
          ...s,
          status: 'completed' as const,
        }));
        const finalTx: TransactionState = {
          ...state.activeTransaction,
          status: 'completed',
          steps: finalSteps,
        };
        addTransactionToHistory(finalTx);
        return { activeTransaction: finalTx };
      });

      // Wait briefly then clear active so it doesn't persist
      await sleep(3000);
      setActiveTransaction(null);
    }

    setIsProcessing(false);
  },

  // ── Legacy / utility actions ───────────────────────────────────────────────
  setWalletStatus: (status) =>
    set((state) => ({ wallet: { ...state.wallet, ...status } })),

  setActiveTransaction: (tx) => set({ activeTransaction: tx }),

  advanceTransactionStep: (stepIndex) =>
    set((state) => {
      if (!state.activeTransaction) return state;
      const updatedSteps = state.activeTransaction.steps.map((s, idx) => {
        if (idx < stepIndex) return { ...s, status: 'completed' as const };
        if (idx === stepIndex) return { ...s, status: 'active' as const };
        return s;
      });
      return { activeTransaction: { ...state.activeTransaction, steps: updatedSteps } };
    }),

  addTransactionToHistory: (tx) =>
    set((state) => ({ transactionHistory: [tx, ...state.transactionHistory] })),

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
  clearChat: () =>
    set({
      messages: [
        {
          id: makeId(),
          role: 'assistant',
          content:
            "Chat cleared. I'm **UGF AgentX** — ready to assist. What would you like to do?",
          timestamp: Date.now(),
        },
      ],
    }),
}));
