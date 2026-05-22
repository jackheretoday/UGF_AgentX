# Deploy `UGFAgentXBadge` on Base Sepolia (full steps)

This contract matches what the AgentX backend calls in `Backend/src/routes/chat.ts`:

- `mintBadge(address to, string tokenURI)`
- `donate(address to, uint256 amount)`

After deployment you set:

```env
NFT_CONTRACT_ADDRESS=0xYourDeployedAddress
```

---

## What you need before starting

| Item | Where to get it |
|------|-----------------|
| **Base Sepolia ETH** | Free testnet ETH — [Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) or [Alchemy faucet](https://www.alchemy.com/faucets/base-sepolia) |
| **Wallet** | MetaMask, Rabby, or Coinbase Wallet with **Base Sepolia** network added |
| **Contract code** | `contracts/UGFAgentXBadge.sol` in this repo |

Chain details:

- **Network:** Base Sepolia  
- **Chain ID:** `84532`  
- **RPC:** `https://sepolia.base.org`  
- **Explorer:** https://sepolia.basescan.org  

---

## Method A — Remix (recommended, no local Solidity install)

### Step 1 — Open Remix

1. Go to https://remix.ethereum.org  
2. In the file explorer (left), create a folder `contracts/` if needed.  
3. Create file `UGFAgentXBadge.sol` and paste the full contents from:

   `contracts/UGFAgentXBadge.sol` in this repository.

### Step 2 — Compiler version (fix `ParserError` / OpenZeppelin)

OpenZeppelin’s current `ERC721.sol` requires **Solidity ^0.8.24**.

1. Open the **Solidity Compiler** tab.  
2. Set compiler to **0.8.24** (or **0.8.26** — not 0.8.20).  
3. Open **Advanced Configurations** → set **EVM Version** to **`cancun`** (required for OpenZeppelin 5.x `mcopy`).  
4. Click **Compile** again.

If you see:

```text
Source file requires different compiler version ... current compiler is 0.8.20 ... pragma solidity ^0.8.24
```

→ Change Remix compiler to **0.8.24+** and recompile.

If you see:

```text
DeclarationError: Function "mcopy" not found.
```

→ Set **EVM Version: cancun** (not `paris` / default), keep compiler **0.8.24+**, then recompile.

**Alternative:** skip OpenZeppelin and use **Standalone contract** below (works with **0.8.20** + default EVM — no `mcopy`).

### Step 2b — Add OpenZeppelin in Remix (if using `UGFAgentXBadge.sol`)

Remix loads OpenZeppelin from GitHub/npm when you import `@openzeppelin/...`.

If compile fails on `@openzeppelin/...` imports:

1. In Remix file explorer, click **contracts** → right-click → **New Folder** → name it `@openzeppelin`.  
2. Easier: use **Remix GitHub import**:
   - In Remix terminal or use the plugin: import from npm in Remix 0.46+:
   - Go to **File Explorer** → click **connect to local** or use **npm** module:
   - In Remix, **Solidity Compiler** → enable **"via IR"** off, then add remappings in `remix.config.json` OR paste a **flattened** contract (see Method B).

**Simplest Remix fix:** use the standalone contract below (no OpenZeppelin imports) in Remix — copy from section **“Standalone contract (Remix, no imports)”** at the end of this doc.

### Step 3 — Compile

1. Open **Solidity Compiler**.  
2. Compiler: **0.8.24** (required for OpenZeppelin) or **0.8.20** only for `UGFAgentXBadgeStandalone.sol`.  
3. Click **Compile UGFAgentXBadge.sol**.  
4. Fix any errors before continuing.

### Step 4 — Connect wallet to Base Sepolia

In MetaMask (or your wallet):

1. Add network **Base Sepolia** if missing:
   - Network name: `Base Sepolia`
   - RPC URL: `https://sepolia.base.org`
   - Chain ID: `84532`
   - Currency: `ETH`
   - Explorer: `https://sepolia.basescan.org`
2. Switch to **Base Sepolia**.  
3. Ensure you have a small amount of testnet ETH (faucet links above).

In Remix:

1. Open **Deploy & Run** tab.  
2. **Environment:** `Injected Provider - MetaMask` (or WalletConnect).  
3. Confirm the network shows **Custom (84532)** or **Base Sepolia**.

### Step 5 — Deploy

1. **Contract:** select `UGFAgentXBadge`.  
2. **Deploy** parameter `initialOwner`:
   - Use your wallet address (the one that will own the contract), e.g. the same address you will put in `UGF_SIGNER_PRIVATE_KEY` **OR** your personal admin wallet.
   - **Important for AgentX:** The backend calls `mintBadge` / `donate` via the **UGF server signer**. This repo’s contract uses `onlyOwner`, so **`initialOwner` must be the UGF signer address** (the address derived from `UGF_SIGNER_PRIVATE_KEY` in `.env`).

   Get signer address:

   ```bash
   cd Backend
   npm run generate:signer   # if you haven't already — or derive from existing key
   ```

   Or in Node:

   ```bash
   node -e "const {Wallet}=require('ethers'); console.log(new Wallet(process.env.UGF_SIGNER_PRIVATE_KEY).address)"
   ```

   Pass that address as `initialOwner` when deploying.

3. Click **Deploy** and confirm the transaction in your wallet.  
4. Wait for confirmation on Base Sepolia.

### Step 6 — Copy contract address

1. In Remix, under **Deployed Contracts**, expand your contract.  
2. Copy the **contract address** (starts with `0x`, 42 characters).  
3. Open `Backend/.env` and set:

   ```env
   NFT_CONTRACT_ADDRESS=0x<PasteAddressHere>
   ```

### Step 7 — Verify on Basescan (optional)

1. Open `https://sepolia.basescan.org/address/<YOUR_ADDRESS>`  
2. You should see a recent **Contract Creation** transaction.

### Step 8 — Restart backend and test

```bash
cd Backend
npm run check:ugf
npm run dev
```

```bash
curl http://localhost:5000/health
# ugfConfigured: true (also needs UGF_SIGNER_PRIVATE_KEY set)
```

In the app: **Claim certificate** or **Mint badge**.

---

## Method B — Foundry (for developers)

### Prerequisites

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Setup in repo

```bash
cd /mnt/localdisk/UGF_AgentX
forge init contracts-foundry --no-commit  # OR use existing contracts/ folder
```

Minimal `foundry.toml` in project root (if using `contracts/`):

```toml
[profile.default]
src = "contracts"
out = "out"
libs = ["lib"]
solc = "0.8.20"

[rpc_endpoints]
base_sepolia = "https://sepolia.base.org"
```

Install OpenZeppelin:

```bash
cd /path/to/your/foundry/project
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

Add remapping in `foundry.toml`:

```toml
remappings = ["@openzeppelin/=lib/openzeppelin-contracts/"]
```

Copy `contracts/UGFAgentXBadge.sol` into `src/` if using standard Foundry layout.

### Deploy

```bash
# Export deployer key (wallet with Base Sepolia ETH)
export DEPLOYER_PRIVATE_KEY=0x...
# Must match UGF_SIGNER_PRIVATE_KEY if contract is onlyOwner and backend is signer
export OWNER_ADDRESS=$(cast wallet address $DEPLOYER_PRIVATE_KEY)

forge create contracts/UGFAgentXBadge.sol:UGFAgentXBadge \
  --constructor-args $OWNER_ADDRESS \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

Copy the **Deployed to:** address into `NFT_CONTRACT_ADDRESS`.

---

## Owner vs UGF signer (critical)

The provided `UGFAgentXBadge` uses OpenZeppelin **`onlyOwner`** on `mintBadge` and `donate`.

The AgentX backend executes transactions with **`UGF_SIGNER_PRIVATE_KEY`**, not the user’s connected wallet.

Therefore:

```
initialOwner (deploy)  ===  address(UGF_SIGNER_PRIVATE_KEY)
```

If you deploy with MetaMask address A but set `UGF_SIGNER_PRIVATE_KEY` to wallet B, every mint/claim will **revert** with “Ownable: caller is not the owner”.

**Fix:** Either:

1. Deploy with `initialOwner` = UGF signer address (recommended), or  
2. After deploy, call `transferOwnership(ugfSignerAddress)` from the current owner.

---

## Wire into `.env` (complete block)

```env
UGF_SIGNER_PRIVATE_KEY=0x64_hex_char_private_key
NFT_CONTRACT_ADDRESS=0x40_hex_char_contract_address
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

Then:

```bash
cd Backend
npm run check:ugf
npm run dev
```

---

## Standalone contract (Remix, no OpenZeppelin imports)

If Remix cannot resolve `@openzeppelin` imports, paste this single file as `UGFAgentXBadgeStandalone.sol` in Remix, compile with 0.8.20, deploy with `initialOwner` = your UGF signer address:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UGFAgentXBadgeStandalone {
    string public name = "UGF AgentX Badge";
    string public symbol = "UGFBADGE";
    address public owner;
    uint256 private _nextTokenId;

    mapping(uint256 => address) private _owners;
    mapping(uint256 => string) private _tokenURIs;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event BadgeMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event Donated(address indexed from, address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        owner = initialOwner;
    }

    function mintBadge(address to, string calldata uri) external onlyOwner {
        require(to != address(0), "Invalid to");
        uint256 tokenId = _nextTokenId++;
        _owners[tokenId] = to;
        _tokenURIs[tokenId] = uri;
        emit Transfer(address(0), to, tokenId);
        emit BadgeMinted(to, tokenId, uri);
    }

    function donate(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        emit Donated(msg.sender, to, amount);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "Nonexistent token");
        return _tokenURIs[tokenId];
    }

    function balanceOf(address account) external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < _nextTokenId; i++) {
            if (_owners[i] == account) count++;
        }
        return count;
    }
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Deploy fails “insufficient funds” | Get Base Sepolia ETH from a faucet |
| `ugfConfigured` still false | Set **both** `UGF_SIGNER_PRIVATE_KEY` and `NFT_CONTRACT_ADDRESS`, restart backend |
| Claim fails at “Executing” | Owner must be UGF signer; check Basescan for reverted tx |
| Wrong network | Wallet and RPC must be **Base Sepolia** (84532), not Ethereum Sepolia |
| Contract not verified | Optional; execution works without verification |
| `ParserError` / compiler ^0.8.24 | Set Remix compiler to **0.8.24+**, or use standalone contract with 0.8.20 |
| `mcopy` not found | Solidity **0.8.24+** and EVM version **`cancun`** in Remix Advanced Config |

---

## Next steps

1. [SETUP_UGF.md](./SETUP_UGF.md) — signer key, UGF API, Mock USD funding  
2. `npm run check:ugf`  
3. Test **Claim certificate** in the app  
