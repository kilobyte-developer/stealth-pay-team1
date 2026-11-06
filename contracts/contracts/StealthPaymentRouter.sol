// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC5564Announcer} from "./interfaces/IERC5564Announcer.sol";

/**
 * @title StealthPaymentRouter
 * @notice Moves a payment to a one-time stealth address and publishes the
 *         matching ERC-5564 announcement in the SAME transaction.
 *
 * ## What this contract is not
 * - Not a custodian. It never holds a balance between transactions, and it has
 *   no `receive`/`fallback`, so AVAX cannot be sent to it outside `payNative`
 *   / `payERC20`. Consequently there is no withdraw function — there is
 *   nothing to withdraw.
 * - Not a key manager. All stealth-address derivation happens off-chain in the
 *   client. No private key, shared secret or scalar ever touches this contract.
 * - Not a registry. It stores nothing about receivers.
 * - Not upgradeable, not ownable, not pausable. No admin role exists.
 *
 * ## Atomicity
 * Every path performs the transfer(s) and the announcement in one call. If any
 * required step reverts, the whole transaction reverts. There can never be a
 * settled payment without its announcement, nor an announcement without its
 * payment having settled through this router.
 *
 * ## Announcement `caller` semantics
 * The Announcer records `msg.sender`, which for these flows is THIS ROUTER —
 * not the payer's EOA. Scanners must not read `caller` as the payer. The payer
 * remains visible as the transaction's `from`, as it would anyway.
 *
 * ## Scheme id
 * Scheme 1 (SECP256k1) is a hard-coded constant rather than a parameter, so an
 * unsupported scheme cannot be announced through this router at all.
 *
 * NOT AUDITED. Fuji testnet only.
 */
