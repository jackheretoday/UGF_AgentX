-- Supabase schema for UGF AgentX (lean hackathon setup)

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  username TEXT,
  auth_type TEXT DEFAULT 'wallet',
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  mockusd_balance NUMERIC DEFAULT 0,
  eth_balance NUMERIC DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  total_nfts INTEGER DEFAULT 0
);

CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id),
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT DEFAULT 'pending',
  ugf_quote_id TEXT,
  gas_fee_mockusd NUMERIC,
  network TEXT DEFAULT 'Base Sepolia',
  contract_address TEXT,
  block_number BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  explorer_url TEXT,
  gas_used NUMERIC,
  gas_price NUMERIC,
  execution_time_ms BIGINT,
  failure_reason TEXT,
  current_step TEXT,
  ugf_digest TEXT,
  quote_response JSONB,
  settlement_response JSONB,
  receipt_json JSONB,
  payment_coin TEXT DEFAULT 'TYI_USD',
  sponsor_status TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE minted_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  user_id UUID REFERENCES users(id),
  token_id BIGINT,
  badge_name TEXT,
  recipient_name TEXT,
  metadata_uri TEXT,
  image_url TEXT,
  tx_hash TEXT,
  minted_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  original_prompt TEXT,
  parsed_action TEXT,
  extracted_data JSONB,
  parser_type TEXT DEFAULT 'regex',
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_users INTEGER DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  total_nfts INTEGER DEFAULT 0,
  total_mockusd_spent NUMERIC DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
