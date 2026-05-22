# Fix: `UGF settlement failed` / HTTP 400

Your logs show **quote worked** but **settle failed** at `payment/submit` (UGF gateway HTTP 400).

That means env + contract are OK; the **UGF signer wallet** cannot complete Mock USD settlement.

---

## What failed (your log)

```
[WARN] UGF settlement failed UGFError: HTTP 400
```

Typical flow:

1. Quote — OK  
2. **Settle** — pays gas in **TYI Mock USD** via UGF vault or x402 — **FAILED here**  
3. Execute on-chain — never reached  

---

## Fix checklist (do in order)

### 0. Run diagnostics (shows balance + exact signer)

```bash
cd Backend
npm run diagnose:ugf
```

If `Balance: 0 TYI_MOCK_USD`, fund the printed signer at the faucet below before retrying.

### 1. Confirm signer address

```bash
cd Backend
npm run signer:address
```

This address must be:

- `UGF_SIGNER_PRIVATE_KEY` in `.env`
- **`initialOwner`** when you deployed `UGFAgentXBadgeStandalone`
- The wallet you fund on the **UGF dashboard**

### 2. Fund TYI Mock USD on UGF (most common fix)

1. Open the **UGF / Tychi testnet dashboard** (from your team or https://universalgasframework.com).  
2. Find **vault** / **TYI_MOCK_USD** / **Base Sepolia**.  
3. **Deposit / fund** Mock USD for the **signer address** from step 1.  
4. Amount: more than the gas shown in the UI (e.g. $0.10+ for testing).

Without Mock USD in the UGF vault, settlement returns **HTTP 400**.

### 2b. HTTP 429 on UGF auth

If logs show `UGF auth failed ... HTTP 429`, the gateway rate-limited too many wallet logins (e.g. clicking **Claim** several times quickly).

- Wait **30–60 seconds**, then try **once**
- Restart backend after pulling latest code (JWT is cached ~10 min to reduce logins)
- Do not spam claim while balance is still zero

### 3. Signer needs Base Sepolia ETH (vault mode)

If the quote uses **`payment_mode: vault`**, UGF may charge the vault via an on-chain `payForFuel` tx. That tx costs **a little Base Sepolia ETH** on the signer wallet.

Check ETH: https://sepolia.basescan.org/address/YOUR_SIGNER_ADDRESS

Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

### 4. Restart backend after `.env` changes

```bash
# Stop old server on port 5000 first (Ctrl+C in that terminal)
npm run dev
```

### 5. Retry claim

Watch the terminal — after the fix you should see execution continue past settle to **execute** / **mining**.

The UI failure reason should now include the **exact UGF API message** (not only "HTTP 400").

---

## Two settlement modes

| Mode | What UGF expects |
|------|------------------|
| **vault** | Mock USD balance in UGF vault + usually a small ETH tx from signer |
| **x402** | TYI token + ERC-3009 signature from signer (SDK default in docs) |

The SDK picks the mode from the quote response. You do not choose it in AgentX.

---

## Contract owner check

If settle succeeds but **execute** fails with "Not owner":

- Redeploy contract with `initialOwner` = `npm run signer:address`  
- Or use the same wallet for deploy and `UGF_SIGNER_PRIVATE_KEY`

---

## Verify health

```bash
curl http://localhost:5000/health
# ugfConfigured: true

npm run check:ugf
```

---

## Still stuck?

Copy the **new** log line after retry (it should include more detail than `HTTP 400`) and check:

- Signer address on Basescan (ETH balance)  
- UGF dashboard vault balance for TYI Mock USD  
- Contract `owner()` on Basescan read contract → should match signer  