contract StealthPaymentRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice ERC-5564 scheme id for SECP256k1. Not configurable.
    uint256 public constant SCHEME_ID = 1;

    /// @notice ERC-5564 metadata function identifier for native-token value.
    bytes4 public constant NATIVE_VALUE_SELECTOR = 0xeeeeeeee;

    /// @notice ERC-5564 sentinel address representing the native token.
    address public constant NATIVE_TOKEN_SENTINEL =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /**
     * @notice Selector recorded in ERC-20 announcement metadata.
     * @dev This router moves tokens with `transferFrom(address,address,uint256)`
     *      (selector 0x23b872dd), pulling from the payer straight to the
     *      stealth address, so the metadata names the operation actually
     *      executed rather than a plain `transfer`.
     */
    bytes4 public constant ERC20_TRANSFER_FROM_SELECTOR = 0x23b872dd;

    /// @notice Required length of a SEC1 compressed SECP256k1 public key.
    uint256 public constant EPHEMERAL_PUBKEY_LENGTH = 33;

    /// @notice The ERC-5564 Announcer this router publishes through.
    IERC5564Announcer public immutable announcer;

    error AnnouncerAddressZero();
    error StealthAddressZero();
    error ZeroAmount();
    error InvalidEphemeralPubKeyLength(uint256 provided, uint256 expected);
    error InvalidEphemeralPubKeyPrefix(bytes1 prefix);
    error TokenNotContract(address token);
    error NativeTransferFailed(address to, uint256 amount);
    error UnexpectedTokenAmountReceived(uint256 expected, uint256 received);
    error NativeValueNotAccepted();

    constructor(IERC5564Announcer announcer_) {
        if (address(announcer_) == address(0)) revert AnnouncerAddressZero();
        announcer = announcer_;
    }

    /* ------------------------------------------------------------------ */
    /*                              Validation                            */
    /* ------------------------------------------------------------------ */

    /**
     * @dev A compressed SECP256k1 point is 33 bytes beginning 0x02 or 0x03.
     *      This is a cheap encoding check, not an on-curve check — full point
     *      validation is done client-side where the curve maths lives.
     */
    function _validateEphemeralPubKey(bytes calldata ephemeralPubKey) private pure {
        if (ephemeralPubKey.length != EPHEMERAL_PUBKEY_LENGTH) {
            revert InvalidEphemeralPubKeyLength(
                ephemeralPubKey.length,
                EPHEMERAL_PUBKEY_LENGTH
            );
        }
        bytes1 prefix = ephemeralPubKey[0];
        if (prefix != 0x02 && prefix != 0x03) {
            revert InvalidEphemeralPubKeyPrefix(prefix);
        }
    }

    /* ------------------------------------------------------------------ */
    /*                          Metadata encoding                         */
    /* ------------------------------------------------------------------ */

    /**
     * @notice ERC-5564 metadata for a native-token transfer.
     * @dev Layout (57 bytes): viewTag(1) ‖ 0xeeeeeeee(4) ‖ sentinel(20) ‖ amount(32).
     *      The first byte is the view tag, as the standard requires.
     */
    function encodeNativeMetadata(bytes1 viewTag, uint256 amount)
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                viewTag,
                NATIVE_VALUE_SELECTOR,
                NATIVE_TOKEN_SENTINEL,
                amount
            );
    }

    /**
     * @notice ERC-5564 metadata for an ERC-20 transfer.
     * @dev Layout (57 bytes): viewTag(1) ‖ 0x23b872dd(4) ‖ token(20) ‖ amount(32).
     */
    function encodeERC20Metadata(
        bytes1 viewTag,
        address token,
        uint256 amount
    ) public pure returns (bytes memory) {
        return
            abi.encodePacked(
                viewTag,
                ERC20_TRANSFER_FROM_SELECTOR,
                token,
                amount
            );
    }

    /* ------------------------------------------------------------------ */
    /*                           Native payment                           */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Send native AVAX to a one-time stealth address and announce it.
     * @param stealthAddress The derived one-time destination.
     * @param ephemeralPubKey 33-byte compressed ephemeral public key.
     * @param viewTag First byte of the hashed shared secret.
     *
     * The full `msg.value` is forwarded. Nothing is retained by the router.
     */
    function payNative(
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes1 viewTag
    ) external payable nonReentrant {
        if (stealthAddress == address(0)) revert StealthAddressZero();
        if (msg.value == 0) revert ZeroAmount();
        _validateEphemeralPubKey(ephemeralPubKey);

        _sendNative(stealthAddress, msg.value);

        // Reverts the transfer above if the Announcer fails, preserving the
        // invariant that a settled payment always carries its announcement.
        announcer.announce(
            SCHEME_ID,
            stealthAddress,
            ephemeralPubKey,
            encodeNativeMetadata(viewTag, msg.value)
        );
    }

    /* ------------------------------------------------------------------ */
    /*                            ERC-20 payment                          */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Send an ERC-20 token to a one-time stealth address, optionally
     *         with a native AVAX gas top-up, and announce each asset.
     *
     * @param token ERC-20 contract.
     * @param stealthAddress The derived one-time destination.
     * @param amount Token amount, in the token's own decimals.
     * @param ephemeralPubKey 33-byte compressed ephemeral public key.
     * @param viewTag First byte of the hashed shared secret.
     *
     * ## Gas funding
     * A stealth address holding only tokens cannot pay its own gas, so it
     * cannot move those tokens. Any `msg.value` sent with this call is
     * forwarded to the same stealth address as a native top-up and announced
     * separately, producing two independently parseable announcements for one
     * destination: the token receipt and the gas receipt.
     *
     * Funding is sender-provided on purpose. Topping the address up later from
     * the receiver's own wallet would create exactly the public link to the
     * receiver's identity that stealth addresses exist to avoid.
     *
     * If `msg.value` is zero the token payment still succeeds, but the
     * destination will need native AVAX from somewhere before it can spend.
     *
     * ## Token compatibility
     * The amount credited to the destination is measured and must equal
     * `amount` exactly, which rejects fee-on-transfer and rebasing tokens
     * rather than silently under-delivering. A token that misreports
     * `balanceOf` can still defeat this; that is inherent to arbitrary tokens.
     */
    function payERC20(
        address token,
        address stealthAddress,
        uint256 amount,
        bytes calldata ephemeralPubKey,
        bytes1 viewTag
    ) external payable nonReentrant {
        if (stealthAddress == address(0)) revert StealthAddressZero();
        if (amount == 0) revert ZeroAmount();
        if (token.code.length == 0) revert TokenNotContract(token);
        _validateEphemeralPubKey(ephemeralPubKey);

        _pullTokenExact(token, msg.sender, stealthAddress, amount);

        announcer.announce(
            SCHEME_ID,
            stealthAddress,
            ephemeralPubKey,
            encodeERC20Metadata(viewTag, token, amount)
        );

        // Optional native gas top-up to the same destination.
        if (msg.value > 0) {
            _sendNative(stealthAddress, msg.value);
            announcer.announce(
                SCHEME_ID,
                stealthAddress,
                ephemeralPubKey,
                encodeNativeMetadata(viewTag, msg.value)
            );
        }
    }

    /* ------------------------------------------------------------------ */
    /*                               Internals                            */
    /* ------------------------------------------------------------------ */

    /**
     * @dev Pulls tokens straight from payer to destination — the router never
     *      holds them. SafeERC20 handles non-standard and non-boolean returns.
     *      The credited delta must equal `amount` exactly, which rejects
     *      fee-on-transfer and rebasing tokens.
     *
     *      Extracted into its own frame to keep `payERC20` off the "stack too
     *      deep" boundary without resorting to via-IR compilation.
     */
    function _pullTokenExact(
        address token,
        address from,
        address to,
        uint256 amount
    ) private {
        IERC20 erc20 = IERC20(token);
        uint256 balanceBefore = erc20.balanceOf(to);
        erc20.safeTransferFrom(from, to, amount);
        uint256 received = erc20.balanceOf(to) - balanceBefore;
        if (received != amount) {
            revert UnexpectedTokenAmountReceived(amount, received);
        }
    }

    /**
     * @dev Forwards native value with a full-gas call so contract destinations
     *      work, and reverts on failure. Re-entry is blocked by `nonReentrant`
     *      on the external entry points, and the router keeps no balance-derived
     *      state for a re-entrant call to manipulate.
     */
    function _sendNative(address to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert NativeTransferFailed(to, amount);
    }

    // No receive() / fallback(): native AVAX can only enter through the payment
    // functions, which forward it in full. This is why no rescue function exists.
}
