import dotenv from 'dotenv';
import { Wallet } from 'ethers';
import { isAddress } from 'viem';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  // Supabase
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  frontendOrigins: (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // UGF — global server signer (pays gas, signs all UGF + chain txs); auth via wallet login only
  ugfSignerPrivateKey:
    process.env.UGF_SIGNER_PRIVATE_KEY ||
    process.env.UGF_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    '',
  /** Target contract for mintBadge/donate — not the UGF payer identity */
  nftContractAddress: process.env.NFT_CONTRACT_ADDRESS || '',
  baseSepoliaRpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  explorerTxUrlTemplate:
    process.env.EXPLORER_TX_URL_TEMPLATE || 'https://sepolia.basescan.org/tx/{txHash}',
  chainDisplayName: process.env.CHAIN_DISPLAY_NAME || 'Base Sepolia',
  /** `user` = connected wallet pays TYI Mock USD; `server` = UGF_SIGNER_PRIVATE_KEY pays */
  ugfPaymentWallet: (process.env.UGF_PAYMENT_WALLET || 'user').toLowerCase() === 'server'
    ? 'server'
    : 'user',
};

export function isUgfUserPayerMode(): boolean {
  return config.ugfPaymentWallet === 'user';
}

function isValidPrivateKey(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/i.test(value.trim());
}

/** Global UGF signer key is set (primary config). */
export function isUgfSignerConfigured(): boolean {
  const pk = config.ugfSignerPrivateKey.trim();
  return !!pk && isValidPrivateKey(pk);
}

/** Contract target is set (required to know where to send calldata). */
export function isNftContractConfigured(): boolean {
  const addr = config.nftContractAddress.trim();
  return !!addr && isAddress(addr);
}

/**
 * Ready for full on-chain execution (signer + deployed contract).
 * Backward-compatible alias used across the codebase.
 */
export function isUgfConfigured(): boolean {
  return isUgfSignerConfigured() && isNftContractConfigured();
}

/** Global payer/signer address from UGF_SIGNER_PRIVATE_KEY only. */
export function getGlobalUgfSignerAddress(): string {
  if (!isUgfSignerConfigured()) {
    throw new Error('UGF_SIGNER_PRIVATE_KEY is not configured');
  }
  return new Wallet(config.ugfSignerPrivateKey.trim()).address;
}

// Validate required env vars
export function validateConfig(): void {
  const required = ['GEMINI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

  const missing = required.filter((key) => !process.env[key]);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }

  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.warn('ℹ️  Copy .env.example to .env and fill in the values');
  }

  if (!isUgfSignerConfigured()) {
    console.warn('⚠️  UGF_SIGNER_PRIVATE_KEY missing or invalid — run: npm run generate:signer');
  } else {
    try {
      console.info(`ℹ️  UGF executor (contract owner tx): ${getGlobalUgfSignerAddress()}`);
      console.info(
        `ℹ️  UGF TYI payer: ${isUgfUserPayerMode() ? 'user connected wallet' : getGlobalUgfSignerAddress()}`
      );
    } catch {
      // ignore
    }
  }

  if (!isNftContractConfigured()) {
    console.warn('⚠️  NFT_CONTRACT_ADDRESS missing — set deployed Base Sepolia contract (call target only)');
  }

  if (!isUgfConfigured()) {
    console.warn('ℹ️  On-chain execution disabled until signer + NFT_CONTRACT_ADDRESS are both valid');
    console.warn('ℹ️  See Backend/docs/SETUP_UGF.md');
  }
}
