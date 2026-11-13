// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/**
 * @title MockEIP3009Token
 * @notice TEST-ONLY ERC-20 implementing EIP-3009 `transferWithAuthorization`
 *         with the same semantics and ABI as Circle's FiatToken (USDC), so
 *         the x402 `exact` settlement path can be exercised end to end on a
 *         local Hardhat node. Never deployed to any public network — the real
 *         integration uses Circle USDC on Fuji.
 *
 * Mirrors FiatTokenV2_2: both the (v,r,s) and the (bytes signature)
 * overloads, `authorizationState`, `AuthorizationUsed`, `validAfter` is
 * exclusive and `validBefore` exclusive, ERC-1271 signers supported.
 */
contract MockEIP3009Token is ERC20, EIP712 {
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256(
            "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
        );

    uint8 private immutable _tokenDecimals;
    string private _tokenVersion;
    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory version_,
        uint8 decimals_
    ) ERC20(name_, symbol_) EIP712(name_, version_) {
        _tokenDecimals = decimals_;
        _tokenVersion = version_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function version() external view returns (string memory) {
        return _tokenVersion;
    }

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, abi.encodePacked(r, s, v));
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) external {
        _transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, signature);
    }

    function _transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) private {
        require(block.timestamp > validAfter, "FiatTokenV2: authorization is not yet valid");
        require(block.timestamp < validBefore, "FiatTokenV2: authorization is expired");
        require(!_authorizationStates[from][nonce], "FiatTokenV2: authorization is used or canceled");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)
            )
        );
        require(SignatureChecker.isValidSignatureNow(from, digest, signature), "FiatTokenV2: invalid signature");

        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }
}
