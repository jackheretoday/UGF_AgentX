import { MockTransaction } from '../types';

// ─── Mock Transaction Generator ───────────────────────────────────────────────

function generateTxHash(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  return '0x' + Array.from({ length: 64 }, hex).join('');
}

function generateBlockNumber(): number {
  return Math.floor(18_000_000 + Math.random() * 500_000);
}

export function createMockTransaction(nftName: string): MockTransaction {
  const gasUsedGwei = (Math.random() * 0.003 + 0.001).toFixed(6);
  const mockUsdCost = (Math.random() * 0.15 + 0.05).toFixed(4);
  return {
    txHash: generateTxHash(),
    gasUsed: gasUsedGwei,
    mockUsdCost,
    nftName,
    blockNumber: generateBlockNumber(),
    network: 'Base Sepolia',
  };
}

// ─── Intent Detection ──────────────────────────────────────────────────────────

export type IntentType =
  | 'mint'
  | 'claim'
  | 'donate'
  | 'swap'
  | 'history'
  | 'balance'
  | 'generic';

export function detectIntent(prompt: string): IntentType {
  const p = prompt.toLowerCase();
  if (p.includes('mint') || p.includes('badge') || p.includes('nft')) return 'mint';
  if (p.includes('claim') || p.includes('certificate')) return 'claim';
  if (p.includes('donate') || p.includes('donation')) return 'donate';
  if (p.includes('swap') || p.includes('exchange') || p.includes('convert')) return 'swap';
  if (p.includes('history') || p.includes('transactions') || p.includes('past')) return 'history';
  if (p.includes('balance') || p.includes('wallet') || p.includes('funds')) return 'balance';
  return 'generic';
}

// ─── Extract Subject from Prompt ──────────────────────────────────────────────

export function extractSubject(prompt: string): string {
  // Try to find "for <name>"
  const forMatch = prompt.match(/for\s+([A-Za-z]+)/i);
  if (forMatch) return forMatch[1];
  // Try to find a capitalized word that isn't a command word
  const cmdWords = ['Mint', 'Claim', 'Donate', 'Swap', 'Get', 'Send'];
  const words = prompt.split(' ');
  const subject = words.find(
    (w) => w.length > 2 && /^[A-Z]/.test(w) && !cmdWords.includes(w)
  );
  return subject ?? 'User';
}

// ─── Response Sequences ───────────────────────────────────────────────────────

export interface AiStep {
  message: string;
  delayMs: number;
  /** If truthy, attach the finalised mock transaction to this message */
  attachTx?: boolean;
}

export interface ResponseFlow {
  steps: AiStep[];
  transactionSteps: {
    id: string;
    label: string;
    detail: string;
  }[];
  /** NFT name to embed in mock transaction */
  nftName: (subject: string) => string;
}

