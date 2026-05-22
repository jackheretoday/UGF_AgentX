# UGF AgentX — Complete Transaction System Documentation

> **Canonical copy:** Also maintained at [`Frontend/Docs/Transaction.md`](../Frontend/Docs/Transaction.md)  
> **Last analyzed:** May 22, 2026  
> **Scope:** Frontend (`src/`), Backend (`Backend/src/`), Supabase schema, UGF SDK integration

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Real vs Mock / Simulated](#2-real-vs-mock--simulated)
3. [Technology Stack](#3-technology-stack)
4. [Complete Transaction Flow Diagram](#4-complete-transaction-flow-diagram)
5. [Step-by-Step: Frontend to Backend](#5-step-by-step-frontend-to-backend)
6. [Phase-by-Phase Breakdown](#6-phase-by-phase-breakdown)
7. [Blockchain & Smart Contract Flow](#7-blockchain--smart-contract-flow)
8. [Database Schema & Records](#8-database-schema--records)
9. [Frontend ↔ Backend Communication](#9-frontend--backend-communication)
10. [API Reference with Examples](#10-api-reference-with-examples)
11. [Roles of Key Concepts](#11-roles-of-key-concepts)
12. [File & Folder Structure](#12-file--folder-structure)
13. [Security Checks & Validations](#13-security-checks--validations)
14. [Edge Cases & Failure Scenarios](#14-edge-cases--failure-scenarios)
15. [Configuration Matrix](#15-configuration-matrix)

---

## 1. Executive Summary

**UGF AgentX** is a gasless Web3 assistant on **Base Sepolia testnet**. Users interact via natural-language chat; the backend parses intent, records transactions in **Supabase (PostgreSQL)**, and optionally executes **real on-chain transactions** through the **Universal Gas Framework (UGF)** using **TYI Mock USD** (testnet token, not fiat).

| Question | Answer |
|----------|--------|
| Is the flow real or mock? | **Hybrid** — see [Section 2](#2-real-vs-mock--simulated) |
| Fiat payments (Stripe, etc.)? | **No** |
| Solana? | **No** |
| Primary chain | **Ethereum Base Sepolia** |
| Gas payment | **TYI Mock USD** via UGF (server signer wallet) |
| User signs blockchain txs? | **No** for chat actions — server signs via UGF |
| User signs for auth? | **Yes** — EIP-191 message for wallet login |
| Webhooks? | **None** |

The **primary production path** for transactions is:

```
User chat → POST /api/chat → DB insert → (async) executeUgfFlow() → patch DB
```

Alternative paths exist (`POST /api/ugf/execute`, `POST /api/transaction`) but are **not used by the main UI**.

---

## 2. Real vs Mock / Simulated

The system uses a **layered hybrid model**. Each layer can be real or simulated independently.

```mermaid
flowchart TB
    subgraph UI["Frontend UI"]
        A[Timeline step animation<br/>~1.5s per step]
        B[Placeholder tx hash in chat bubble<br/>0x000...000]
        C[Real ETH balance via wagmi]
    end

    subgraph Backend["Backend"]
        D[Mock gas formula buildGasEstimate]
        E[Real UGF quote when executeUgfFlow runs]
        F[DB transaction always created]
    end

    subgraph Chain["Base Sepolia"]
        G[Real tx when UGF configured]
        H[Skipped when env missing]
    end

    UI --> Backend
    Backend --> Chain
```

### Layer breakdown

| Layer | Behavior | Real or mock? |
|-------|----------|---------------|
| **On-chain execution** | `executeUgfFlow()` → UGF quote → settle → `sponsorAndExecute` → poll | **Real** on Base Sepolia when `UGF_SIGNER_PRIVATE_KEY` + `NFT_CONTRACT_ADDRESS` are set |
| **On-chain execution (no env)** | Transaction row inserted as `pending`, `executionStatus: 'skipped'` | **No chain call** |
| **Gas shown in chat response** | `buildGasEstimate()` — formula + random variance | **Mock formula** (not live UGF `quote.get()` in chat path) |
| **Gas after UGF runs** | Patched from `estimatedGasFeeUSD` in async job | **Real** (from UGF quote) |
| **UI timeline steps** | `setTimeout` advances steps every 1500ms | **Simulated** unless sync response has `txHash` + `executionStatus === 'success'` |
| **Chat bubble tx card** | Uses `metadata.txHash` or `'0x' + '0'.repeat(64)` | Often **placeholder** |
| **ETH balance** | `useBalance` (wagmi) on Base Sepolia | **Real on-chain** |
| **Mock USD balance** | `users.mockusd_balance` from Supabase | **DB field** — not auto-synced from UGF vault |
| **Google login** | `mockPayload` or decoded (unverified) JWT → deterministic fake `0x` address | **Sandbox / demo** |
| **Legacy `aiResponseEngine.ts`** | Client-only mock responses | **Orphaned** — not used by `submitPrompt` |

### Decision tree: will a transaction hit the chain?

```
isUgfConfigured()?
├── NO  → DB pending only, executionStatus: skipped
└── YES → is blockchain intent (MINT/CLAIM/DONATE/REWARD)?
    ├── NO  → no on-chain attempt
    └── YES → valid calldata?
        ├── DONATE without valid 0x recipient → skipped
        ├── MINT without tokenURI → skipped
        └── valid → executeUgfFlow() (async in chat route)
```

---

## 3. Technology Stack

### Payment & blockchain

| Component | Package / service | Purpose |
|-----------|-------------------|---------|
| **Chain** | Base Sepolia (`chainId` via UGF SDK constants) | All on-chain activity |
| **UGF SDK** | `@tychilabs/ugf-testnet-js` | Gas quotes, Mock USD settlement, sponsored execution |
| **Payment coin** | `TYI_USD_PAYMENT_COIN` | Testnet Mock USD for gas |
| **Server signer** | `ethers` `Wallet` + `UGF_SIGNER_PRIVATE_KEY` | Signs UGF auth, settlement, and sponsored txs |
| **Calldata encoding** | `viem` `encodeFunctionData` | `mintBadge`, `donate` ABI calls |
| **Smart contract** | `NFT_CONTRACT_ADDRESS` | ERC-721-style: `mintBadge(to, tokenURI)`, `donate(to, amount)` |
| **RPC** | `BASE_SEPOLIA_RPC_URL` (default `https://sepolia.base.org`) | Chain reads / signer provider |

### Wallet & auth (frontend)

| Component | Package | Purpose |
|-----------|---------|---------|
| **Wallet UI** | Wagmi + ConnectKit + WalletConnect | Connect wallet on Base Sepolia only |
| **Auth signing** | `useSignMessage` (wagmi) | Sign login nonce (off-chain, not a tx) |
| **Address verification** | `viem` `verifyMessage`, `isAddress`, `getAddress` | Backend validates wallet login |

### Backend & data

| Component | Technology | Purpose |
|-----------|------------|---------|
| **API server** | Express.js | REST endpoints |
| **Database** | Supabase (PostgreSQL) | Users, sessions, messages, transactions, badges |
| **Session auth** | `jsonwebtoken` | 7-day JWT after wallet/Google login |
| **AI intent** | Google Gemini (fallback) + regex rules | Parse user intent from chat |

### Not used

- Stripe, PayPal, or any fiat processor
- Solana, Polygon mainnet, or Ethereum mainnet
- Webhooks / event subscriptions for payment status
- User-signed EIP-712 transaction payloads for chat actions

---

## 4. Complete Transaction Flow Diagram

### End-to-end sequence (primary path: chat)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant FE as React Frontend
    participant W as Wagmi / Wallet
    participant API as Express Backend
    participant DB as Supabase
    participant UGF as UGF SDK
    participant SC as NFT Contract
    participant CH as Base Sepolia

    Note over U,CH: Phase A — Authentication (once per session)
    U->>FE: Connect wallet (ConnectKit)
    FE->>W: Connect Base Sepolia
    FE->>API: POST /api/auth/nonce { walletAddress }
    API-->>FE: { nonce: "Sign in to UGF AgentX\nUUID: ..." }
    U->>W: signMessage(nonce)
    W-->>FE: signature
    FE->>API: POST /api/auth/verify { walletAddress, signature }
    API->>API: viem.verifyMessage + delete nonce
    API->>DB: upsert users
    API-->>FE: { token: JWT, user }
    FE->>FE: Store JWT, load tx history

    Note over U,CH: Phase B — Chat initiates transaction
    U->>FE: "Mint a badge for Jay"
    FE->>API: POST /api/chat (Bearer JWT)
    API->>DB: insert chat_messages (user)
    API->>API: ruleBasedParse / Gemini fallback
    API->>API: buildGasEstimate (mock USD)
    API->>DB: insert transactions (pending)
    API->>DB: insert minted_badges (if MINT)
    API-->>FE: reply, steps, executionStatus pending/skipped
    FE->>FE: Simulate timeline (1.5s/step) OR show real hash if sync success

    Note over U,CH: Phase C — Async on-chain (if UGF configured)
    API->>UGF: executeUgfFlow (background IIFE)
    UGF->>UGF: auth.login(signer)
    UGF->>UGF: quote.get (TYI Mock USD)
    UGF->>UGF: vault.payAndSubmit OR x402.execute
    UGF->>CH: sponsorAndExecute → SC.mintBadge/donate
    UGF->>UGF: pollStatus (30s max, 2s interval)
    UGF-->>API: txHash, blockNumber, gas USD
    API->>DB: patch transactions, minted_badges
    API->>DB: patch chat_messages (success/fail text)

    Note over U,CH: Phase D — History refresh
    FE->>API: GET /api/transactions/:wallet
    API->>DB: select transactions
    API-->>FE: rows with tx_hash, status
```

### UGF execution sub-flow (on-chain)

```mermaid
flowchart LR
    A[encodeFunctionData<br/>mintBadge / donate] --> B[UGF auth.login]
    B --> C[quote.get]
    C --> D{payment_mode?}
    D -->|vault| E[payment.vault.payAndSubmit]
    D -->|x402| F[payment.x402.execute]
    E --> G[chains.evm.sponsorAndExecute]
    F --> G
    G --> H[pollStatus up to 30s]
    H -->|success| I[Return txHash + block]
    H -->|failed| J[UgfStepError execute]
    H -->|timeout| K[UgfStepError confirm]
```

---

## 5. Step-by-Step: Frontend to Backend

### Phase A — Wallet connection & authentication

| Step | Actor | Action |
|------|-------|--------|
| 1 | User | Opens app, clicks Connect Wallet (ConnectKit) |
| 2 | Frontend | `Web3Provider` configures Wagmi for **Base Sepolia only** |
| 3 | Frontend | `WalletAuthSync` detects connected address |
| 4 | Frontend | `POST /api/auth/nonce` with wallet address |
| 5 | Backend | Validates address, stores nonce in **in-memory** `nonceStore` (5 min TTL) |
| 6 | User | Signs nonce message in wallet (MetaMask, etc.) — **not a blockchain transaction** |
| 7 | Frontend | `POST /api/auth/verify` with address + signature |
| 8 | Backend | `viem.verifyMessage`, deletes nonce, upserts `users`, issues **JWT (7 days)** |
| 9 | Frontend | Stores token, loads transaction history and chat sessions |

**Google auth alternative:** `POST /api/auth/google` with `mockPayload` or `credential` → deterministic `0x` address from `sha256("google-auth-v1:" + sub)` — **no wallet signature**.

### Phase B — Transaction initiation (chat)

| Step | Actor | Action |
|------|-------|--------|
| 1 | User | Submits chat prompt (e.g. "Donate $5 to 0xABC...") |
| 2 | Frontend | `useStore.submitPrompt` checks `wallet.isConnected` + JWT |
| 3 | Frontend | `POST /api/chat` with `{ sessionId, message }` |
| 4 | Backend | Upserts `chat_sessions`, inserts user `chat_messages` |
| 5 | Backend | Parses intent: regex first, **Gemini** if `UNKNOWN` |
| 6 | Backend | Builds `tokenURI` (base64 JSON metadata) for mint/claim |
| 7 | Backend | `buildGasEstimate()` — **mock USD** for UI |
| 8 | Backend | `getStepsForIntent()` — AI messages + timeline step definitions |
| 9 | Backend | Inserts `ai_actions` audit row |
| 10 | Backend | Inserts `transactions` row (`status: pending`) |
| 11 | Backend | Inserts `minted_badges` if `MINT_BADGE` |
| 12 | Backend | Returns HTTP response **before** chain completes |
| 13 | Frontend | Builds `activeTransaction`, simulates step progression |
| 14 | Frontend | Streams `aiSteps` with delays; may show placeholder tx hash |

### Phase C — On-chain execution (async, backend only)

| Step | Actor | Action |
|------|-------|--------|
| 1 | Backend | If `isUgfConfigured()` and blockchain intent → spawn async IIFE |
| 2 | Backend | `tryExecuteOnChain` encodes calldata via viem |
| 3 | Backend | `executeUgfFlow({ from: signerAddress, to: contract, data })` |
| 4 | UGF | Quote → settle Mock USD → sponsorAndExecute → poll |
| 5 | Backend | `patchTransaction` with `tx_hash`, `status`, `block_number`, etc. |
| 6 | Backend | `patchChatMessage` with success/failure text + tx hash |

### Phase D — Confirmation & history

| Step | Actor | Action |
|------|-------|--------|
| 1 | Frontend | After simulated timeline ends, `loadTransactionHistory()` |
| 2 | Frontend | `GET /api/transactions/:walletAddress` |
| 3 | Backend | Returns DB rows; `mapDbTransactions` maps to UI state |
| 4 | User | May refresh wallet panel to see updated `tx_hash` (if async job finished) |

---

## 6. Phase-by-Phase Breakdown

### 6.1 Transaction initiation

**Frontend** (`src/store/useStore.ts`):

- Validates wallet connected and JWT present
- Adds user message to local state
- Calls `submitChatMessage({ sessionId, message })`

**Backend** (`Backend/src/routes/chat.ts`):

- Creates/updates session
- Persists user message immediately (durability before processing)
- Classifies intent and extracts `recipient` / `amount`
- Creates `transactions` record with `status: 'pending'`

### 6.2 Authentication / verification

Two distinct auth layers:

| Layer | Mechanism | Signs what? |
|-------|-----------|-------------|
| **API session** | JWT from wallet message sign or Google login | Off-chain login message only (wallet users) |
| **On-chain execution** | Server `UGF_SIGNER_PRIVATE_KEY` via UGF SDK | Contract calls — user wallet does **not** sign the tx |

Protected routes use `authMiddleware` + `assertWalletAccess` so JWT `walletAddress` must match the requested wallet.

### 6.3 Payment signing

**Not traditional user payment signing.**

1. **UGF quote** — Server requests gas quote with `payer_address` = server signer address (so UGF debits **server's TYI Mock USD vault**).
2. **Settlement** — Server signer pays via:
   - `client.payment.vault.payAndSubmit(...)` when `payment_mode === 'vault'`, or
   - `client.payment.x402.execute(...)` otherwise
3. **Execution** — `client.chains.evm.sponsorAndExecute(quoteId, signer, txBuilder)` submits the contract call gaslessly for the user.

The user's connected wallet is **not** required to sign the blockchain transaction for chat-driven actions.

### 6.4 Transaction confirmation

1. **UGF status polling** — `pollStatus()` every 2s, max 30s, reads `user_tx_hash`, `block_number`, `confirmed_at`
2. **DB patch** — `transactions.status` → `success` or `failed`; `confirmed_at` set when available
3. **Frontend** — Usually learns confirmation only via:
   - Refreshed transaction history (`tx_hash` populated), or
   - Reloading chat session (assistant message patched asynchronously)

**Important:** The initial `POST /api/chat` response typically returns `executionStatus: 'pending'` and `txHash: null` because execution runs in a background IIFE.

### 6.5 Success / failure handling

| Outcome | Backend | Frontend |
|---------|---------|----------|
| **UGF success** | Patches tx + chat message with tx hash | Timeline may already show "completed" (simulated); history shows real hash |
| **UGF failed** | `status: failed`, failure step in logs | Simulated timeline still completes unless wired to real status |
| **UGF skipped** | No chain call; tx stays `pending` | Timeline still animates (demo behavior) |
| **Chat API error** | 500 JSON `{ success: false, error }` | Assistant message with error text |
| **401** | JWT invalid/expired | `clearAuthSession`, `ugf:unauthorized` event |

`UgfStepError` steps: `quote` → `settle` → `execute` → `confirm`

---

## 7. Blockchain & Smart Contract Flow

### Network

- **Network:** Base Sepolia (Ethereum L2 testnet)
- **Chain ID / type:** From `@tychilabs/ugf-testnet-js` constants (`BASE_SEPOLIA_CHAIN_ID`, `BASE_SEPOLIA_CHAIN_TYPE`)
- **Not mainnet** — no real USD or production assets

### Smart contract

Deployed at `NFT_CONTRACT_ADDRESS`. ABI used in backend:

```typescript
// mintBadge(address to, string tokenURI) — MINT_BADGE, CLAIM_CERT, SEND_REWARD
// donate(address to, uint256 amount)     — DONATE (6 decimals = Mock USD units)
```

**Calldata construction** (`chat.ts` → `tryExecuteOnChain`):

- **DONATE:** Requires valid `0x` recipient; `amount` parsed with `parseUnits(amount, 6)`
- **MINT / CLAIM / REWARD:** `mintBadge` to recipient address if valid, else **user's wallet**
- **tokenURI:** Base64-encoded JSON metadata with embedded SVG (generated server-side)

### Gas fees

| Fee type | Who pays | Currency |
|----------|----------|----------|
| **L2 gas** | Sponsored via UGF | Debited from server signer's **TYI Mock USD** vault |
| **Donation amount** | On-chain `donate()` | Mock USD token units (6 decimals) inside contract logic |
| **User ETH** | Not required for gas | ETH balance shown for display only |

**Chat-displayed gas** uses `buildGasEstimate()` — a deterministic-ish formula with random variance, **not** the live UGF quote returned to the client synchronously.

### Wallet signing process

```mermaid
flowchart TB
    subgraph UserWallet["User Wallet (ConnectKit)"]
        UW1[signMessage for login nonce]
    end

    subgraph ServerWallet["Server Signer (UGF_SIGNER_PRIVATE_KEY)"]
        SW1[UGF auth.login]
        SW2[Pay Mock USD settlement]
        SW3[sponsorAndExecute contract call]
    end

    subgraph Chain["Base Sepolia"]
        C1[Contract mintBadge / donate]
    end

    UW1 -.->|Off-chain only| API[Backend JWT]
    SW1 --> SW2 --> SW3 --> C1
```

### On-chain vs off-chain verification

| Check | Where | Type |
|-------|-------|------|
| Login signature | Backend `verifyMessage` | Off-chain |
| JWT validity | `authMiddleware` | Off-chain |
| Wallet address match | `assertWalletAccess` | Off-chain |
| UGF quote/settle/execute | UGF SDK + status API | Off-chain orchestration, on-chain result |
| Tx confirmation | UGF `status.get({ digest })` | Hybrid — UGF tracks chain outcome |
| Tx hash in DB | Written after UGF success | Off-chain record of on-chain fact |

There is **no** independent backend re-verification of receipts via a separate RPC `eth_getTransactionReceipt` call beyond UGF's status polling.

---

## 8. Database Schema & Records

### Entity relationship

```mermaid
erDiagram
    users ||--o{ chat_sessions : owns
    users ||--o{ transactions : has
    users ||--o{ minted_badges : owns
    users ||--o{ ai_actions : triggers
    chat_sessions ||--o{ chat_messages : contains
    transactions ||--o| minted_badges : may_create
```

### `transactions` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID FK | Owner |
| `action_type` | TEXT | `mint_badge`, `claim_cert`, `donate`, `send_reward` |
| `tx_hash` | TEXT | On-chain hash after UGF success |
| `status` | TEXT | `pending`, `success`, `failed` |
| `ugf_quote_id` | TEXT | UGF digest / quote ID |
| `gas_fee_mockusd` | NUMERIC | Mock USD gas (estimate or real from UGF) |
| `network` | TEXT | Default `'Base Sepolia'` |
| `contract_address` | TEXT | NFT contract used |
| `block_number` | BIGINT | From UGF status |
| `created_at` | TIMESTAMP | Insert time |
| `confirmed_at` | TIMESTAMP | Chain confirmation time |

### Related tables

- **`users`** — `mockusd_balance`, `eth_balance`, counters (`total_transactions` / `total_nfts` are **not incremented** in current backend code)
- **`minted_badges`** — NFT metadata, linked via `transaction_id`, `tx_hash` patched after success
- **`ai_actions`** — Intent parsing audit trail
- **`chat_messages`** — User/assistant text; assistant message **patched** after async UGF

### Record lifecycle

```
INSERT (pending, mock gas estimate)
    → async UGF
        → UPDATE (success|failed, tx_hash, block_number, confirmed_at, real gas)
```

---

## 9. Frontend ↔ Backend Communication

### Transport

- **Protocol:** HTTPS REST (JSON)
- **Base URL:** `VITE_BACKEND_URL` or `http://localhost:5000`
- **Auth header:** `Authorization: Bearer <JWT>` on protected routes

### Primary calls during a transaction

| When | Method | Endpoint |
|------|--------|----------|
| Login | POST | `/api/auth/nonce`, `/api/auth/verify` |
| Submit action | POST | `/api/chat` |
| Refresh history | GET | `/api/transactions/:walletAddress` |
| Wallet profile | GET | `/api/wallet?walletAddress=` |

### Client-side state

- **Zustand** (`useStore`) — messages, active transaction, history
- **React Query** (`useWalletBalances`) — ETH on-chain + profile from API
- **No WebSockets** — polling/refetch on interval and after timeline ends

---

## 10. API Reference with Examples

### 10.1 Wallet authentication

**Request — Get nonce**

```http
POST /api/auth/nonce
Content-Type: application/json

{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
}
```

**Response**

```json
{
  "nonce": "Sign in to UGF AgentX\n\nUUID: a1b2c3d4-e5f6-7890-abcd-ef1234567890\n\nThis request will not trigger a blockchain transaction or cost any gas fees."
}
```

**Request — Verify signature**

```http
POST /api/auth/verify
Content-Type: application/json

{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "signature": "0x..."
}
```

**Response**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "displayName": null,
    "authType": "wallet",
    "mockusdBalance": 0,
    "ethBalance": 0,
    "totalTransactions": 0,
    "totalNfts": 0
  }
}
```

### 10.2 Chat — primary transaction trigger

**Request**

```http
POST /api/chat
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Mint a badge for Jay"
}
```

**Response (UGF configured — async execution)**

```json
{
  "success": true,
  "reply": "Let's mint badge for you!",
  "intent": "MINT_BADGE",
  "recipient": "Jay",
  "amount": null,
  "confidence": "rule-based",
  "tokenURI": "data:application/json;base64,...",
  "gasEstimate": {
    "mockUSD": 0.0523,
    "currency": "Mock USD",
    "breakdown": "Base: $0.05 + Name fee: $0.03",
    "note": "Paid in Mock USD via UGF. No ETH required."
  },
  "aiSteps": [
    { "message": "Got it! Preparing your badge mint...", "delayMs": 400 },
    { "message": "Calculating gas fee in Mock USD...", "delayMs": 800 },
    { "message": "Submitting to Base Sepolia via UGF...", "delayMs": 600 }
  ],
  "transactionSteps": [
    { "id": "quote", "label": "Getting UGF gas quote", "status": "pending" },
    { "id": "settle", "label": "Settling Mock USD payment", "status": "pending" },
    { "id": "execute", "label": "Executing mint on Base Sepolia", "status": "pending" },
    { "id": "confirm", "label": "Confirming transaction", "status": "pending" },
    { "id": "save", "label": "Saving badge to gallery", "status": "pending" }
  ],
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionId": "660e8400-e29b-41d4-a716-446655440001",
  "txHash": null,
  "blockNumber": null,
  "confirmedAt": null,
  "executionStatus": "pending"
}
```

**Response (UGF not configured)**

```json
{
  "executionStatus": "skipped",
  "txHash": null
}
```

### 10.3 Transaction history

**Request**

```http
GET /api/transactions/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response**

```json
{
  "transactions": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "action_type": "mint_badge",
      "status": "success",
      "tx_hash": "0xabc123...",
      "gas_fee_mockusd": 0.0412,
      "network": "Base Sepolia",
      "created_at": "2026-05-22T10:00:00.000Z"
    }
  ]
}
```

### 10.4 Direct UGF execute (alternate path — not used by main UI)

**Request**

```http
POST /api/ugf/execute
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "intent": "MINT_BADGE",
  "userWallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "recipient": null,
  "tokenURI": "data:application/json;base64,...",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (success)**

```json
{
  "success": true,
  "intent": "MINT_BADGE",
  "txHash": "0xabc123...",
  "blockNumber": 18234567,
  "gasFeeUSD": 0.0412,
  "confirmedAt": "2026-05-22T10:00:15.000Z",
  "supabaseId": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Response (failure)**

```json
{
  "success": false,
  "error": "Mock USD settlement failed",
  "step": "settle",
  "txHash": null,
  "supabaseId": "660e8400-e29b-41d4-a716-446655440002"
}
```

### 10.5 All transaction-related endpoints

| Method | Path | Auth | Used by UI? |
|--------|------|------|-------------|
| POST | `/api/auth/nonce` | No | Yes |
| POST | `/api/auth/verify` | No | Yes |
| POST | `/api/auth/google` | No | Yes |
| POST | `/api/chat` | JWT | **Yes (primary)** |
| GET | `/api/chat/sessions` | JWT | Yes |
| DELETE | `/api/chat/sessions/:id` | JWT | Yes |
| GET | `/api/chat/history/:sessionId` | JWT | Yes |
| POST | `/api/transaction` | JWT | No (chat creates txs) |
| GET | `/api/transaction/history/:sessionId` | **No JWT** | Rarely |
| GET | `/api/transactions/:wallet` | JWT | Yes |
| GET | `/api/gallery/:wallet` | JWT | No (API exists) |
| GET | `/api/wallet` | JWT | Yes |
| POST | `/api/ugf/execute` | JWT | No (exported in api.ts only) |

---

## 11. Roles of Key Concepts

### Wallet connection

- **Purpose:** Identify user, enable EIP-191 login signature, display real ETH balance
- **Does not:** Sign chat-driven contract transactions
- **Components:** `Web3Provider`, ConnectKit, `WalletAuthSync`, `useWalletBalances`

### API calls

- **Purpose:** Auth, chat orchestration, persistence, history
- **Pattern:** `apiFetch` with Bearer token; 401 clears session

### Webhooks / events

- **Not implemented.** Status updates rely on:
  - Synchronous HTTP responses (limited)
  - Async DB patches (backend)
  - Client polling (`loadTransactionHistory`, wallet profile refetch)
  - Custom event `ugf:unauthorized` on 401

### Transaction hash / signature

| Term | Meaning in this app |
|------|---------------------|
| **Login signature** | ECDSA signature over nonce message → JWT |
| **tx_hash** | Ethereum transaction hash from UGF execution |
| **ugf_quote_id** | UGF digest used for quote/settle/status |
| **Placeholder `0x000...0`** | Frontend chat bubble when no real hash yet |

### Payment status updates

1. Initial: `transactions.status = 'pending'`, `executionStatus: 'pending'|'skipped'`
2. Async: patched to `success` or `failed` with `tx_hash`
3. UI: simulated timeline may show "completed" before DB has real hash
4. History refetch: source of truth for `tx_hash` in wallet panel

---

## 12. File & Folder Structure

```
UGF_AgentX/
├── docs/
│   └── TRANSACTION_SYSTEM.md          ← mirror of Frontend/Docs/Transaction.md
│
├── src/                               # Frontend
│   ├── components/
│   │   ├── Web3Provider.tsx           # Wagmi + ConnectKit (Base Sepolia)
│   │   ├── WalletAuthSync.tsx         # Nonce → sign → JWT
│   │   ├── wallet/
│   │   │   ├── WalletPanel.tsx        # Balances + tx history UI
│   │   │   └── transactionIcons.tsx
│   │   ├── chat/
│   │   │   ├── TransactionTimeline.tsx
│   │   │   ├── ChatBubble.tsx         # Mock USD cost display
│   │   │   └── ChatArea.tsx
│   │   └── auth/
│   │       └── LoginPage.tsx          # Google mock login
│   ├── hooks/
│   │   └── useWalletBalances.ts       # ETH on-chain + DB mock USD
│   ├── lib/
│   │   ├── api.ts                     # All HTTP endpoints
│   │   ├── transactionHistory.ts      # DB → UI mapping
│   │   ├── authStorage.ts
│   │   └── aiResponseEngine.ts        # ⚠️ Legacy local mock (unused)
│   ├── store/
│   │   └── useStore.ts                # submitPrompt, timeline simulation
│   └── types/
│       └── index.ts                   # TransactionState, MockTransaction
│
└── Backend/
    ├── supabase/
    │   └── schema.sql                 # DB tables
    ├── .env.example                   # UGF + Supabase + JWT vars
    └── src/
        ├── server.ts                  # Route mounting
        ├── config/
        │   └── env.ts                 # isUgfConfigured()
        ├── middleware/
        │   └── authMiddleware.ts      # JWT + assertWalletAccess
        ├── routes/
        │   ├── auth.ts                # nonce, verify, google
        │   ├── chat.ts                # ★ Primary transaction flow
        │   ├── transaction.ts         # CRUD + history + wallet + gallery
        │   └── ugf.ts                 # Direct UGF execute
        └── services/
            ├── ugfService.ts          # ★ UGF quote/settle/execute/poll
            ├── responseEngine.ts      # Timeline step templates
            ├── userService.ts
            ├── nonceStore.ts
            └── intentParser.ts        # ⚠️ Legacy (not wired to chat)
```

---

## 13. Security Checks & Validations

### Implemented

| Check | Location |
|-------|----------|
| JWT required on protected routes | `authMiddleware` |
| Wallet address must match JWT | `assertWalletAccess` |
| Valid Ethereum address on auth | `isAddress`, `getAddress` |
| Nonce single-use + expiry | `nonceStore` (5 min) |
| Signature verification | `viem.verifyMessage` |
| Session ownership for chat history | `assertSessionOwner` |
| UUID validation for session delete | `chat.ts` |
| Intent/calldata validation before chain | `tryExecuteOnChain` |

### Gaps / risks

| Issue | Severity | Detail |
|-------|----------|--------|
| `GET /api/transaction/history/:sessionId` unauthenticated | Medium | Anyone with session UUID can list user's transactions |
| Google `credential` only `jwt.decode` | Medium | No cryptographic verification against Google |
| `mockPayload` Google login | Low (intentional demo) | Open sandbox authentication |
| Default `JWT_SECRET` in dev | High if deployed | Must override in production |
| In-memory nonces | Medium | Lost on restart; not multi-instance safe |
| `mockusd_balance` not tied to UGF vault | Medium | Display can disagree with actual Mock USD |
| UI success before chain confirms | Low UX | Misleading timeline vs async backend |
| Server private key in env | Critical | Must use dedicated testnet wallet only |

---

## 14. Edge Cases & Failure Scenarios

| Scenario | System behavior |
|----------|-----------------|
| UGF env vars missing | DB `pending`, `executionStatus: skipped`, UI still animates timeline |
| UGF quote fails | `UgfStepError('quote')`, tx → `failed` |
| Mock USD settlement fails | `UgfStepError('settle')` — vault underfunded, etc. |
| `sponsorAndExecute` fails | `UgfStepError('execute')` |
| Status poll timeout (30s) | `UgfStepError('confirm')`, may leave `pending` |
| DONATE without `0x` recipient | Execution skipped (name-only recipient) |
| MINT with name "Jay" not address | Mints to **user's wallet** |
| UNKNOWN intent | No transaction row; generic assistant reply |
| User rejects wallet signature | Toast, auth cleared |
| Nonce expired on verify | Auto-retry once in `WalletAuthSync` |
| JWT expired mid-session | 401 → clear auth, `ugf:unauthorized` |
| Google user | Skips Wagmi auth; uses deterministic address |
| Wallet disconnect | Clears token, history, sessions |
| Async race | HTTP returns before tx completes; refresh history for hash |
| `total_transactions` counter | Never incremented in code — may show 0 |
| Chat bubble without tx hash | Shows 64 zero hex chars as placeholder |

---

## 15. Configuration Matrix

| Variable | Required for | Effect if missing |
|----------|--------------|-------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | DB | Backend warnings; DB ops fail |
| `GEMINI_API_KEY` | AI fallback intent | Only regex parsing for unknown phrases |
| `JWT_SECRET` | Auth | Weak default in dev |
| `UGF_SIGNER_PRIVATE_KEY` | On-chain | Transactions DB-only (`skipped`) |
| `NFT_CONTRACT_ADDRESS` | On-chain | Same as above |
| `UGF_API_KEY` | UGF API (optional) | Anonymous UGF client |
| `VITE_BACKEND_URL` | Frontend API | Defaults to localhost:5000 |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect | Connect may fail |

### Enabling real on-chain transactions

1. Deploy contract with `mintBadge` and `donate` on Base Sepolia
2. Set `NFT_CONTRACT_ADDRESS`
3. Create testnet signer wallet; set `UGF_SIGNER_PRIVATE_KEY`
4. Fund signer with **TYI Mock USD** on UGF dashboard
5. Optionally set `UGF_API_KEY` and `BASE_SEPOLIA_RPC_URL`
6. Restart backend — `isUgfConfigured()` returns true

---

## Appendix A — Mock gas estimate formula

From `buildGasEstimate()` in `chat.ts`:

| Intent | Base (USD) | Extra |
|--------|------------|-------|
| MINT_BADGE | $0.05 | + $0.01 × recipient name length |
| CLAIM_CERT | $0.04 | — |
| DONATE | $0.03 | + 0.5% of amount |
| SEND_REWARD | $0.04 | + 0.3% of amount |

Final value: `(base + extra) × (0.9 + random × 0.2)`, rounded to 4 decimals.

---

## Appendix B — Actual money / tokens

| Asset | Real? | Notes |
|-------|-------|-------|
| TYI Mock USD (gas) | Testnet only | Server signer vault via UGF |
| Mock USD in `donate()` | Testnet contract units | 6-decimal token in contract |
| ETH in user wallet | Real testnet ETH | Display only; not spent on gas in UGF flow |
| Fiat USD | **Never** | No payment processor |
| Mainnet tokens | **Never** | Base Sepolia only |

---

## Appendix C — Improvements (not implemented)

For reference if hardening the system:

1. Wire frontend timeline to polling `GET /api/transactions/:id` or WebSocket
2. Use live UGF `quote.get()` for chat `gasEstimate` when configured
3. Add auth to `GET /api/transaction/history/:sessionId`
4. Verify Google ID tokens properly
5. Increment `total_transactions` / sync `mockusd_balance` from UGF
6. Remove placeholder tx hash in chat bubbles when hash is null

---

*Generated from static analysis of the UGF AgentX repository.*
