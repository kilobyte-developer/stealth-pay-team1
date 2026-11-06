// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title IERC5564Announcer
 * @notice Canonical ERC-5564 announcement interface.
 *
 * Verified against the Announcer deployed at the ERC's canonical address
 * 0x55649E01B5Df198D18D95b5cc5051630cfD45564 on Avalanche mainnet:
 *
 *   announce(uint256,address,bytes,bytes)                    selector 0x4d1f9583
 *   Announcement(uint256,address,address,bytes,bytes)        topic0
 *     0x5f0eab8057630ba7676c49b4f21a0231414e79474595be8e4c432fbf6bf0f4e7
 *
 * Both appear in that contract's 709-byte runtime bytecode. Do not alter this
 * signature: changing it would break every standards-compatible scanner.
 *
 * Spec: https://ercs.ethereum.org/ERCS/erc-5564
 */
interface IERC5564Announcer {
    /**
     * @param schemeId Cryptographic scheme id. StealthPay uses 1 (SECP256k1).
     * @param stealthAddress The one-time address the payment was sent to.
     * @param caller The `msg.sender` of `announce`. When a router announces on
     *        a payer's behalf this is the ROUTER, not the payer's EOA.
     * @param ephemeralPubKey The sender's ephemeral public key for this payment.
     * @param metadata Per ERC-5564 the FIRST byte is the view tag.
     */
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external;
}
