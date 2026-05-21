import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { getAddress } from 'viem';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const port = process.env.PORT || '5000';
const BACKEND_URL = `http://localhost:${port}`;

async function runE2ETest() {
  console.log('🏁 Starting UGF AgentX E2E Integration Test...');
  console.log(`📡 Targeting Backend Server at: ${BACKEND_URL}\n`);

  try {
    // 1. Generate client wallet key pair
    console.log('🗝️  Generating ephemeral client test wallet...');
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const clientWallet = getAddress(account.address);
    console.log(`✅ Test Wallet Address: ${clientWallet}`);

    // 2. Fetch login nonce
    console.log('\n📥 Requesting authentication nonce from backend...');
    const nonceRes = await fetch(`${BACKEND_URL}/api/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: clientWallet }),
    });

    if (!nonceRes.ok) {
      const errorText = await nonceRes.text();
      throw new Error(`Failed to get nonce: ${nonceRes.status} ${errorText}`);
    }

    const { nonce } = await nonceRes.json() as { nonce: string };
    console.log(`✅ Received Nonce: "${nonce}"`);

    // 3. Sign the login message
    console.log('\n✍️  Signing the authentication message...');
    const signature = await account.signMessage({ message: nonce });
    console.log(`✅ Generated Signature: ${signature.substring(0, 32)}...`);

    // 4. Verify login and retrieve JWT
    console.log('\n🔑 Verifying signature with backend to receive JWT...');
    const verifyRes = await fetch(`${BACKEND_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: clientWallet, signature }),
    });

    if (!verifyRes.ok) {
      const errorText = await verifyRes.text();
      throw new Error(`Failed to verify signature: ${verifyRes.status} ${errorText}`);
    }

    const verifyData = await verifyRes.json() as { success: boolean; token: string; user: any };
    const jwtToken = verifyData.token;
    console.log('✅ Authentication Successful!');
    console.log(`👤 User ID: ${verifyData.user.id}`);
    console.log(`🎫 JWT Token (Truncated): ${jwtToken.substring(0, 24)}...`);

    // 5. Submit chat prompt with intent "Mint me a hacker badge"
    const prompt = 'Mint me a hacker badge';
    console.log(`\n💬 Sending chat prompt to assistant: "${prompt}"...`);

    const chatRes = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        message: prompt,
        sessionId: null,
      }),
    });

    if (!chatRes.ok) {
      const errorText = await chatRes.text();
      throw new Error(`Chat request failed: ${chatRes.status} ${errorText}`);
    }

    const chatData = await chatRes.json() as any;
    console.log('✅ Assistant Response Received!');
    console.log('--------------------------------------------------');
    console.log(`🤖 Intent Classified: ${chatData.intent}`);
    console.log(`🎯 Recipient: ${chatData.recipient}`);
    console.log(`💡 Confidence: ${chatData.confidence}`);
    console.log(`📊 AI Steps: ${chatData.aiSteps?.length || 0} steps`);
    console.log(`🔗 Transaction Steps: ${chatData.transactionSteps?.length || 0} steps`);
    console.log(`⛽ Gas Estimate: ${chatData.gasEstimate?.mockUSD} Mock USD (${chatData.gasEstimate?.breakdown})`);
    console.log(`⚙️  On-Chain Execution Status: ${chatData.executionStatus}`);
    console.log(`📝 Transaction ID: ${chatData.transactionId}`);
    if (chatData.txHash) {
      console.log(`⛓️  On-Chain Tx Hash: ${chatData.txHash}`);
    } else {
      console.log('ℹ️  On-Chain Tx Hash: (Pending/Skipped due to simulated keys)');
    }
    console.log('\n💬 AI Reply:');
    console.log(chatData.reply);
    console.log('--------------------------------------------------');

    // Basic assertions
    if (chatData.intent !== 'MINT_BADGE') {
      throw new Error(`Expected intent MINT_BADGE, got ${chatData.intent}`);
    }
    if (!chatData.transactionId) {
      throw new Error('Expected transactionId to be returned');
    }
    if (chatData.executionStatus === 'skipped') {
      console.log('✨ Graceful degradation: verified successfully with empty/placeholder keys (as expected).');
    } else if (chatData.executionStatus === 'success') {
      console.log('✨ On-chain execution was fully completed on Base Sepolia!');
    }

    console.log('\n🎉 ALL E2E TEST CHECKS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ E2E TEST FAILED:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runE2ETest();
