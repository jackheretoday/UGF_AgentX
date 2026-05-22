// WalletConnect Project ID: get a free one at https://cloud.walletconnect.com
// Create project → copy Project ID → paste in .env.local as VITE_WALLETCONNECT_PROJECT_ID

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { createConfig, WagmiProvider, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { WalletAuthSync } from './WalletAuthSync';

/** Matches the browser origin in dev; set VITE_APP_URL in production. */
function getAppUrl(): string {
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export const wagmiConfig = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(),
    },

    // Required API Keys
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '',

    // Required App Info
    appName: 'UGF AgentX',

    // Optional App Info
    appDescription: 'AI Blockchain Assistant',
    appUrl: getAppUrl(),
    appIcon: 'https://family.co/logo.png', // Replace with your app's icon

    // Stops Coinbase SDK calls to cca-lite.coinbase.com (often blocked by ad blockers)
    coinbaseWalletPreference: {
      options: 'all',
      telemetry: false,
    },
  }),
);

const queryClient = new QueryClient();

export const Web3Provider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initAave = async () => {
      const sdk = (window as any).AaveAccountSdk;
      if (sdk) {
        try {
          await sdk.connect();
          console.log('[Web3Provider] Aave Account SDK connected');
        } catch (error) {
          console.warn('[Web3Provider] Aave Account SDK connection error:', error);
        }
      }
      setIsReady(true);
    };
    initAave();
  }, []);

  if (!isReady) {
    return (
      <div className="h-screen w-screen bg-[#0A0A0B] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin" />
        <p className="text-[10px] text-[#52525B] font-bold uppercase tracking-[0.2em]">Establishing Secure Connection</p>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="midnight"
          customTheme={{
            '--ck-qr-background': '#ffffff',
            '--ck-qr-dot-color': '#000000',
            '--ck-qr-border-color': '#ffffff',
          }}
        >
          <WalletAuthSync />
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
