// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UGFAgentXBadge
 * @notice Minimal contract for UGF AgentX backend (Base Sepolia).
 *         Exposes mintBadge(to, tokenURI) and donate(to, amount) as required by Backend/src/routes/chat.ts
 */
contract UGFAgentXBadge is ERC721, Ownable {
    uint256 private _nextTokenId;

    event BadgeMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event Donated(address indexed from, address indexed to, uint256 amount);

    constructor(address initialOwner)
        ERC721("UGF AgentX Badge", "UGFBADGE")
        Ownable(initialOwner)
    {}

    /// @dev Called by UGF-sponsored server signer for MINT_BADGE, CLAIM_CERT, SEND_REWARD
    function mintBadge(address to, string calldata uri) external onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        emit BadgeMinted(to, tokenId, uri);
    }

    /**
     * @dev Called for DONATE intent. Amount uses 6 decimals (Mock USD units) in the backend.
     *      This demo contract records the donation on-chain; wire a real ERC20 transfer if you use Mock USD token.
     */
    function donate(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        emit Donated(msg.sender, to, amount);
    }
}
