import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import {
  Message,
  TransactionState,
  WalletState,
  TransactionStep,
  TransactionReceipt,
  ChatSession,
} from '../types';
import {
  submitChatMessage,
  fetchTransactions,
  fetchTransactionStatus,
  fetchTransactionDetail,
  fetchGallery,
  fetchChatSessions,
  deleteChatSession,
  loadSessionHistory,
  completeUserWalletUgfTransaction,
  type ChatResponse,
  type DbChatMessage,
} from '../lib/api';
import { runUserWalletUgfFlow } from '../lib/ugfWalletSettlement';
import { getStoredToken } from '../lib/authStorage';
import { mapDbTransactions } from '../lib/transactionHistory';
import {
  mergeTransactionsWithBadges,
  mapDbRowToActivityRecord,
  type ActivityRecord,
  type MintedBadgeRow,
} from '../lib/activityRecords';
import { trackTransaction } from '../lib/transactionTracker';
import { mapStatusToTransactionState } from '../lib/transactionSteps';

// ─── Store Shape ───────────────────────────────────────────────────────────────

export type MainView = 'chat' | 'activity';

interface AppState {
  messages: Message[];
  wallet: WalletState;
  mainView: MainView;
  activityRecords: ActivityRecord[];
  selectedActivityId: string | null;
  activityLoading: boolean;
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
  activeTransactionUnsubscribe: (() => void) | null;

  // Actions
  submitPrompt: (prompt: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  setWalletStatus: (status: Partial<WalletState>) => void;
  setActiveTransaction: (tx: TransactionState | null) => void;
  applyTransactionStatus: (tx: TransactionState) => void;
  loadTransactionHistory: () => Promise<void>;
  clearTransactionHistory: () => void;
  setMainView: (view: MainView) => void;
  loadActivityRecords: () => Promise<void>;
  selectActivity: (id: string | null) => void;
  openActivityDetail: (id: string) => void;
  refreshSelectedActivity: () => Promise<void>;
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

const TIMELINE_CLEAR_DELAY_MS = 4000;

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
  authType?: 'wallet' | 'google';
  email?: string;
  name?: string;
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
      authType: decoded.authType || 'wallet',
      email: decoded.email,
      name: decoded.name,
    };
  } catch {
    return base;
  }
}

