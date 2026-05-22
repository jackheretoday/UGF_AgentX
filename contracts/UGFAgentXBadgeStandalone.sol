// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Remix-friendly contract for UGF AgentX (no OpenZeppelin).
 * Deploy on Base Sepolia with initialOwner = UGF signer address (npm run signer:address).
 */
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
