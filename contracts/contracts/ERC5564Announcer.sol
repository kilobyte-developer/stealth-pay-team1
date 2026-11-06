// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC5564Announcer} from "./interfaces/IERC5564Announcer.sol";

/**
 * @title ERC5564Announcer
 * @notice The ERC-5564 reference Announcer: a permissionless singleton whose
 *         only job is to emit the standard `Announcement` event.
 *
 * It holds no state, no funds and no privileges. Anyone may announce anything,
 * which is why an announcement is only a CLAIM — never proof that a transfer
 * occurred. Receivers must verify the actual asset movement separately.
 *
 * ## Why this is deployed rather than reused on Fuji
 * The ERC's canonical address 0x55649E01B5Df198D18D95b5cc5051630cfD45564 has
 * deployed bytecode on Avalanche mainnet but **none on Fuji** (`eth_getCode`
 * returns `0x`). Reproducing the canonical address would require the original
 * deterministic-deployment init code and salt, which the ERC does not publish.
 * StealthPay therefore deploys this reference implementation once on Fuji and
 * records the resulting address. See docs/DEPLOYMENT.md.
 *
 * The emitted event signature is byte-identical to the canonical one, so
 * standards-compatible scanners work unmodified.
 */
contract ERC5564Announcer is IERC5564Announcer {
    /// @inheritdoc IERC5564Announcer
    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external {
        emit Announcement(
            schemeId,
            stealthAddress,
            msg.sender,
            ephemeralPubKey,
            metadata
        );
    }
}
