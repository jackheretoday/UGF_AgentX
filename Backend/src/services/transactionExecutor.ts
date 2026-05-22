import { isAddress } from 'viem';
import {
  config,
  isUgfConfigured,
  isUgfUserPayerMode,
} from '../config/env.js';
import { logger } from '../utils/logger.js';
import { buildExplorerTxUrl } from './explorerService.js';
import { verifyTransactionReceipt } from './receiptVerificationService.js';
import { updateTransactionLifecycle } from './transactionStatusService.js';
import { buildSettlementFailureMessage } from './ugfSettlement.js';
import {
  executeUgfFlow,
  getUgfQuote,
  preflightPayerTyiBalance,
  resolveUgfQuoteParties,
  toUgfQuoteSnapshot,
  UgfStepError,
  type UgfFlowPayload,
  type UgfProgressHook,
  type UgfQuoteResult,
} from './ugfService.js';
import type { TransactionLifecycleStatus } from '../types/transaction.js';

export type OnChainExecutionInput = {
  transactionId: string;
  userWallet: string;
  calldata: `0x${string}`;
  contractAddress: string;
  onAssistantPatch?: (message: string) => Promise<void>;
};

export type OnChainExecutionResult = {
  status: 'confirmed' | 'failed' | 'skipped' | 'awaiting_settlement';
  txHash: string | null;
  blockNumber: number | null;
  confirmedAt: string | null;
  quoteId: string | null;
  gasFeeUSD: number | null;
  failureStep?: string;
  failureMessage?: string;
  explorerUrl?: string | null;
  ugfQuote?: Record<string, unknown>;
  payerAddress?: string;
  ugfContractAddress?: string;
  ugfCalldata?: string;
};

function buildUgfPayload(
  contractAddress: string,
  calldata: `0x${string}`,
  userWallet: string
): UgfFlowPayload {
  const parties = resolveUgfQuoteParties(userWallet);
  return {
    from: parties.executorAddress,
    to: contractAddress,
    data: calldata,
    value: '0',
  };
}

function stepToLifecycle(phase: Parameters<UgfProgressHook>[0]): TransactionLifecycleStatus {
  switch (phase) {
    case 'quote':
      return 'quoted';
    case 'settle':
      return 'settling';
    case 'execute':
      return 'executing';
    case 'mining':
      return 'mining';
    default:
      return 'pending';
  }
}

export async function prefetchLiveGasQuote(
  contractAddress: string,
  calldata: `0x${string}`,
  userWallet: string
): Promise<{ gasFeeUSD: number; quoteId: string } | null> {
  if (!isUgfConfigured() || !isAddress(contractAddress)) {
    return null;
  }

  try {
    const quote = await getUgfQuote(buildUgfPayload(contractAddress, calldata, userWallet), userWallet);
    return {
      gasFeeUSD: quote.estimatedGasFeeUSD,
      quoteId: quote.quoteId,
    };
  } catch (error) {
    logger.warn('Live gas quote prefetch failed', error);
    return null;
  }
}

async function failTransaction(
  input: OnChainExecutionInput,
  message: string,
  step: string = 'quote'
): Promise<OnChainExecutionResult> {
  await updateTransactionLifecycle(input.transactionId, {
    status: 'failed',
    current_step: step,
    failure_reason: message,
  });
  if (input.onAssistantPatch) {
    await input.onAssistantPatch(`⚠️ On-chain execution failed: ${message}`);
  }
  return {
    status: 'failed',
    txHash: null,
    blockNumber: null,
    confirmedAt: null,
    quoteId: null,
    gasFeeUSD: null,
    failureStep: step,
    failureMessage: message,
  };
}

