import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const port = process.env.PORT || '5000';
const BACKEND_URL = `http://localhost:${port}`;
const jwtSecret = process.env.JWT_SECRET || 'fallback-jwt-secret-key-12345';

async function runGoogleE2ETest() {
  console.log('🏁 Starting UGF AgentX Google Auth E2E Integration Test...');
  console.log(`📡 Targeting Backend Server at: ${BACKEND_URL}\n`);

  try {
    const mockEmail = `test-user-${Date.now()}@example.com`;
    const mockName = 'Test Google User';
    const mockSub = `mock-google-sub-${Date.now()}`;

    // 1. Send Google Auth request
    console.log(`📥 Sending mock Google login request for ${mockEmail}...`);
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mockPayload: {
          sub: mockSub,
          email: mockEmail,
          name: mockName,
        },
      }),
    });

    if (!loginRes.ok) {
      const errorText = await loginRes.text();
      throw new Error(`Google login endpoint failed: ${loginRes.status} ${errorText}`);
    }

    const loginData = await loginRes.json() as { success: boolean; token: string; user: any };
    console.log('✅ Google Authentication Response Received!');
    console.log(`👤 User ID: ${loginData.user.id}`);
    console.log(`💳 Resolved Deterministic Wallet: ${loginData.user.walletAddress}`);
    console.log(`🎫 Received JWT Token (Truncated): ${loginData.token.substring(0, 24)}...`);

    // 2. Validate token structure
    console.log('\n🔒 Decoding and validating backend issued JWT token...');
    const decoded = jwt.decode(loginData.token) as any;
    console.log('📝 Decoded JWT Claims:', JSON.stringify(decoded, null, 2));

    if (!decoded) {
      throw new Error('JWT could not be decoded.');
    }
    if (decoded.walletAddress !== loginData.user.walletAddress) {
      throw new Error('JWT walletAddress does not match user walletAddress!');
    }
    if (decoded.authType !== 'google') {
      throw new Error(`Expected authType 'google' inside JWT, but got: ${decoded.authType}`);
    }
    if (decoded.email !== mockEmail) {
      throw new Error(`Expected email '${mockEmail}' inside JWT, but got: ${decoded.email}`);
    }
    console.log('✅ JWT claims validation passed successfully!');

    // 3. Submit chat prompt with intent "Mint me a hacker badge" using Google session token
    const prompt = 'Mint me a hacker badge';
    console.log(`\n💬 Sending chat prompt using Google JWT to assistant: "${prompt}"...`);

    const chatRes = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.token}`,
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

    // Assertions
    if (chatData.intent !== 'MINT_BADGE') {
      throw new Error(`Expected intent MINT_BADGE, got ${chatData.intent}`);
    }
    if (!chatData.transactionId) {
      throw new Error('Expected transactionId to be returned');
    }
    console.log('\n🎉 ALL GOOGLE AUTH E2E TEST CHECKS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ GOOGLE AUTH E2E TEST FAILED:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runGoogleE2ETest();
