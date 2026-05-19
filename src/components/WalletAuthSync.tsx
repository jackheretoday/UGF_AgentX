import { useEffect, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { requestAuthNonce, verifyAuthSignature } from '../lib/api';
import { clearAuthSession, setStoredToken } from '../lib/authStorage';
import { showToast } from '../lib/toast';
import { useStore } from '../store/useStore';

function isUserRejectedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; code?: number; message?: string };
  return (
    e.name === 'UserRejectedRequestError' ||
    e.code === 4001 ||
    (e.message?.toLowerCase().includes('user rejected') ?? false) ||
    (e.message?.toLowerCase().includes('user denied') ?? false)
  );
}

function isNonceExpiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('nonce expired') || msg.includes('not found');
}

export function WalletAuthSync() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const setWalletStatus = useStore((s) => s.setWalletStatus);
  const loadTransactionHistory = useStore((s) => s.loadTransactionHistory);
  const clearTransactionHistory = useStore((s) => s.clearTransactionHistory);
  const loadChatSessions = useStore((s) => s.loadChatSessions);
  const setChatSessions = useStore((s) => s.setChatSessions);
  const wallet = useStore((s) => s.wallet);

  const authInFlight = useRef(false);
  const lastAddress = useRef<string | undefined>(undefined);

  useEffect(() => {
    const onUnauthorized = () => {
      clearTransactionHistory();
      setChatSessions([]);
      setWalletStatus({
        isConnected: false,
        address: null,
        token: null,
        ethBalance: '0',
        usdBalance: 0,
        nfts: [],
      });
      showToast('Session expired. Please reconnect your wallet.');
    };

    window.addEventListener('ugf:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ugf:unauthorized', onUnauthorized);
  }, [setWalletStatus, clearTransactionHistory, setChatSessions]);

  useEffect(() => {
    if (!isConnected || !address) {
      if (lastAddress.current) {
        clearAuthSession();
        clearTransactionHistory();
        setChatSessions([]);
        setWalletStatus({
          isConnected: false,
          address: null,
          token: null,
          ethBalance: '0',
          usdBalance: 0,
          nfts: [],
        });
        lastAddress.current = undefined;
      }
      return;
    }

    if (authInFlight.current || lastAddress.current === address) {
      return;
    }

    if (
      wallet.token &&
      wallet.address?.toLowerCase() === address.toLowerCase()
    ) {
      lastAddress.current = address;
      setWalletStatus({
        isConnected: true,
        address: wallet.address,
        token: wallet.token,
      });
      void loadTransactionHistory();
      void loadChatSessions();
      return;
    }

    const authenticate = async (retryOnExpired: boolean) => {
      authInFlight.current = true;

      try {
        const { nonce } = await requestAuthNonce(address);
        const signature = await signMessageAsync({
          account: address as `0x${string}`,
          message: nonce,
        });

        try {
          const result = await verifyAuthSignature(address, signature);

          if (!result.success || !result.token) {
            throw new Error('Authentication failed');
          }

          setStoredToken(result.token);
          setWalletStatus({
            isConnected: true,
            address: result.user.walletAddress,
            token: result.token,
            ethBalance: String(result.user.ethBalance ?? 0),
            usdBalance: result.user.mockusdBalance ?? 0,
          });
          lastAddress.current = address;
          await loadTransactionHistory();
          await loadChatSessions();
        } catch (verifyError) {
          if (!retryOnExpired && isNonceExpiredError(verifyError)) {
            await authenticate(true);
            return;
          }
          throw verifyError;
        }
      } catch (error) {
        if (isUserRejectedError(error)) {
          showToast('Signature rejected. Please sign to continue.');
        } else if (error instanceof Error) {
          console.error('[WalletAuthSync] Authentication failed:', error);
          showToast(error.message);
        }
        clearAuthSession();
        clearTransactionHistory();
        setWalletStatus({
          isConnected: false,
          address: null,
          token: null,
          ethBalance: '0',
          usdBalance: 0,
          nfts: [],
        });
        lastAddress.current = undefined;
      } finally {
        authInFlight.current = false;
      }
    };

    void authenticate(false);
  }, [
    isConnected,
    address,
    signMessageAsync,
    setWalletStatus,
    loadTransactionHistory,
    clearTransactionHistory,
    loadChatSessions,
    wallet.token,
    wallet.address,
  ]);

  return null;
}
