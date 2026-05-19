import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_TYPE,
  TYI_USD_PAYMENT_COIN,
  UGFClient,
} from '@tychilabs/ugf-testnet-js';
import { JsonRpcProvider, Wallet } from 'ethers';
import { logger } from '../utils/logger.js';

export class UgfStepError extends Error {
  constructor(
    public step: 'quote' | 'settle' | 'execute' | 'confirm',
    message: string,
    public data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'UgfStepError';
  }
}

const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

let cachedClient: UGFClient | null = null;

function getClient(): UGFClient {
  if (cachedClient) return cachedClient;
  const token = process.env.UGF_API_KEY;
  cachedClient = token ? new UGFClient({ token }) : new UGFClient();
  return cachedClient;
}

function getSigner(userWallet: string): Wallet {
  const privateKey =
    process.env.UGF_SIGNER_PRIVATE_KEY ||
    process.env.UGF_PRIVATE_KEY ||
    process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('Missing UGF signer private key');
  }

  const provider = new JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  const signer = new Wallet(privateKey, provider);

  if (userWallet && signer.address.toLowerCase() !== userWallet.toLowerCase()) {
    throw new Error('Signer address does not match user wallet');
  }

  return signer;
}

function toIsoTimestamp(expiresAt: unknown): string | null {
  if (expiresAt === null || expiresAt === undefined) return null;
  const value = typeof expiresAt === 'string' ? Number(expiresAt) : Number(expiresAt);
  if (!Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function parseUsdAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeStatus(value: unknown): 'success' | 'failed' | 'pending' {
  const raw = String(value ?? '').toLowerCase();
  if (['success', 'completed', 'confirmed', 'done', 'ok'].includes(raw)) return 'success';
  if (['failed', 'error', 'reverted', 'expired'].includes(raw)) return 'failed';
  return 'pending';
}

async function fetchStatus(client: UGFClient, digest: string): Promise<Record<string, unknown>> {
  const statusApi = client.status as unknown as {
    get: (arg: unknown) => Promise<Record<string, unknown>>;
  };
  if (!statusApi || typeof statusApi.get !== 'function') {
    throw new Error('UGF status API not available');
  }
  try {
    return await statusApi.get({ digest });
  } catch {
    return await statusApi.get(digest);
  }
}

async function pollStatus(
  client: UGFClient,
  digest: string,
  timeoutMs = 30000,
  intervalMs = 2000
): Promise<{
  status: 'success' | 'failed' | 'pending';
  txHash: string | null;
  blockNumber: number | null;
  confirmedAt: string | null;
}> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const statusResponse = await fetchStatus(client, digest);
    const normalized = normalizeStatus(
      statusResponse?.status ??
        statusResponse?.tx_status ??
        statusResponse?.state ??
        statusResponse?.stage
    );

    const txHash =
      (statusResponse?.user_tx_hash as string | undefined) ??
      (statusResponse?.tx_hash as string | undefined) ??
      (statusResponse?.userTxHash as string | undefined) ??
      null;

    const blockNumber =
      (statusResponse?.block_number as number | undefined) ??
      (statusResponse?.blockNumber as number | undefined) ??
      null;

    const confirmedAt =
      (statusResponse?.confirmed_at as string | undefined) ??
      (statusResponse?.completed_at as string | undefined) ??
      (statusResponse?.confirmedAt as string | undefined) ??
      null;

    if (normalized !== 'pending') {
      return {
        status: normalized,
        txHash,
        blockNumber: blockNumber ? Number(blockNumber) : null,
        confirmedAt: confirmedAt ? String(confirmedAt) : null,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    status: 'pending',
    txHash: null,
    blockNumber: null,
    confirmedAt: null,
  };
}

export type UgfFlowPayload = {
  from: string;
  to: string;
  data: `0x${string}`;
  value?: string | bigint;
};

export type UgfFlowResult = {
  quoteId: string;
  estimatedGasFeeUSD: number;
  expiresAt: string | null;
  settlementId: string;
  txId: string;
  txHash: string | null;
  status: 'success';
  blockNumber: number | null;
  confirmedAt: string | null;
};

export async function executeUgfFlow(payload: UgfFlowPayload): Promise<UgfFlowResult> {
  const client = getClient();
  let signer: Wallet;

  try {
    signer = getSigner(payload.from);
  } catch (error) {
    logger.error('UGF signer initialization failed', error);
    throw new UgfStepError('quote', 'Failed to get UGF quote');
  }

  try {
    await client.auth.login(signer);
  } catch (error) {
    logger.warn('UGF auth failed', error);
    throw new UgfStepError('quote', 'Failed to get UGF quote');
  }

  let quote: Awaited<ReturnType<UGFClient['quote']['get']>>;
  try {
    const value =
      payload.value === undefined
        ? '0'
        : typeof payload.value === 'bigint'
          ? payload.value.toString()
          : String(payload.value);

    quote = await client.quote.get({
      payment_coin: TYI_USD_PAYMENT_COIN,
      payer_address: payload.from,
      payment_chain: BASE_SEPOLIA_CHAIN_ID,
      payment_chain_type: BASE_SEPOLIA_CHAIN_TYPE,
      tx_object: JSON.stringify({
        from: payload.from,
        to: payload.to,
        data: payload.data,
        value,
      }),
      dest_chain_id: BASE_SEPOLIA_CHAIN_ID,
      dest_chain_type: BASE_SEPOLIA_CHAIN_TYPE,
    });
  } catch (error) {
    logger.warn('UGF quote failed', error);
    throw new UgfStepError('quote', 'Failed to get UGF quote');
  }

  const quoteId = String(quote?.digest ?? '');
  const estimatedGasFeeUSD = parseUsdAmount(quote?.payment_amount ?? quote?.gas_amount);
  const expiresAt = toIsoTimestamp(quote?.expires_at);

  try {
    if (quote?.payment_mode === 'vault') {
      await client.payment.vault.payAndSubmit(
        quote,
        signer,
        BASE_SEPOLIA_CHAIN_ID,
        TYI_USD_PAYMENT_COIN
      );
    } else {
      await client.payment.x402.execute({
        quote,
        signer,
        token: TYI_USD_PAYMENT_COIN,
      });
    }
  } catch (error) {
    logger.warn('UGF settlement failed', error);
    throw new UgfStepError('settle', 'Mock USD settlement failed', {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
    });
  }

  let txHash: string | null = null;

  try {
    const value =
      payload.value === undefined
        ? 0n
        : typeof payload.value === 'bigint'
          ? payload.value
          : BigInt(payload.value);

    const execution = await client.chains.evm.sponsorAndExecute(quoteId, signer, async () => ({
      to: payload.to,
      data: payload.data,
      value,
    }));

    txHash = (execution as { userTxHash?: string })?.userTxHash ?? null;
  } catch (error) {
    logger.warn('UGF execution failed', error);
    throw new UgfStepError('execute', 'Transaction execution failed', {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
      settlementId: quoteId,
      txId: quoteId,
      txHash,
    });
  }

  const statusResult = await pollStatus(client, quoteId, 30000, 2000);

  if (statusResult.status === 'pending') {
    throw new UgfStepError('confirm', 'Confirmation timeout', {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
      settlementId: quoteId,
      txId: quoteId,
      txHash,
      status: 'pending',
    });
  }

  if (statusResult.status === 'failed') {
    throw new UgfStepError('execute', 'Transaction execution failed', {
      quoteId,
      estimatedGasFeeUSD,
      expiresAt,
      settlementId: quoteId,
      txId: quoteId,
      txHash: statusResult.txHash ?? txHash,
      status: 'failed',
      blockNumber: statusResult.blockNumber,
      confirmedAt: statusResult.confirmedAt,
    });
  }

  return {
    quoteId,
    estimatedGasFeeUSD,
    expiresAt,
    settlementId: quoteId,
    txId: quoteId,
    txHash: statusResult.txHash ?? txHash,
    status: 'success',
    blockNumber: statusResult.blockNumber,
    confirmedAt: statusResult.confirmedAt,
  };
}