/** Quote + check user TYI balance; browser must settle before continue. */
export async function prepareUserWalletSettlement(
  input: OnChainExecutionInput
): Promise<OnChainExecutionResult> {
  const contractAddress = input.contractAddress || config.nftContractAddress;
  if (!isAddress(contractAddress)) {
    return failTransaction(input, 'Invalid NFT contract address');
  }

  const payload = buildUgfPayload(contractAddress, input.calldata, input.userWallet);
  const parties = resolveUgfQuoteParties(input.userWallet);

  let quoteResult: UgfQuoteResult;
  try {
    quoteResult = await getUgfQuote(payload, input.userWallet);
  } catch (error) {
    const message =
      error instanceof UgfStepError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to get UGF quote';
    return failTransaction(input, message, error instanceof UgfStepError ? error.step : 'quote');
  }

  try {
    const preflight = await preflightPayerTyiBalance(quoteResult.quote, parties.payerAddress);
    if (preflight && preflight.shortfall > 0n) {
      const detail = buildSettlementFailureMessage({
        gatewayMessage: 'Insufficient TYI Mock USD on your connected wallet',
        httpStatus: 400,
        paymentMode: String(quoteResult.quote.payment_mode),
        payerAddress: parties.payerAddress,
        paymentAmountRaw: String(quoteResult.quote.payment_amount),
        balance: preflight.balance,
      });
      return failTransaction(
        input,
        `Fund TYI Mock USD on your wallet (${parties.payerAddress}) at https://universalgasframework.com/faucets — ${detail}`,
        'settle'
      );
    }
  } catch (error) {
    logger.warn('TYI preflight skipped', error);
  }

  await updateTransactionLifecycle(input.transactionId, {
    status: 'awaiting_settlement',
    current_step: 'settle',
    gas_fee_mockusd: quoteResult.estimatedGasFeeUSD,
    ugf_quote_id: quoteResult.quoteId,
    ugf_digest: quoteResult.quoteId,
    quote_response: {
      ...toUgfQuoteSnapshot(quoteResult.quote),
      _agentx: {
        calldata: input.calldata,
        contractAddress,
        userWallet: input.userWallet,
      },
    },
    payment_coin: 'TYI_USD',
    sponsor_status: quoteResult.sponsorStatus,
  });

  if (input.onAssistantPatch) {
    await input.onAssistantPatch(
      `💳 Approve **TYI Mock USD** in your connected wallet to continue.\nPayer: \`${parties.payerAddress}\``
    );
  }

  return {
    status: 'awaiting_settlement',
    txHash: null,
    blockNumber: null,
    confirmedAt: null,
    quoteId: quoteResult.quoteId,
    gasFeeUSD: quoteResult.estimatedGasFeeUSD,
    ugfQuote: toUgfQuoteSnapshot(quoteResult.quote),
    payerAddress: parties.payerAddress,
    ugfContractAddress: contractAddress,
    ugfCalldata: input.calldata,
  };
}

/** After user wallet settle + sponsorAndExecute in browser — verify and persist tx. */
export async function finalizeUserWalletExecution(
  input: OnChainExecutionInput,
  txHash: string,
  quoteId?: string | null
): Promise<OnChainExecutionResult> {
  const contractAddress = input.contractAddress || config.nftContractAddress;
  if (!isAddress(contractAddress)) {
    return failTransaction(input, 'Invalid NFT contract address');
  }

  const startedAt = Date.now();

  await updateTransactionLifecycle(input.transactionId, {
    status: 'mining',
    current_step: 'mining',
    tx_hash: txHash,
    explorer_url: buildExplorerTxUrl(txHash),
    ugf_quote_id: quoteId ?? null,
    ugf_digest: quoteId ?? null,
  });

  const receiptCheck = await verifyTransactionReceipt({
    txHash,
    expectedContractAddress: contractAddress,
  });

  if (!receiptCheck.verified) {
    const message =
      receiptCheck.failureReason ??
      'Transaction reverted — ensure contract owner is your connected wallet (deploy with your MetaMask as initialOwner).';
    await updateTransactionLifecycle(input.transactionId, {
      status: 'failed',
      current_step: 'confirm',
      failure_reason: message,
      receipt_json: receiptCheck.receipt,
      execution_time_ms: Date.now() - startedAt,
    });
    return {
      status: 'failed',
      txHash,
      blockNumber: receiptCheck.blockNumber,
      confirmedAt: null,
      quoteId: quoteId ?? null,
      gasFeeUSD: null,
      failureStep: 'confirm',
      failureMessage: message,
      explorerUrl: buildExplorerTxUrl(txHash),
    };
  }

  const confirmedAt = new Date().toISOString();
  await updateTransactionLifecycle(input.transactionId, {
    status: 'confirmed',
    current_step: 'save',
    tx_hash: txHash,
    explorer_url: buildExplorerTxUrl(txHash),
    block_number: receiptCheck.blockNumber,
    confirmed_at: confirmedAt,
    failure_reason: null,
    execution_time_ms: Date.now() - startedAt,
  });

  if (input.onAssistantPatch) {
    await input.onAssistantPatch(
      `✅ Transaction confirmed!\nTx: \`${txHash}\`\n[Explorer](${buildExplorerTxUrl(txHash)})`
    );
  }

  return {
    status: 'confirmed',
    txHash,
    blockNumber: receiptCheck.blockNumber,
    confirmedAt,
    quoteId: quoteId ?? null,
    gasFeeUSD: null,
    explorerUrl: buildExplorerTxUrl(txHash),
  };
}

