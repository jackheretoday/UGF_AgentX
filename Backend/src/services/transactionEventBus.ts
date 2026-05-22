import { EventEmitter } from 'events';
import type { TransactionStatusEvent } from '../types/transaction.js';

const bus = new EventEmitter();
bus.setMaxListeners(200);

export function emitTransactionStatus(event: TransactionStatusEvent): void {
  bus.emit(`tx:${event.transactionId}`, event);
  bus.emit('tx:*', event);
}

export function subscribeTransaction(
  transactionId: string,
  listener: (event: TransactionStatusEvent) => void
): () => void {
  const channel = `tx:${transactionId}`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}
