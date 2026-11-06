// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC5564Announcer} from "../interfaces/IERC5564Announcer.sol";

/// @notice Announcer that always reverts, to prove payments are atomic with
///         their announcement.
contract RevertingAnnouncer is IERC5564Announcer {
    error AnnouncerFailed();

    function announce(uint256, address, bytes calldata, bytes calldata)
        external
        pure
    {
        revert AnnouncerFailed();
    }
}

/// @notice Reverts only on the Nth call, so the ERC-20 + gas-top-up path can be
///         tested for partial-failure atomicity.
contract FailOnNthAnnouncer is IERC5564Announcer {
    uint256 public immutable failOnCall;
    uint256 public calls;

    error AnnouncerFailedOnCall(uint256 callNumber);

    constructor(uint256 failOnCall_) {
        failOnCall = failOnCall_;
    }

    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external {
        calls += 1;
        if (calls == failOnCall) revert AnnouncerFailedOnCall(calls);
        emit Announcement(
            schemeId,
            stealthAddress,
            msg.sender,
            ephemeralPubKey,
            metadata
        );
    }
}

/// @notice Rejects incoming native value, to test native-transfer failure.
contract NativeRejector {
    error NoThanks();

    receive() external payable {
        revert NoThanks();
    }
}

/**
 * @notice Re-enters the router when it receives native value, and RECORDS the
 *         outcome instead of bubbling it.
 *
 * Swallowing the inner revert is deliberate: if this mock bubbled, the outer
 * payment would fail with `NativeTransferFailed` and the test could not tell
 * whether the reentrancy guard fired or the transfer simply failed. By
 * recording `innerRevertData`, a test can assert the guard specifically.
 */
contract ReentrantNativeReceiver {
    address public router;
    bytes public payload;
    bool public innerCalled;
    bool public innerFailed;
    bytes public innerRevertData;
    bool private _attacking;

    function setAttack(address router_, bytes calldata payload_) external {
        router = router_;
        payload = payload_;
    }

    receive() external payable {
        if (router != address(0) && !_attacking) {
            _attacking = true;
            innerCalled = true;
            (bool ok, bytes memory err) = router.call{value: 0}(payload);
            innerFailed = !ok;
            innerRevertData = err;
            _attacking = false;
        }
    }
}
