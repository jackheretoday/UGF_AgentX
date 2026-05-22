/**
 * Prints the Ethereum address for UGF_SIGNER_PRIVATE_KEY (for contract initialOwner).
 * Run: npm run signer:address
 */
import dotenv from 'dotenv';
import { Wallet } from 'ethers';

dotenv.config();

const pk =
  process.env.UGF_SIGNER_PRIVATE_KEY ||
  process.env.UGF_PRIVATE_KEY ||
  process.env.PRIVATE_KEY;

if (!pk?.trim()) {
  console.error('UGF_SIGNER_PRIVATE_KEY is not set in Backend/.env');
  process.exit(1);
}

try {
  const wallet = new Wallet(pk.trim());
  console.log('\nUGF signer address (use as contract initialOwner in Remix):\n');
  console.log(wallet.address);
  console.log('');
} catch {
  console.error('Invalid UGF_SIGNER_PRIVATE_KEY format');
  process.exit(1);
}
