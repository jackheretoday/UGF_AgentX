/**
 * Validates UGF env without printing secrets.
 * Run: npm run check:ugf
 */
import dotenv from 'dotenv';
import { Wallet } from 'ethers';
import { isAddress } from 'viem';
import {
  getGlobalUgfSignerAddress,
  isNftContractConfigured,
  isUgfConfigured,
  isUgfSignerConfigured,
} from '../src/config/env.js';

dotenv.config();

function checkPrivateKey(name: string, value: string | undefined): string {
  if (!value?.trim()) return `${name}: MISSING`;
  if (/your_|placeholder/i.test(value)) return `${name}: PLACEHOLDER (replace with real key)`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(value.trim())) {
    return `${name}: INVALID (expected 0x + 64 hex characters)`;
  }
  return `${name}: OK`;
}

function checkAddress(name: string, value: string | undefined): string {
  if (!value?.trim()) return `${name}: MISSING`;
  if (/your_|placeholder/i.test(value)) return `${name}: PLACEHOLDER (replace with deployed contract)`;
  if (!isAddress(value.trim())) return `${name}: INVALID (not a valid Ethereum address)`;
  return `${name}: OK`;
}

const pk =
  process.env.UGF_SIGNER_PRIVATE_KEY ||
  process.env.UGF_PRIVATE_KEY ||
  process.env.PRIVATE_KEY;

const contract = process.env.NFT_CONTRACT_ADDRESS;

console.log('\n=== UGF Environment Check ===\n');
console.log(checkPrivateKey('UGF_SIGNER_PRIVATE_KEY (global payer)', pk));
console.log(checkAddress('NFT_CONTRACT_ADDRESS (call target only)', contract));
console.log('UGF auth: wallet login only (UGF_API_KEY not used)');
console.log(`\nisUgfSignerConfigured(): ${isUgfSignerConfigured()}`);
console.log(`isNftContractConfigured(): ${isNftContractConfigured()}`);
console.log(`isUgfConfigured() (signer + contract): ${isUgfConfigured()}`);

if (isUgfSignerConfigured()) {
  try {
    const address = getGlobalUgfSignerAddress();
    console.log(`\nGlobal UGF signer (fund TYI Mock USD on UGF for this wallet):`);
    console.log(address);
    console.log(`Basescan: https://sepolia.basescan.org/address/${address}`);
    console.log('\nContract owner() must equal this address if mint uses onlyOwner.');
  } catch {
    // ignore
  }
} else if (pk?.trim() && /^0x[a-fA-F0-9]{64}$/.test(pk.trim())) {
  try {
    const address = new Wallet(pk.trim()).address;
    console.log(`\nDerived signer address: ${address}`);
  } catch {
    // ignore
  }
}

if (!isUgfConfigured()) {
  console.log('\n→ Fix Backend/.env then restart: npm run dev');
  console.log('→ Guide: Backend/docs/SETUP_UGF.md\n');
  process.exit(1);
}

console.log('\n→ Ready for on-chain execution. Restart backend if it is already running.\n');
