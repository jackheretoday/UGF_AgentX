export type MessageRole = 'user' | 'assistant' | 'system';

/** On-chain receipt shown only after backend confirmation */
export interface TransactionReceipt {
  txHash: string;
  explorerUrl: string;
  gasUsed: string;
  mockUsdCost: string;
  blockNumber: number;
  network: string;
  confirmedAt?: string;
  failureReason?: string;
  nftName?: string;
}

/** @deprecated Use TransactionReceipt */
export type MockTransaction = TransactionReceipt;

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  tokens?: number;
  isTyping?: boolean;
  transaction?: TransactionReceipt | null;
}

export interface TransactionStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  txHash?: string;
  detail?: string;
}

export interface GasEstimate {
  mockUSD: number;
  currency?: string;
  breakdown?: string;
  note?: string;
  chainName?: string;
  paymentCoin?: string;
  sponsorStatus?: string | null;
}

export interface TransactionState {
  id: string;
  type: string;
  intent?: string;
  steps: TransactionStep[];
  status: 'active' | 'completed' | 'failed';
  timestamp: number;
  startedAt?: number;
  gasEstimate?: GasEstimate | null;
  receipt?: TransactionReceipt;
  failureReason?: string | null;
}

export interface NFT {
  id: string;
  name: string;
  image: string;
  collection: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messageCount?: number;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  token: string | null;
  ethBalance: string;
  usdBalance: number;
  nfts: NFT[];
  authType?: 'wallet' | 'google';
  email?: string;
  name?: string;
  profilePicture?: string;
}
