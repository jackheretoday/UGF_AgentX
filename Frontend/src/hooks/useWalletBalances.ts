import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatEther } from 'viem';
import { useBalance } from 'wagmi';
import { fetchWalletSummary } from '../lib/api';
import { useStore } from '../store/useStore';

const ETH_PRICE_REFETCH_MS = 60_000;
const CHAIN_BALANCE_REFETCH_MS = 15_000;

async function fetchEthUsdPrice(): Promise<number> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
  );
  if (!res.ok) {
    throw new Error('Failed to fetch ETH price');
  }
  const data = (await res.json()) as { ethereum?: { usd?: number } };
  const price = data.ethereum?.usd;
  if (typeof price !== 'number') {
    throw new Error('Invalid ETH price response');
  }
  return price;
}

export function formatEthAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  if (amount < 0.0001) return amount.toFixed(6);
  if (amount < 1) return amount.toFixed(4);
  return amount.toFixed(4);
}

export function useWalletBalances(
  enabled: boolean,
  address: string | null,
  token: string | null
) {
  const setWalletStatus = useStore((s) => s.setWalletStatus);

  const {
    data: chainBalance,
    isLoading: chainLoading,
    isFetching: chainFetching,
    refetch: refetchChain,
  } = useBalance({
    address: address ? (address as `0x${string}`) : undefined,
    query: {
      enabled: enabled && Boolean(address),
      refetchInterval: CHAIN_BALANCE_REFETCH_MS,
    },
  });

  const profileQuery = useQuery({
    queryKey: ['wallet-profile', address],
    queryFn: () => fetchWalletSummary(address!),
    enabled: enabled && Boolean(address) && Boolean(token),
    refetchInterval: 30_000,
  });

  const priceQuery = useQuery({
    queryKey: ['eth-usd-price'],
    queryFn: fetchEthUsdPrice,
    staleTime: ETH_PRICE_REFETCH_MS,
    refetchInterval: ETH_PRICE_REFETCH_MS,
    retry: 2,
  });

  const ethAmount = chainBalance ? parseFloat(formatEther(chainBalance.value)) : 0;
  const mockUsd = Number(profileQuery.data?.wallet.mockusd_balance ?? 0);
  const ethUsd = ethAmount * (priceQuery.data ?? 0);
  const totalUsd = ethUsd + mockUsd;
  const ethDisplay = formatEthAmount(ethAmount);

  useEffect(() => {
    if (!enabled || !address) return;

    const profile = profileQuery.data?.wallet;
    setWalletStatus({
      ethBalance: ethDisplay,
      usdBalance: totalUsd,
      ...(profile
        ? {
            name: profile.username ?? undefined,
            authType: profile.auth_type === 'google' ? 'google' : 'wallet',
          }
        : {}),
    });
  }, [
    enabled,
    address,
    ethDisplay,
    totalUsd,
    profileQuery.data,
    setWalletStatus,
  ]);

  return {
    ethAmount,
    ethDisplay,
    usdTotal: totalUsd,
    ethUsdValue: ethUsd,
    mockUsdBalance: mockUsd,
    isLoading:
      (chainLoading && !chainBalance) || profileQuery.isLoading || priceQuery.isLoading,
    isRefreshing: chainFetching || profileQuery.isFetching,
    refetch: () => {
      void refetchChain();
      void profileQuery.refetch();
      void priceQuery.refetch();
    },
  };
}
