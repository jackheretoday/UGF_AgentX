import {
  TYI_USD_PAYMENT_COIN,
  UGFClient,
  type QuoteResponse,
} from '@tychilabs/ugf-testnet-js';
import { BrowserProvider, type Eip1193Provider, type Signer } from 'ethers';
import { baseSepolia } from 'wagmi/chains';

const SPONSOR_POLL = { maxAttempts: 45, intervalMs: 2000 };

export async function getConnectedEthersSigner(): Promise<Signer> {
  const ethereum = (window as { ethereum?: object }).ethereum;
  if (!ethereum) {
    throw new Error('Connect your wallet (MetaMask / Coinbase) on Base Sepolia');
  }

  const provider = new BrowserProvider(ethereum as Eip1193Provider);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== baseSepolia.id) {
    throw new Error('Switch your wallet to Base Sepolia (chain 84532)');
  }

  return provider.getSigner();
}

/**
 * User wallet: pay TYI (x402) then mint via UGF-sponsored ETH on the same address.
 * Contract `owner` must be the connected wallet when UGF_PAYMENT_WALLET=user.
 */
export async function runUserWalletUgfFlow(params: {
  quoteSnapshot: Record<string, unknown>;
  contractAddress: string;
  calldata: `0x${string}`;
}): Promise<{ userTxHash: string; quoteId: string }> {
  const quote = params.quoteSnapshot as unknown as QuoteResponse;
  if (!quote?.digest) {
    throw new Error('Invalid UGF quote — claim again from chat');
  }

  const signer = await getConnectedEthersSigner();
  const client = new UGFClient();

  await client.auth.login(signer);

  await client.payment.x402.execute({
    quote,
    signer,
    token: TYI_USD_PAYMENT_COIN,
  });

  const execution = await client.chains.evm.sponsorAndExecute(
    quote.digest,
    signer,
    async () => ({
      to: params.contractAddress,
      data: params.calldata,
      value: 0n,
    }),
    SPONSOR_POLL
  );

  return {
    userTxHash: execution.userTxHash,
    quoteId: quote.digest,
  };
}
