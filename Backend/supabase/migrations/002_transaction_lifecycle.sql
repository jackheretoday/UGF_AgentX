-- Real transaction lifecycle fields (Base Sepolia + UGF)

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS explorer_url TEXT,
  ADD COLUMN IF NOT EXISTS gas_used NUMERIC,
  ADD COLUMN IF NOT EXISTS gas_price NUMERIC,
  ADD COLUMN IF NOT EXISTS execution_time_ms BIGINT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS current_step TEXT,
  ADD COLUMN IF NOT EXISTS ugf_digest TEXT,
  ADD COLUMN IF NOT EXISTS quote_response JSONB,
  ADD COLUMN IF NOT EXISTS settlement_response JSONB,
  ADD COLUMN IF NOT EXISTS receipt_json JSONB,
  ADD COLUMN IF NOT EXISTS payment_coin TEXT DEFAULT 'TYI_USD',
  ADD COLUMN IF NOT EXISTS sponsor_status TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
