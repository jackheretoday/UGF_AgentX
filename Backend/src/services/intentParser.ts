import { IntentParseResult } from '../types/index.js';

// ─── Intent Definitions ────────────────────────────────────────────────────────

export type IntentType = 'mint' | 'claim' | 'donate' | 'swap' | 'history' | 'balance' | 'generic';

interface IntentKeywords {
  keywords: string[];
  aliases: string[];
}

const INTENT_KEYWORDS: Record<IntentType, IntentKeywords> = {
  mint: {
    keywords: ['mint', 'create', 'generate', 'issue'],
    aliases: ['badge', 'nft', 'token', 'certificate'],
  },
  claim: {
    keywords: ['claim', 'receive', 'get', 'redeem'],
    aliases: ['certificate', 'reward', 'badge', 'benefit'],
  },
  donate: {
    keywords: ['donate', 'send', 'transfer', 'give'],
    aliases: ['usd', 'payment', 'contribution', 'fund'],
  },
  swap: {
    keywords: ['swap', 'exchange', 'convert', 'trade'],
    aliases: ['eth', 'usdc', 'token', 'currency'],
  },
  history: {
    keywords: ['history', 'past', 'previous', 'list'],
    aliases: ['transactions', 'activity', 'records'],
  },
  balance: {
    keywords: ['balance', 'wallet', 'funds', 'check'],
    aliases: ['eth', 'usdc', 'holdings', 'assets'],
  },
  generic: {
    keywords: [],
    aliases: [],
  },
};

// ─── Intent Detection ──────────────────────────────────────────────────────────

export function detectIntent(prompt: string): IntentType {
  const p = prompt.toLowerCase();

  for (const [intent, { keywords, aliases }] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === 'generic') continue;

    // Check if any keyword matches
    const hasKeyword = keywords.some((kw) => p.includes(kw));
    if (hasKeyword) {
      // Optionally check for aliases for confirmation
      return intent as IntentType;
    }

    // Check if aliases appear (as secondary confirmation)
    const hasAlias = aliases.some((alias) => p.includes(alias));
    if (hasAlias && keywords.length === 0) {
      return intent as IntentType;
    }
  }

  return 'generic';
}

// ─── Extract Subject (Who/What) ────────────────────────────────────────────────

export function extractSubject(prompt: string): string {
  // Try to find "for <name>"
  const forMatch = prompt.match(/for\s+([A-Za-z]+)/i);
  if (forMatch) return forMatch[1];

  // Try to find a capitalized word that isn't a command word
  const cmdWords = ['mint', 'claim', 'donate', 'swap', 'get', 'send', 'nft', 'badge', 'usd'];
  const words = prompt.split(/\s+/);
  const subject = words.find(
    (w) => w.length > 2 && /^[A-Z]/.test(w) && !cmdWords.includes(w.toLowerCase())
  );

  return subject ?? 'User';
}

// ─── Extract Amount ────────────────────────────────────────────────────────────

export function extractAmount(prompt: string): number | null {
  // Look for patterns like "5 USD", "5USD", "$5", "5.00"
  const amountMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(usd|eth|usdc)?/i);
  if (amountMatch) {
    return parseFloat(amountMatch[1]);
  }
  return null;
}

// ─── Extract Recipient ─────────────────────────────────────────────────────────

export function extractRecipient(prompt: string): string | null {
  // Look for patterns like "to <name>", "recipient <name>", etc.
  const toMatch = prompt.match(/(?:to|for|recipient)\s+([A-Za-z]+)/i);
  if (toMatch) return toMatch[1];

  // Look for wallet addresses
  const addressMatch = prompt.match(/0x[a-fA-F0-9]{40}/);
  if (addressMatch) return addressMatch[0];

  return null;
}

// ─── Main Parser Function ──────────────────────────────────────────────────────

export function parseUserIntent(prompt: string): IntentParseResult {
  const intent = detectIntent(prompt);
  const subject = extractSubject(prompt);
  const amount = extractAmount(prompt);
  const recipient = extractRecipient(prompt);

  // Calculate confidence based on how many details we found
  let confidence = 0.5; // base confidence
  if (intent !== 'generic') confidence += 0.3;
  if (subject !== 'User') confidence += 0.1;
  if (amount !== null) confidence += 0.1;

  return {
    intent,
    subject,
    amount,
    recipient,
    confidence: Math.min(confidence, 1),
  };
}

// ─── Intent-Based Response Mapper ─────────────────────────────────────────────

export function getIntentContext(intent: IntentType): {
  displayName: string;
  description: string;
  requiresAmount: boolean;
  requiresRecipient: boolean;
} {
  const contexts = {
    mint: {
      displayName: 'NFT Minting',
      description: 'Creating and issuing a new NFT badge',
      requiresAmount: false,
      requiresRecipient: true,
    },
    claim: {
      displayName: 'Claim Reward',
      description: 'Claiming an earned reward or certificate',
      requiresAmount: false,
      requiresRecipient: false,
    },
    donate: {
      displayName: 'Donation',
      description: 'Sending funds to support a cause',
      requiresAmount: true,
      requiresRecipient: true,
    },
    swap: {
      displayName: 'Token Swap',
      description: 'Exchanging one token for another',
      requiresAmount: true,
      requiresRecipient: false,
    },
    history: {
      displayName: 'Transaction History',
      description: 'Viewing past transactions and activities',
      requiresAmount: false,
      requiresRecipient: false,
    },
    balance: {
      displayName: 'Check Balance',
      description: 'Viewing current wallet balance',
      requiresAmount: false,
      requiresRecipient: false,
    },
    generic: {
      displayName: 'General Question',
      description: 'General inquiry or question',
      requiresAmount: false,
      requiresRecipient: false,
    },
  };

  return contexts[intent];
}

// ─── Validation ────────────────────────────────────────────────────────────────

export function validateIntent(parsed: IntentParseResult): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const context = getIntentContext(parsed.intent);

  if (context.requiresRecipient && !parsed.recipient && parsed.subject === 'User') {
    errors.push('Please specify who should receive this action');
  }

  if (context.requiresAmount && parsed.amount === null) {
    errors.push('Please specify an amount');
  }

  if (parsed.confidence < 0.3) {
    errors.push('Intent unclear. Please rephrase your request');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
