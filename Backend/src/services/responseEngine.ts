// ─── Transaction timeline step definitions ─────────────────────────────────────

export interface AiStep {
  message: string;
  delayMs: number;
}

export type TimelineStepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface TransactionStep {
  id: string;
  label: string;
  status: TimelineStepStatus;
  txHash?: string;
  detail?: string;
}

export type ChatIntent =
  | 'MINT_BADGE'
  | 'CLAIM_CERT'
  | 'DONATE'
  | 'SEND_REWARD'
  | 'UNKNOWN'
  | string;

const MINT_BADGE_FLOW = {
  aiSteps: [
    { message: 'Got it! Preparing your badge mint...', delayMs: 400 },
    { message: 'Calculating gas fee in Mock USD...', delayMs: 800 },
    { message: 'Submitting to Base Sepolia via UGF...', delayMs: 600 },
  ],
  transactionSteps: [
    { id: 'quote', label: 'Getting UGF gas quote', status: 'pending' as const },
    { id: 'settle', label: 'Settling Mock USD payment', status: 'pending' as const },
    { id: 'execute', label: 'Executing mint on Base Sepolia', status: 'pending' as const },
    { id: 'confirm', label: 'Confirming transaction', status: 'pending' as const },
    { id: 'save', label: 'Saving badge to gallery', status: 'pending' as const },
  ],
};

const CLAIM_CERT_FLOW = {
  aiSteps: [
    { message: 'Processing your certificate claim...', delayMs: 400 },
    { message: 'Preparing gasless transaction via UGF...', delayMs: 800 },
    { message: 'Submitting to blockchain...', delayMs: 600 },
  ],
  transactionSteps: [
    { id: 'quote', label: 'Getting UGF gas quote', status: 'pending' as const },
    { id: 'settle', label: 'Settling Mock USD payment', status: 'pending' as const },
    { id: 'execute', label: 'Executing claim on Base Sepolia', status: 'pending' as const },
    { id: 'confirm', label: 'Confirming transaction', status: 'pending' as const },
    { id: 'save', label: 'Saving certificate to gallery', status: 'pending' as const },
  ],
};

const DONATE_FLOW = {
  aiSteps: [
    { message: 'Setting up your donation...', delayMs: 400 },
    { message: 'Calculating Mock USD gas cost...', delayMs: 700 },
    { message: 'Routing donation via UGF...', delayMs: 500 },
  ],
  transactionSteps: [
    { id: 'quote', label: 'Getting UGF gas quote', status: 'pending' as const },
    { id: 'settle', label: 'Settling Mock USD payment', status: 'pending' as const },
    { id: 'execute', label: 'Sending donation', status: 'pending' as const },
    { id: 'confirm', label: 'Confirming on-chain', status: 'pending' as const },
  ],
};

const SEND_REWARD_FLOW = {
  aiSteps: [
    { message: 'Preparing reward transaction...', delayMs: 400 },
    { message: 'Getting gas quote from UGF...', delayMs: 700 },
    { message: 'Submitting reward to Base Sepolia...', delayMs: 600 },
  ],
  transactionSteps: [
    { id: 'quote', label: 'Getting UGF gas quote', status: 'pending' as const },
    { id: 'settle', label: 'Settling Mock USD payment', status: 'pending' as const },
    { id: 'execute', label: 'Sending reward', status: 'pending' as const },
    { id: 'confirm', label: 'Confirming transaction', status: 'pending' as const },
    { id: 'save', label: 'Saving to records', status: 'pending' as const },
  ],
};

const UNKNOWN_FLOW = {
  aiSteps: [{ message: 'Let me help you with that...', delayMs: 400 }],
  transactionSteps: [] as TransactionStep[],
};

function cloneFlow(flow: {
  aiSteps: AiStep[];
  transactionSteps: TransactionStep[];
}): { aiSteps: AiStep[]; transactionSteps: TransactionStep[] } {
  return {
    aiSteps: flow.aiSteps.map((step) => ({ ...step })),
    transactionSteps: flow.transactionSteps.map((step) => ({ ...step })),
  };
}

/**
 * Returns AI chat steps and blockchain timeline steps for a parsed intent.
 */
export function getStepsForIntent(intent: string): {
  aiSteps: AiStep[];
  transactionSteps: TransactionStep[];
} {
  switch (intent) {
    case 'MINT_BADGE':
      return cloneFlow(MINT_BADGE_FLOW);
    case 'CLAIM_CERT':
      return cloneFlow(CLAIM_CERT_FLOW);
    case 'DONATE':
      return cloneFlow(DONATE_FLOW);
    case 'SEND_REWARD':
      return cloneFlow(SEND_REWARD_FLOW);
    case 'UNKNOWN':
    default:
      return cloneFlow(UNKNOWN_FLOW);
  }
}

// ─── Helpers (reserved for UGF execution wiring) ───────────────────────────────

export function generateMockTxHash(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  return '0x' + Array.from({ length: 64 }, hex).join('');
}

export function generateBlockNumber(): number {
  return Math.floor(18_000_000 + Math.random() * 500_000);
}

export function generateMockGasCost(): {
  gasUsedGwei: string;
  mockUsdCost: string;
} {
  return {
    gasUsedGwei: (Math.random() * 0.003 + 0.001).toFixed(6),
    mockUsdCost: (Math.random() * 0.15 + 0.05).toFixed(4),
  };
}
