import React from 'react';
import { Sidebar } from './components/sidebar/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { WalletPanel } from './components/wallet/WalletPanel';
import { Web3Provider } from './components/Web3Provider';

function AppContent() {
  return (
    <div className="flex h-screen w-full bg-[#050505] overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex min-w-0">
        <ChatArea />
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
