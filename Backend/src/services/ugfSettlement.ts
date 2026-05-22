import {
  BASE_SEPOLIA_CHAIN_ID,
  TYI_USD_PAYMENT_COIN,
  UGFClient,
  type QuoteResponse,
} from '@tychilabs/ugf-testnet-js';
import { Contract, formatEther, JsonRpcProvider, Wallet } from 'ethers';
import { config, getGlobalUgfSignerAddress } from '../config/env.js';
import { logger } from '../utils/logger.js';

const GATEWAY_BASE_URL =
  process.env.UGF_GATEWAY_URL?.replace(/\/$/, '') || 'https://gateway.universalgasframework.com';

/** TYI mock USD on Base Sepolia uses 6 decimals (same as project donate calldata). */
export const TYI_MOCK_USD_DECIMALS = 6;

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

export type TyiBalanceInfo = {
  payerAddress: string;
  tokenAddress: string;
  symbol: string;
  decimals: number;
  balanceRaw: bigint;
  balanceFormatted: string;
};

export function formatTyiAmount(raw: bigint, decimals = TYI_MOCK_USD_DECIMALS): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  const num = fracStr ? `${whole}.${fracStr}` : whole.toString();
  return `${negative ? '-' : ''}${num} ${TYI_USD_PAYMENT_COIN}`;
}

export function parseGatewayErrorBody(body: unknown, status: number): string {
  if (body === null || body === undefined) {
    return `HTTP ${status} (empty response body)`;
  }
  if (typeof body === 'string') {
    return body.trim() || `HTTP ${status}`;
  }
  if (typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const candidates = [
      record.detail,
      record.error,
      record.message,
      record.reason,
      record.description,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (value && typeof value === 'object') {
        const nested = parseGatewayErrorBody(value, status);
        if (nested && !nested.startsWith('HTTP ')) return nested;
      }
    }
    try {
      return JSON.stringify(body);
    } catch {
      return `HTTP ${status}`;
    }
  }
  return String(body);
}

export function buildSettlementFailureMessage(params: {
  gatewayMessage: string;
  httpStatus: number;
  paymentMode: string;
  payerAddress: string;
  paymentAmountRaw: string;
  balance?: TyiBalanceInfo | null;
  gatewayBody?: unknown;
}): string {
  const required = formatTyiAmount(BigInt(params.paymentAmountRaw));
  const lines: string[] = [
    params.gatewayMessage,
    `HTTP ${params.httpStatus}`,
    `payment_mode=${params.paymentMode}`,
    `payer=${params.payerAddress}`,
    `required=${required} (${params.paymentAmountRaw} base units)`,
  ];

  if (params.balance) {
    lines.push(
      `tyi_balance=${params.balance.balanceFormatted} (${params.balance.balanceRaw.toString()} base units)`,
      `tyi_token=${params.balance.tokenAddress}`
    );
    if (params.balance.balanceRaw < BigInt(params.paymentAmountRaw)) {
      lines.push(
        'likely_cause=insufficient_TYI_MOCK_USD_on_signer',
        `fix=Fund TYI Mock USD for ${params.payerAddress} at https://universalgasframework.com/faucets`
      );
    }
  } else {
    lines.push(
      'likely_cause=insufficient_TYI_MOCK_USD_or_gateway_rejected_payment',
      `fix=Fund TYI Mock USD for ${params.payerAddress} at https://universalgasframework.com/faucets`
    );
  }

  if (params.gatewayBody !== undefined) {
    lines.push(`gateway_response=${JSON.stringify(params.gatewayBody)}`);
  }

  return lines.join(' | ');
}

