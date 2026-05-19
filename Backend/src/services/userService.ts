import { getAddress } from 'viem';
import { supabaseAdmin } from '../config/supabase.js';

export type DbUser = {
  id: string;
  wallet_address: string;
  username: string | null;
  auth_type: string | null;
  mockusd_balance: number | null;
  eth_balance: number | null;
  total_transactions: number | null;
  total_nfts: number | null;
  last_active: string | null;
};

export function normalizeWalletAddress(walletAddress: string): string {
  return getAddress(walletAddress);
}

export async function ensureUser(walletAddress: string): Promise<DbUser> {
  const normalized = normalizeWalletAddress(walletAddress);

  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert(
      {
        wallet_address: normalized,
        last_active: new Date().toISOString(),
        auth_type: 'wallet',
      },
      { onConflict: 'wallet_address' }
    )
    .select(
      'id, wallet_address, username, auth_type, mockusd_balance, eth_balance, total_transactions, total_nfts, last_active'
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Failed to resolve user');
  }

  return data as DbUser;
}

export async function getUserIdByWallet(walletAddress: string): Promise<string | null> {
  const normalized = normalizeWalletAddress(walletAddress);

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('wallet_address', normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}
