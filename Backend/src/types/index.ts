// ─── Message & Chat ───────────────────────────────────────────────────────────

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    intent?: string;
    subject?: string;
  };
}

// ─── Transaction ───────────────────────────────────────────────────────────────

export interface TransactionStep {
  id: string;
  label: string;
  detail: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  txHash?: string;
}

export interface Transaction {
  id: string;
  sessionId: string;
  userAddress: string;
  type: 'mint' | 'claim' | 'donate' | 'swap' | 'other';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  steps: TransactionStep[];
  mockUsdCost?: string;
  gasUsed?: string;
  nftName?: string;
  timestamp: number;
  completedAt?: number;
}

// ─── User & Session ────────────────────────────────────────────────────────────

export interface UserSession {
  id: string;
  userAddress: string;
  startedAt: number;
  lastActivityAt: number;
  metadata?: Record<string, any>;
}

export interface AIResponse {
  steps: {
    message: string;
    delayMs: number;
  }[];
  transactionSteps: TransactionStep[];
  nftName?: string;
}

// ─── API Requests & Responses ──────────────────────────────────────────────────

export interface ChatRequest {
  sessionId: string;
  userAddress: string;
  message: string;
}

export interface ChatResponse {
  messageId: string;
  aiSteps: {
    message: string;
    delayMs: number;
  }[];
  transactionSteps?: TransactionStep[];
  transactionId?: string;
}

export interface TransactionRequest {
  sessionId: string;
  userAddress: string;
  type: string;
  subject?: string;
}

export interface IntentParseResult {
  intent: 'mint' | 'claim' | 'donate' | 'swap' | 'history' | 'balance' | 'generic';
  subject: string;
  amount: number | null;
  recipient: string | null;
  confidence: number;
}
