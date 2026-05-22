# Easiest Remix deploy (5 minutes)

Use **`contracts/UGFAgentXBadgeStandalone.sol`** — one file, no OpenZeppelin, no `mcopy` errors.

---

## Before Remix

### 1. Base Sepolia ETH

- Add network in MetaMask: **Base Sepolia**, Chain ID **84532**, RPC `https://sepolia.base.org`
- Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

### 2. UGF signer key in `.env`

```bash
cd Backend
npm run generate:signer    # once — copy private key to .env
npm run signer:address     # copy this address for deploy ↓
```

`Backend/.env`:

```env
UGF_SIGNER_PRIVATE_KEY=0x...
```

**Deploy `initialOwner` = that signer address** (not a random MetaMask address).

---

## Remix steps

### 1. Open Remix

https://remix.ethereum.org

### 2. Add the contract

1. Left panel → **contracts** folder  
2. New file: `UGFAgentXBadgeStandalone.sol`  
3. Copy **all** of `contracts/UGFAgentXBadgeStandalone.sol` from this repo and paste

### 3. Compile

| Setting | Value |
|---------|--------|
| Compiler | **0.8.20** (or 0.8.24) |
| EVM | default is fine |

Click **Compile UGFAgentXBadgeStandalone.sol** → green checkmark.

### 4. Connect wallet

1. **Deploy & Run** tab (left)  
2. **Environment:** `Injected Provider - MetaMask`  
3. MetaMask → network **Base Sepolia**

### 5. Deploy

| Field | Value |
|-------|--------|
| Contract | `UGFAgentXBadgeStandalone` |
| `initialOwner` | Your `npm run signer:address` output |

Click **Deploy** → confirm in MetaMask.

### 6. Copy contract address

Under **Deployed Contracts**, copy the address (e.g. `0x1234...`).

### 7. Update `.env`

```env
NFT_CONTRACT_ADDRESS=0x<PasteDeployedAddress>
```

Restart backend:

```bash
cd Backend
npm run check:ugf
npm run dev
```

`curl http://localhost:5000/health` → `"ugfConfigured": true`

---

## Done

Test **Claim certificate** in the app.

---

## Do NOT use (harder path)

- `UGFAgentXBadge.sol` with `@openzeppelin` imports — needs compiler 0.8.24 + EVM **cancun**

Use standalone only for Remix.
