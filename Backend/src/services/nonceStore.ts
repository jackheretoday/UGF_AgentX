type NonceEntry = {
  nonce: string;
  expiresAt: number;
};

const nonceMap = new Map<string, NonceEntry>();

const NONCE_TTL_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

export function buildLoginMessage(uuid: string): string {
  return `Sign this message to login to UGF AgentX: ${uuid}`;
}

export function setNonce(walletAddress: string, message: string): void {
  nonceMap.set(walletAddress.toLowerCase(), {
    nonce: message,
    expiresAt: Date.now() + NONCE_TTL_MS,
  });
}

export function getNonce(walletAddress: string): NonceEntry | undefined {
  const entry = nonceMap.get(walletAddress.toLowerCase());
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    nonceMap.delete(walletAddress.toLowerCase());
    return undefined;
  }
  return entry;
}

export function deleteNonce(walletAddress: string): void {
  nonceMap.delete(walletAddress.toLowerCase());
}

export function cleanupExpiredNonces(): void {
  const now = Date.now();
  for (const [key, entry] of nonceMap.entries()) {
    if (entry.expiresAt < now) {
      nonceMap.delete(key);
    }
  }
}

setInterval(cleanupExpiredNonces, CLEANUP_INTERVAL_MS).unref();
