/** User-facing titles for on-chain activity types */
export const ACTIVITY_TITLES: Record<string, { title: string; subtitle: string }> = {
  CLAIM_CERT: {
    title: 'Claim Certificate',
    subtitle: 'NFT certificate minted to your wallet via UGF',
  },
  MINT_BADGE: {
    title: "Let's mint a badge for you!",
    subtitle: 'Badge NFT mint on Base Sepolia',
  },
  DONATE: {
    title: 'Donate',
    subtitle: 'Mock USD donation recorded on-chain',
  },
  SEND_REWARD: {
    title: 'Send Reward',
    subtitle: 'Reward transfer via UGF',
  },
};

export function getActivityDisplay(actionType: string): { title: string; subtitle: string } {
  const key = actionType.toUpperCase().replace(/\s+/g, '_');
  if (ACTIVITY_TITLES[key]) {
    return ACTIVITY_TITLES[key];
  }
  const fallback = actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { title: fallback, subtitle: 'On-chain activity via UGF AgentX' };
}

export const BASE_SEPOLIA_TX_URL = 'https://sepolia.basescan.org/tx';

export function buildBasescanTxUrl(txHash: string | null | undefined): string | null {
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/u.test(txHash)) {
    return null;
  }
  return `${BASE_SEPOLIA_TX_URL}/${txHash}`;
}