function buildReceiptFromStatus(
  status: import('../lib/api').TransactionStatusDto,
  recipient: string | null
): TransactionReceipt | null {
  if (!status.txHash || status.status !== 'confirmed') {
    return null;
  }

  return {
    txHash: status.txHash,
    explorerUrl: status.explorerUrl ?? '',
    gasUsed: status.gasUsed != null ? String(status.gasUsed) : '',
    mockUsdCost: status.gasFee != null ? String(status.gasFee) : '',
    blockNumber: status.blockNumber ?? 0,
    network: status.network,
    confirmedAt: status.confirmedAt ?? undefined,
    nftName: recipient ?? 'User',
  };
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  messages: [createWelcomeMessage()],
  wallet: buildInitialWallet(),
  mainView: 'chat',
  activityRecords: [],
  selectedActivityId: null,
  activityLoading: false,
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
  activeTransactionUnsubscribe: null,

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

  applyTransactionStatus: (tx) => set({ activeTransaction: tx }),

  submitPrompt: async (prompt: string) => {
    const {
      addMessage,
      updateMessage,
      setIsProcessing,
      setIsTyping,
      setActiveTransaction,
      applyTransactionStatus,
      wallet,
      sessionId,
    } = get();

    if (!prompt.trim() || get().isProcessing) return;

    if (!wallet.isConnected || !wallet.address || !wallet.token) {
      addMessage({
        role: 'assistant',
        content: 'Please connect your wallet and sign the login message to continue.',
      });
      return;
    }

    get().activeTransactionUnsubscribe?.();
    set({ activeTransactionUnsubscribe: null });

    setIsProcessing(true);
    addMessage({ role: 'user', content: prompt });

    try {
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
      const transactionId = chatResponse.transactionId;

      let activeTx: TransactionState | null = null;

      if (txSteps.length > 0 && transactionId) {
        const startedAt = Date.now();
        activeTx = {
          id: transactionId,
          intent,
          type: formatTransactionType(intent, recipient),
          status: 'active',
          timestamp: startedAt,
          startedAt,
          gasEstimate: chatResponse.gasEstimate ?? null,
          steps: txSteps.map((s) => ({
            id: s.id,
            label: s.label,
            status: s.id === 'pending' ? 'active' : 'pending',
            detail: s.detail,
          })),
        };
        setActiveTransaction(activeTx);

        const startTracking = () =>
          trackTransaction(transactionId, {
            onUpdate: (status) => {
              const base = get().activeTransaction;
              if (!base || base.id !== transactionId) return;
              applyTransactionStatus(mapStatusToTransactionState(base, status));
            },
            onTerminal: (status) => {
              const base = get().activeTransaction;
              if (!base) return;

              applyTransactionStatus(mapStatusToTransactionState(base, status));
              void get().loadTransactionHistory();

              const receipt = buildReceiptFromStatus(status, recipient);
              if (receipt) {
                const messages = get().messages;
                const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
                if (lastAssistant) {
                  updateMessage(lastAssistant.id, { transaction: receipt });
                }
              }

              window.setTimeout(() => {
                setActiveTransaction(null);
              }, TIMELINE_CLEAR_DELAY_MS);
            },
          });

        if (
          chatResponse.executionStatus === 'awaiting_settlement' ||
          chatResponse.clientSettlementRequired
        ) {
          const walletAddr = get().wallet.address;
          const quote = chatResponse.ugfQuote;
          const contractAddress = chatResponse.ugfContractAddress;
          const calldata = chatResponse.ugfCalldata as `0x${string}` | undefined;

          if (!walletAddr || !quote || !contractAddress || !calldata?.startsWith('0x')) {
            const reason = 'Connect wallet and retry claim (missing UGF execution params).';
            set((state) =>
              state.activeTransaction
                ? {
                    activeTransaction: {
                      ...state.activeTransaction,
                      status: 'failed',
                      failureReason: reason,
                    },
                  }
                : state
            );
          } else {
            void (async () => {
              try {
                set((state) =>
                  state.activeTransaction
                    ? {
                        activeTransaction: {
                          ...state.activeTransaction,
                          steps: state.activeTransaction.steps.map((s) =>
                            s.id === 'settle'
                              ? { ...s, status: 'active' as const, detail: 'Approve in wallet…' }
                              : s
                          ),
                        },
                      }
                    : state
                );

                const { userTxHash, quoteId } = await runUserWalletUgfFlow({
                  quoteSnapshot: quote,
                  contractAddress,
                  calldata,
                });

                await completeUserWalletUgfTransaction(transactionId, {
                  walletAddress: walletAddr,
                  txHash: userTxHash,
                  quoteId,
                });

                const unsubscribe = startTracking();
                set({ activeTransactionUnsubscribe: unsubscribe });
              } catch (err) {
                const reason =
                  err instanceof Error ? err.message : 'Wallet TYI settlement failed';
                set((state) =>
                  state.activeTransaction
                    ? {
                        activeTransaction: {
                          ...state.activeTransaction,
                          status: 'failed',
                          failureReason: reason,
                          steps: state.activeTransaction.steps.map((s) =>
                            s.id === 'settle'
                              ? { ...s, status: 'error' as const, detail: reason }
                              : s
                          ),
                        },
                      }
                    : state
                );
              }
            })();
          }
        } else if (chatResponse.executionStatus === 'pending') {
          const unsubscribe = startTracking();
          set({ activeTransactionUnsubscribe: unsubscribe });
        } else if (
          chatResponse.executionStatus === 'failed' ||
          chatResponse.executionStatus === 'skipped'
        ) {
          const reason =
            chatResponse.failureReason ??
            (chatResponse.ugfConfigured === false
              ? 'On-chain execution is not configured on the server (UGF_SIGNER_PRIVATE_KEY / NFT_CONTRACT_ADDRESS).'
              : 'Transaction could not start.');

          set((state) => {
            if (!state.activeTransaction) return state;
            return {
              activeTransaction: {
                ...state.activeTransaction,
                status: 'failed',
                failureReason: reason,
                steps: state.activeTransaction.steps.map((s, i) =>
                  i === 0
                    ? { ...s, status: 'error' as const, detail: reason }
                    : s
                ),
              },
            };
          });

          if (transactionId) {
            void fetchTransactionStatus(transactionId)
              .then((status) => {
                const base = get().activeTransaction;
                if (!base || base.id !== transactionId) return;
                applyTransactionStatus(mapStatusToTransactionState(base, status));
              })
              .catch(() => undefined);
          }
        }
      }

      for (let i = 0; i < aiSteps.length; i++) {
        const step = aiSteps[i];
        setIsTyping(true);
        await sleep(step.delayMs);
        setIsTyping(false);

        addMessage({
          role: 'assistant',
          content: step.message,
          transaction: null,
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

  setWalletStatus: (status) =>
    set((state) => ({ wallet: { ...state.wallet, ...status } })),

  setActiveTransaction: (tx) => set({ activeTransaction: tx }),

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

  setMainView: (view) => {
    set({ mainView: view });
    if (view === 'activity') {
      void get().loadActivityRecords();
    }
  },

  loadActivityRecords: async () => {
    const { wallet } = get();
    if (!wallet.address || !wallet.token) {
      set({ activityRecords: [], selectedActivityId: null });
      return;
    }

    set({ activityLoading: true });
    try {
      const [{ transactions }, gallery] = await Promise.all([
        fetchTransactions(wallet.address),
        fetchGallery(wallet.address).catch(() => ({ badges: [] as MintedBadgeRow[] })),
      ]);
      const records = mergeTransactionsWithBadges(transactions, gallery.badges ?? []);
      set({ activityRecords: records });
    } catch (error) {
      console.error('Failed to load activity records:', error);
    } finally {
      set({ activityLoading: false });
    }
  },

  selectActivity: (id) => set({ selectedActivityId: id }),

  openActivityDetail: (id) => {
    set({ mainView: 'activity', selectedActivityId: id, isWalletOpen: false });
    void get().refreshSelectedActivity();
  },

  refreshSelectedActivity: async () => {
    const { wallet, selectedActivityId, activityRecords } = get();
    if (!wallet.token || !selectedActivityId) return;

    try {
      const { transaction, badge } = await fetchTransactionDetail(selectedActivityId);
      const enriched = mapDbRowToActivityRecord(
        transaction,
        badge
          ? {
              id: badge.id,
              badge_name: badge.badge_name,
              recipient_name: badge.recipient_name,
              metadata_uri: badge.metadata_uri,
              image_url: badge.image_url,
              tx_hash: badge.tx_hash,
              minted_at: badge.minted_at,
            }
          : undefined
      );
      set({
        activityRecords: activityRecords.map((r) =>
          r.id === selectedActivityId ? enriched : r,
        ),
      });
    } catch (error) {
      console.error('Failed to refresh activity detail:', error);
    }
  },

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleWallet: () => set((state) => ({ isWalletOpen: !state.isWalletOpen })),

  startNewChat: () => {
    get().activeTransactionUnsubscribe?.();
    set({
      mainView: 'chat',
      sessionId: makeSessionId(),
      activeSeshId: null,
      messages: [createWelcomeMessage()],
      activeTransaction: null,
      activeTransactionUnsubscribe: null,
      isTyping: false,
      isProcessing: false,
    });
  },

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

    get().activeTransactionUnsubscribe?.();

    set({
      sessionId,
      activeSeshId: sessionId,
      activeTransaction: null,
      activeTransactionUnsubscribe: null,
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
