# UGF AgentX — NFT contract

Solidity source: `UGFAgentXBadge.sol`

Required functions for the backend:

| Function | Used for |
|----------|----------|
| `mintBadge(address to, string tokenURI)` | Mint badge, claim certificate, send reward |
| `donate(address to, uint256 amount)` | Donate (amount = 6 decimals in backend) |

**Easiest Remix guide:** [../Backend/docs/REMIX_QUICKSTART.md](../Backend/docs/REMIX_QUICKSTART.md)  
**Full guide:** [../Backend/docs/DEPLOY_CONTRACT_BASE_SEPOLIA.md](../Backend/docs/DEPLOY_CONTRACT_BASE_SEPOLIA.md)

**Use this file in Remix:** `UGFAgentXBadgeStandalone.sol` (compiler **0.8.20**, no OpenZeppelin).