export const responseFlows: Record<IntentType, ResponseFlow> = {
  mint: {
    nftName: (s) => `UGF Workshop Badge — ${s}`,
    transactionSteps: [
      { id: 'tx1', label: 'Verify User Membership', detail: 'Checking on-chain eligibility...' },
      { id: 'tx2', label: 'Prepare NFT Metadata', detail: 'Encoding IPFS metadata URI...' },
      { id: 'tx3', label: 'UGF Gas Estimation', detail: 'Mock USD gas quote received.' },
      { id: 'tx4', label: 'Sign & Broadcast', detail: 'Broadcasting to Base Sepolia...' },
      { id: 'tx5', label: 'Finalize Ownership', detail: 'Confirming on-chain...' },
    ],
    steps: [
      { message: 'Understanding request...', delayMs: 600 },
      { message: 'Preparing NFT transaction for minting.', delayMs: 1400 },
      { message: 'UGF gas quote received. Estimated cost: **$0.0023 Mock USD**.', delayMs: 1800 },
      { message: 'Gas will be paid using **Mock USD**. No native ETH required.', delayMs: 1500 },
      {
        message:
          'Transaction ready for execution. Broadcasting to **Base Sepolia**...',
        delayMs: 2000,
        attachTx: true,
      },
    ],
  },
  claim: {
    nftName: (s) => `UGF Certificate — ${s}`,
    transactionSteps: [
      { id: 'tx1', label: 'Verify Claim Eligibility', detail: 'Checking certificate merkle proof...' },
      { id: 'tx2', label: 'Prepare Claim Calldata', detail: 'Building on-chain call...' },
      { id: 'tx3', label: 'UGF Gas Estimation', detail: 'Mock USD gas quote ready.' },
      { id: 'tx4', label: 'Execute Claim', detail: 'Submitting to Base Sepolia...' },
    ],
    steps: [
      { message: 'Scanning certificate registry...', delayMs: 700 },
      { message: 'Claim eligibility confirmed for your address.', delayMs: 1200 },
      { message: 'Gas fee quoted: **$0.0018 Mock USD**.', delayMs: 1500 },
      {
        message: 'Claim transaction executed. Your certificate NFT is on its way!',
        delayMs: 2000,
        attachTx: true,
      },
    ],
  },
  donate: {
    nftName: () => 'UGF Donor Badge',
    transactionSteps: [
      { id: 'tx1', label: 'Validate Donation Amount', detail: 'Checking balance sufficiency...' },
      { id: 'tx2', label: 'Approve Mock USD Spend', detail: 'Sending ERC-20 approval...' },
      { id: 'tx3', label: 'Execute Transfer', detail: 'Transferring to UGF treasury...' },
    ],
    steps: [
      { message: 'Parsing donation request...', delayMs: 600 },
      { message: 'Mock USD balance confirmed. Preparing transfer.', delayMs: 1200 },
      { message: 'Executing donation via UGF smart contract...', delayMs: 1800 },
      {
        message: 'Donation complete! A **Donor Badge** NFT has been airdropped to your wallet.',
        delayMs: 2000,
        attachTx: true,
      },
    ],
  },
  swap: {
    nftName: () => 'N/A',
    transactionSteps: [
      { id: 'tx1', label: 'Fetch Price Quote', detail: 'Querying UGF DEX router...' },
      { id: 'tx2', label: 'Approve Token Spend', detail: 'Submitting approval calldata...' },
      { id: 'tx3', label: 'Execute Swap', detail: 'Routing through liquidity pool...' },
    ],
    steps: [
      { message: 'Fetching swap quote from UGF DEX...', delayMs: 700 },
      { message: 'Best route found. Slippage: **0.5%**.', delayMs: 1300 },
      { message: 'Approving token spend...', delayMs: 1500 },
      {
        message: 'Swap executed successfully. Tokens deposited to your wallet.',
        delayMs: 2000,
        attachTx: true,
      },
    ],
  },
  history: {
    nftName: () => 'N/A',
    transactionSteps: [],
    steps: [
      { message: 'Fetching transaction history from Base Sepolia...', delayMs: 800 },
      {
        message:
          'Found **2 recent transactions**:\n- ✅ SWAP ETH → USDC (2 hrs ago)\n- ❌ MINT UGF ORIGINS (yesterday, failed)\n\nWould you like to retry any of these?',
        delayMs: 1500,
      },
    ],
  },
  balance: {
    nftName: () => 'N/A',
    transactionSteps: [],
    steps: [
      { message: 'Reading wallet state on Base Sepolia...', delayMs: 700 },
      {
        message:
          'Your current balances:\n- **ETH:** 1.245\n- **Mock USD:** $420.69\n- **NFTs:** 2 items\n\nAll assets are on **Base Sepolia testnet**.',
        delayMs: 1200,
      },
    ],
  },
  generic: {
    nftName: () => 'N/A',
    transactionSteps: [],
    steps: [
      { message: 'Processing your request...', delayMs: 700 },
      {
        message:
          "I can help you **mint NFTs**, **claim certificates**, **donate**, **swap tokens**, or **check your balance**. What would you like to do?",
        delayMs: 1200,
      },
    ],
  },
};
