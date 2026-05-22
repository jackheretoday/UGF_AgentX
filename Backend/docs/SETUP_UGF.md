# Enable On-Chain Execution (UGF + Base Sepolia)

Your health check shows `"ugfConfigured": false` because **`Backend/.env` is missing real UGF values**.

Chat actions (claim certificate, mint badge, donate) **cannot** hit the blockchain until both are set:

| Variable | Purpose |
|----------|---------|
| `UGF_SIGNER_PRIVATE_KEY` | Server wallet that signs UGF + contract txs (pays gas in TYI Mock USD) |
| `NFT_CONTRACT_ADDRESS` | Your deployed contract on Base Sepolia (`mintBadge`, `donate`) |
| *(none)* | UGF auth uses **wallet login** from `UGF_SIGNER_PRIVATE_KEY` only — no API key |

---

## Step 1 — Generate a testnet signer wallet

From `Backend/`:

```bash
npm run generate:signer
```

Copy the printed **private key** into `.env`:

```bash
UGF_SIGNER_PRIVATE_KEY=0x<64_hex_chars>
```

Save the **address** — you will fund it on the UGF dashboard.

---

## Step 2 — Deploy the NFT contract on Base Sepolia

**Full guide (Remix + Foundry):** [DEPLOY_CONTRACT_BASE_SEPOLIA.md](./DEPLOY_CONTRACT_BASE_SEPOLIA.md)

Contract source in repo: `contracts/UGFAgentXBadge.sol`

Quick summary:

1. Get Base Sepolia testnet ETH (faucet).
2. Set `UGF_SIGNER_PRIVATE_KEY` in `.env`, then run `npm run signer:address` — that address is **`initialOwner`** when you deploy.
3. Deploy via [Remix](https://remix.ethereum.org) (easiest) using the standalone contract in the deploy doc if OpenZeppelin imports fail.
4. Copy deployed address to `.env`:

```bash
NFT_CONTRACT_ADDRESS=0x<40_hex_chars>
```

---

## Settlement failed (HTTP 400)?

See **[UGF_SETTLEMENT_FIX.md](./UGF_SETTLEMENT_FIX.md)** — usually **fund TYI Mock USD** for the signer address on the UGF dashboard.

---

## Step 3 — Fund Mock USD vault (no API key)

1. Open the **UGF testnet dashboard** / [faucets](https://universalgasframework.com/faucets).
2. Fund the **signer address** (from Step 1) with **TYI Mock USD** (gas currency).

Without Mock USD on the signer, quote/settle will fail even if env vars are set.

---

## Step 4 — Restart and verify

```bash
# Stop the running backend (Ctrl+C), then:
cd Backend
npm run dev
```

In another terminal:

```bash
curl http://localhost:5000/health
```

Expected:

```json
{ "ugfConfigured": true, "onChainEnabled": true }
```

Also:

```bash
npm run check:ugf
```

---

## Step 5 — Try claim again

1. Hard refresh the frontend (Ctrl+Shift+R).
2. Connect wallet and sign login.
3. Send **Claim certificate**.

You should see the timeline progress: quote → settle → execute → mining → confirmed.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ugfConfigured: false` | Both `UGF_SIGNER_PRIVATE_KEY` and `NFT_CONTRACT_ADDRESS` must be non-empty valid `0x` values |
| Still false after editing `.env` | **Restart** `npm run dev` (env is loaded at startup) |
| Fails at “Settling Mock USD” | Fund signer with TYI Mock USD on UGF dashboard |
| Fails at “Executing” | Wrong contract address or contract missing `mintBadge` |
| Extension context invalidated | Refresh browser, reconnect wallet (extension was reloaded) |

**Security:** Use a **dedicated testnet wallet** only. Never commit `.env` or use a mainnet key.
