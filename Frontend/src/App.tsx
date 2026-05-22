import React from 'react';
import { Sidebar } from './components/sidebar/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { ActivityPage } from './components/activity/ActivityPage';
import { WalletPanel } from './components/wallet/WalletPanel';
import { Web3Provider } from './components/Web3Provider';
import { LoginPage } from './components/auth/LoginPage';
import { useStore } from './store/useStore';

function AppContent() {
  const { wallet, mainView } = useStore();

  if (!wallet.isConnected) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen w-full bg-[#050505] overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex min-w-0">
        {mainView === 'activity' ? <ActivityPage /> : <ChatArea />}
        <WalletPanel />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <AppContent />
    </Web3Provider>
  );
}
