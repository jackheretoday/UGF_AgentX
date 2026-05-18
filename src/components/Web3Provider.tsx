import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { createConfig, WagmiProvider, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(),
    },

    // Required API Keys
    walletConnectProjectId: 'test',

    // Required App Info
    appName: 'UGF AgentX',

    // Optional App Info
    appDescription: 'AI Blockchain Assistant',
    appUrl: 'https://ugf-agentx.ai',
    appIcon: 'https://family.co/logo.png', // Replace with your app's icon
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
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider theme="midnight">
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
