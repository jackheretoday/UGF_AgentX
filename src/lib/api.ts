// ─── API Client for Backend Integration ───────────────────────────────────────

import { getStoredToken, clearAuthSession } from './authStorage';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export interface AuthUser {
  id: string;
  walletAddress: string;
  mockusdBalance: number;
  ethBalance: number;
  totalTransactions: number;
  totalNfts: number;
}

export interface AuthVerifyResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
}

export interface ChatAiStep {
  message: string;
  delayMs: number;
}

export interface ChatTransactionStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error' | 'in-progress';
  txHash?: string;
  detail?: string;
}

export interface ChatGasEstimate {
  mockUSD: number;
  currency?: string;
  breakdown?: string;
  note?: string;
}

export interface ChatResponse {
  messageId: string;
  aiSteps: ChatAiStep[];
  transactionSteps: ChatTransactionStep[];
  transactionId?: string;
  intent?: string;
  gasEstimate?: ChatGasEstimate | null;
  tokenURI?: string | null;
  recipient?: string | null;
  amount?: number | null;
  metadata?: {
    intent: string;
    subject: string;
    recipient: string | null;
    amount: number | null;
    confidence: number;
    gasUsed: string;
    mockUsdCost: string;
    txHash: string;
    blockNumber: number;
  };
  sessionId?: string;
  txHash?: string | null;
  blockNumber?: number | null;
  confirmedAt?: string | null;
  executionStatus?: 'success' | 'failed' | 'skipped';
}

interface ChatResponseV2 {
  success: boolean;
  reply: string;
  intent?: string;
  recipient?: string | null;
  amount?: number | null;
  confidence?: string;
  tokenURI?: string | null;
  gasEstimate?: ChatGasEstimate | null;
  aiSteps?: ChatAiStep[];
  transactionSteps?: ChatTransactionStep[];
  sessionId?: string;
  transactionId?: string;
  txHash?: string | null;
  blockNumber?: number | null;
  confirmedAt?: string | null;
  executionStatus?: 'success' | 'failed' | 'skipped';
}

type ApiFetchOptions = RequestInit & {
  token?: string | null;
  skipAuth?: boolean;
};

function mapIntentToLegacy(intent?: string): string {
  const map: Record<string, string> = {
    MINT_BADGE: 'mint',
    CLAIM_CERT: 'claim',
    DONATE: 'donate',
    SEND_REWARD: 'send_reward',
  };
  return map[intent ?? ''] ?? 'generic';
}

function normalizeTransactionStep(step: ChatTransactionStep): ChatTransactionStep {
  const status =
    step.status === 'in-progress'
      ? 'active'
      : step.status;

  return {
    ...step,
    status,
    detail: step.detail ?? '',
  };
}