export async function fetchTyiMockUsdBalance(
  client: UGFClient,
  payerAddress: string
): Promise<TyiBalanceInfo> {
  const entry = await client.registry.getChainEntry(TYI_USD_PAYMENT_COIN, BASE_SEPOLIA_CHAIN_ID);
  const provider = new JsonRpcProvider(config.baseSepoliaRpcUrl);
  const token = new Contract(entry.address, ERC20_ABI, provider);

  let decimals = TYI_MOCK_USD_DECIMALS;
  let symbol = TYI_USD_PAYMENT_COIN;
  try {
    decimals = Number(await token.decimals());
  } catch {
    // default
  }
  try {
    symbol = String(await token.symbol());
  } catch {
    // default
  }

  const balanceRaw = (await token.balanceOf(payerAddress)) as bigint;

  return {
    payerAddress,
    tokenAddress: entry.address,
    symbol,
    decimals,
    balanceRaw,
    balanceFormatted: formatTyiAmount(balanceRaw, decimals),
  };
}

export async function submitX402PaymentWithDetails(
  client: UGFClient,
  quote: QuoteResponse,
  signer: Wallet
): Promise<{ settlementResponse: Record<string, unknown>; gatewayBody: unknown }> {
  const provider = signer.provider;
  if (!provider) {
    throw new Error('Signer must have a provider attached');
  }

  const payload = await client.payment.x402.sign(quote, signer, provider);
  const token = client.auth.getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${GATEWAY_BASE_URL}/payment/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  let gatewayBody: unknown = rawText;
  try {
    gatewayBody = rawText ? JSON.parse(rawText) : null;
  } catch {
    // keep text
  }

  if (!res.ok) {
    const gatewayMessage = parseGatewayErrorBody(gatewayBody, res.status);
    const err = new Error(gatewayMessage) as Error & {
      statusCode?: number;
      code?: string;
      gatewayBody?: unknown;
    };
    err.statusCode = res.status;
    err.code = 'HTTP_ERROR';
    err.gatewayBody = gatewayBody;
    throw err;
  }

  return {
    settlementResponse: {
      mode: 'x402',
      result: typeof gatewayBody === 'object' && gatewayBody !== null ? gatewayBody : { raw: gatewayBody },
    },
    gatewayBody,
  };
}

export async function preflightTyiSettlement(
  client: UGFClient,
  quote: QuoteResponse,
  payerAddress: string
): Promise<{ balance: TyiBalanceInfo; shortfall: bigint } | null> {
  if (quote.payment_mode !== 'x402') {
    return null;
  }

  try {
    const balance = await fetchTyiMockUsdBalance(client, payerAddress);
    const required = BigInt(quote.payment_amount);
    const shortfall = balance.balanceRaw < required ? required - balance.balanceRaw : 0n;

    if (shortfall > 0n) {
      logger.warn('TYI Mock USD balance below quote payment_amount', {
        payer: payerAddress,
        required: required.toString(),
        balance: balance.balanceRaw.toString(),
        shortfall: shortfall.toString(),
        token: balance.tokenAddress,
      });
    }

    return { balance, shortfall };
  } catch (error) {
    logger.warn('Could not read TYI Mock USD balance (settlement may still be attempted)', error);
    return null;
  }
}

export async function diagnoseSignerSettlement(): Promise<void> {
  const payerAddress = getGlobalUgfSignerAddress();
  const client = new UGFClient();
  const provider = new JsonRpcProvider(config.baseSepoliaRpcUrl);
  const signer = new Wallet(config.ugfSignerPrivateKey.trim(), provider);

  console.log('\n=== UGF Settlement Diagnostics ===\n');
  console.log(`Signer (global payer): ${payerAddress}`);
  console.log(`Gateway: ${GATEWAY_BASE_URL}\n`);

  await client.auth.login(signer);
  console.log('UGF wallet login: OK\n');

  const balance = await fetchTyiMockUsdBalance(client, payerAddress);
  console.log('TYI Mock USD token:', balance.tokenAddress);
  console.log('Balance:', balance.balanceFormatted);
  console.log(`Basescan token: https://sepolia.basescan.org/token/${balance.tokenAddress}?a=${payerAddress}\n`);

  const ethBalance = await provider.getBalance(payerAddress);
  console.log(`Base Sepolia ETH: ${formatEther(ethBalance)}\n`);

  if (balance.balanceRaw === 0n) {
    console.log('⚠️  Zero TYI Mock USD — x402 settlement will return HTTP 400 until funded.');
    console.log('   Faucet: https://universalgasframework.com/faucets\n');
  }
}