export async function runOnChainTransaction(
  input: OnChainExecutionInput
): Promise<OnChainExecutionResult> {
  if (!isUgfConfigured()) {
    await updateTransactionLifecycle(input.transactionId, {
      status: 'failed',
      current_step: 'quote',
      failure_reason:
        'UGF not ready: set UGF_SIGNER_PRIVATE_KEY (contract owner) and NFT_CONTRACT_ADDRESS.',
    });
    return {
      status: 'failed',
      txHash: null,
      blockNumber: null,
      confirmedAt: null,
      quoteId: null,
      gasFeeUSD: null,
      failureMessage: 'UGF not configured',
    };
  }

  if (isUgfUserPayerMode()) {
    return prepareUserWalletSettlement(input);
  }

  const contractAddress = input.contractAddress || config.nftContractAddress;
  if (!isAddress(contractAddress)) {
    return failTransaction(input, 'Invalid NFT contract address');
  }

  const payload = buildUgfPayload(contractAddress, input.calldata, input.userWallet);
  const startedAt = Date.now();

  await updateTransactionLifecycle(input.transactionId, {
    status: 'pending',
    current_step: 'pending',
    contract_address: contractAddress,
    payment_coin: 'TYI_USD',
  });

  const progressHook: UgfProgressHook = async (phase, detail) => {
    const lifecycle = stepToLifecycle(phase);
    await updateTransactionLifecycle(input.transactionId, {
      status: lifecycle,
      current_step: phase,
      ...(detail?.quoteId ? { ugf_quote_id: String(detail.quoteId), ugf_digest: String(detail.quoteId) } : {}),
      ...(detail?.estimatedGasFeeUSD !== undefined
        ? { gas_fee_mockusd: Number(detail.estimatedGasFeeUSD) }
        : {}),
      ...(detail?.txHash
        ? { tx_hash: String(detail.txHash), explorer_url: buildExplorerTxUrl(String(detail.txHash)) }
        : {}),
    });
  };

  try {
    const result = await executeUgfFlow(payload, progressHook);
    const txHash = result.txHash;
    if (!txHash) {
      throw new UgfStepError('confirm', 'No transaction hash returned from UGF');
    }

    await updateTransactionLifecycle(input.transactionId, {
      status: 'mining',
      current_step: 'mining',
      tx_hash: txHash,
      explorer_url: buildExplorerTxUrl(txHash),
      ugf_quote_id: result.quoteId,
      ugf_digest: result.quoteId,
      gas_fee_mockusd: result.estimatedGasFeeUSD,
      quote_response: result.quoteResponse,
      settlement_response: result.settlementResponse,
    });

    const receiptCheck = await verifyTransactionReceipt({
      txHash,
      expectedContractAddress: contractAddress,
    });

    if (!receiptCheck.verified) {
      await updateTransactionLifecycle(input.transactionId, {
        status: 'failed',
        current_step: 'confirm',
        failure_reason: receiptCheck.failureReason ?? 'Receipt verification failed',
        receipt_json: receiptCheck.receipt,
        execution_time_ms: Date.now() - startedAt,
      });
      return {
        status: 'failed',
        txHash,
        blockNumber: receiptCheck.blockNumber,
        confirmedAt: null,
        quoteId: result.quoteId,
        gasFeeUSD: result.estimatedGasFeeUSD,
        failureStep: 'confirm',
        failureMessage: receiptCheck.failureReason ?? 'Receipt verification failed',
        explorerUrl: buildExplorerTxUrl(txHash),
      };
    }

    const confirmedAt = result.confirmedAt ?? new Date().toISOString();
    await updateTransactionLifecycle(input.transactionId, {
      status: 'confirmed',
      current_step: 'save',
      tx_hash: txHash,
      explorer_url: buildExplorerTxUrl(txHash),
      block_number: receiptCheck.blockNumber ?? result.blockNumber,
      confirmed_at: confirmedAt,
      failure_reason: null,
      execution_time_ms: Date.now() - startedAt,
    });

    if (input.onAssistantPatch) {
      await input.onAssistantPatch(
        `✅ Transaction confirmed on Base Sepolia!\nTx: \`${txHash}\`\n[Explorer](${buildExplorerTxUrl(txHash)})`
      );
    }

    return {
      status: 'confirmed',
      txHash,
      blockNumber: receiptCheck.blockNumber ?? result.blockNumber,
      confirmedAt,
      quoteId: result.quoteId,
      gasFeeUSD: result.estimatedGasFeeUSD,
      explorerUrl: buildExplorerTxUrl(txHash),
    };
  } catch (error) {
    const step = error instanceof UgfStepError ? error.step : 'execute';
    const data = error instanceof UgfStepError ? (error.data ?? {}) : {};
    const message =
      error instanceof UgfStepError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Transaction failed';

    await updateTransactionLifecycle(input.transactionId, {
      status: 'failed',
      current_step: step,
      tx_hash: (data.txHash as string | null) ?? null,
      ugf_quote_id: (data.quoteId as string | null) ?? null,
      gas_fee_mockusd: (data.estimatedGasFeeUSD as number | null) ?? null,
      failure_reason: message,
    });

    if (input.onAssistantPatch) {
      await input.onAssistantPatch(`⚠️ On-chain execution failed at **${step}**: ${message}`);
    }

    return {
      status: 'failed',
      txHash: (data.txHash as string | null) ?? null,
      blockNumber: (data.blockNumber as number | null) ?? null,
      confirmedAt: null,
      quoteId: (data.quoteId as string | null) ?? null,
      gasFeeUSD: (data.estimatedGasFeeUSD as number | null) ?? null,
      failureStep: step,
      failureMessage: message,
    };
  }
}