function toLegacyResponse(payload: unknown): ChatResponse {
  if (payload && typeof payload === 'object' && 'aiSteps' in payload && 'transactionSteps' in payload) {
    const legacy = payload as ChatResponse;
    return {
      ...legacy,
      transactionSteps: (legacy.transactionSteps ?? []).map(normalizeTransactionStep),
    };
  }

  const v2 = payload as ChatResponseV2;
  if (!v2 || typeof v2.reply !== 'string') {
    throw new Error('Unexpected chat response shape');
  }

  const aiSteps =
    v2.aiSteps && v2.aiSteps.length > 0
      ? v2.aiSteps
      : [{ message: v2.reply, delayMs: 400 }];

  const transactionSteps = (v2.transactionSteps ?? []).map(normalizeTransactionStep);
  const mockUsd = v2.gasEstimate?.mockUSD;

  return {
    messageId: `msg_${Date.now()}`,
    aiSteps,
    transactionSteps,
    sessionId: v2.sessionId,
    transactionId: v2.transactionId,
    intent: v2.intent,
    gasEstimate: v2.gasEstimate ?? null,
    tokenURI: v2.tokenURI ?? null,
    recipient: v2.recipient ?? null,
    amount: v2.amount ?? null,
    txHash: v2.txHash ?? null,
    blockNumber: v2.blockNumber ?? null,
    confirmedAt: v2.confirmedAt ?? null,
    executionStatus: v2.executionStatus ?? 'skipped',
    metadata: {
      intent: mapIntentToLegacy(v2.intent),
      subject: v2.recipient ?? 'User',
      recipient: v2.recipient ?? null,
      amount: v2.amount ?? null,
      confidence: v2.confidence === 'rule-based' ? 1 : v2.confidence === 'GeminiAI' ? 0.85 : 0.5,
      gasUsed: mockUsd !== undefined ? String(mockUsd) : '',
      mockUsdCost: mockUsd !== undefined ? String(mockUsd) : '',
      txHash: v2.txHash || '',
      blockNumber: v2.blockNumber || 0,
    },
  };
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token = getStoredToken(), skipAuth = false, ...init } = options;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401 && !skipAuth) {
    clearAuthSession();
    const message =
      (payload as { error?: string }).error || 'Session expired. Please reconnect your wallet.';
    throw new Error(message);
  }

  if (!response.ok) {
    const message =
      (payload as { error?: string }).error ||
      (payload as { message?: string }).message ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function requestAuthNonce(walletAddress: string): Promise<{ nonce: string }> {
  return apiFetch<{ nonce: string }>('/api/auth/nonce', {
    method: 'POST',
    body: JSON.stringify({ walletAddress }),
    skipAuth: true,
  });
}

export async function verifyAuthSignature(
  walletAddress: string,
  signature: string
): Promise<AuthVerifyResponse> {
  return apiFetch<AuthVerifyResponse>('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, signature }),
    skipAuth: true,
  });
}

export async function submitChatMessage(req: ChatRequest): Promise<ChatResponse> {
  const payload = await apiFetch<unknown>('/api/chat', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return toLegacyResponse(payload);
}

export interface ChatSessionDto {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messageCount?: number;
}

export interface DbChatMessage {
  id: string;
  session_id: string;
  sender: string;
  message: string;
  message_type?: string;
  created_at: string;
}

export async function fetchChatSessions(
  walletAddress: string
): Promise<{ success: boolean; sessions: ChatSessionDto[] }> {
  return apiFetch(`/api/chat/sessions?walletAddress=${encodeURIComponent(walletAddress)}`, {
    method: 'GET',
  });
}

export async function deleteChatSession(sessionId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function loadSessionHistory(sessionId: string): Promise<DbChatMessage[]> {
  const payload = await apiFetch<{ success?: boolean; messages?: DbChatMessage[] }>(
    `/api/chat/history/${sessionId}`,
    { method: 'GET' }
  );
  return payload.messages ?? [];
}

export async function getChatHistory(sessionId: string): Promise<DbChatMessage[]> {
  try {
    return await loadSessionHistory(sessionId);
  } catch (error) {
    console.error('Chat history error:', error);
    return [];
  }
}

export async function createTransaction(body: {
  walletAddress: string;
  actionType: string;
  status?: string;
  txHash?: string;
  gasFeeMockUsd?: number;
  contractAddress?: string;
  blockNumber?: number;
}): Promise<{ transactionId: string; status: string; createdAt: string }> {
  return apiFetch('/api/transaction', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchGallery(walletAddress: string): Promise<{ badges: unknown[] }> {
  return apiFetch(`/api/gallery/${walletAddress}`, { method: 'GET' });
}

export interface DbTransactionRow {
  id: string;
  action_type: string;
  status: string;
  tx_hash?: string | null;
  gas_fee_mockusd?: number | null;
  network?: string | null;
  created_at: string;
}

export async function fetchTransactions(
  walletAddress: string
): Promise<{ transactions: DbTransactionRow[] }> {
  return apiFetch(`/api/transactions/${walletAddress}`, { method: 'GET' });
}

export async function fetchWalletSummary(walletAddress: string): Promise<{ wallet: AuthUser & Record<string, unknown> }> {
  return apiFetch(`/api/wallet?walletAddress=${encodeURIComponent(walletAddress)}`, {
    method: 'GET',
  });
}

export async function executeUgfTransaction(body: {
  intent: string;
  userWallet: string;
  recipient?: string | null;
  amount?: number | null;
  tokenURI?: string | null;
  sessionId: string;
}): Promise<Record<string, unknown>> {
  return apiFetch('/api/ugf/execute', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
