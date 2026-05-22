import {
  fetchTransactionStatus,
  subscribeTransactionEvents,
  type TransactionStatusDto,
} from './api';

const POLL_INTERVAL_MS = 2_000;

export type TransactionTrackCallbacks = {
  onUpdate: (status: TransactionStatusDto) => void;
  onTerminal?: (status: TransactionStatusDto) => void;
  onError?: (error: Error) => void;
};

function isTerminal(status: TransactionStatusDto['status']): boolean {
  return status === 'confirmed' || status === 'failed';
}

export function trackTransaction(
  transactionId: string,
  callbacks: TransactionTrackCallbacks
): () => void {
  let stopped = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribeSse: (() => void) | null = null;

  const handleStatus = (payload: TransactionStatusDto) => {
    callbacks.onUpdate(payload);
    if (isTerminal(payload.status)) {
      callbacks.onTerminal?.(payload);
      cleanup();
    }
  };

  const poll = async () => {
    if (stopped) return;
    try {
      const status = await fetchTransactionStatus(transactionId);
      handleStatus(status);
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const cleanup = () => {
    stopped = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    unsubscribeSse?.();
    unsubscribeSse = null;
  };

  void poll();

  unsubscribeSse = subscribeTransactionEvents(transactionId, {
    onStatus: handleStatus,
    onError: () => {
      if (!pollTimer) {
        pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
      }
    },
  });

  if (!pollTimer) {
    pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  }

  return cleanup;
}
