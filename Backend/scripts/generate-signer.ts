/**
 * Generates a new random Ethereum wallet for UGF_SIGNER_PRIVATE_KEY (testnet only).
 * Run: npm run generate:signer
 */
import { Wallet } from 'ethers';

const wallet = Wallet.createRandom();

console.log('\n=== UGF Testnet Signer (save these — shown once) ===\n');
console.log('Address (fund with TYI Mock USD on UGF dashboard):');
console.log(wallet.address);
console.log('\nAdd to Backend/.env:');
console.log(`UGF_SIGNER_PRIVATE_KEY=${wallet.privateKey}`);
console.log('\n⚠️  Testnet only. Do not use a mainnet wallet.\n');
