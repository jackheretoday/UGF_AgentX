export type MessageRole = 'user' | 'assistant' | 'system';

export interface MockTransaction {
  txHash: string;
  gasUsed: string;
  mockUsdCost: string;
  nftName: string;
  blockNumber: number;
  network: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  tokens?: number;
  isTyping?: boolean;
  transaction?: MockTransaction | null;
}

export interface TransactionStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  txHash?: string;
  detail?: string;
}

export interface TransactionState {
  id: string;
  type: string;
  steps: TransactionStep[];
  status: 'active' | 'completed' | 'failed';
  timestamp: number;
  mockTx?: MockTransaction;
}

export interface NFT {
  id: string;
  name: string;
  image: string;
  collection: string;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  ethBalance: string;
  usdBalance: number;
  nfts: NFT[];
}
