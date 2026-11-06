// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Ordinary, well-behaved ERC-20 for happy-path tests.
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Burns a fee on every transfer, so the destination receives less
///         than requested. The router must reject this.
contract FeeOnTransferToken is ERC20 {
    uint256 public immutable feeBps;

    constructor(uint256 feeBps_) ERC20("FeeOnTransfer", "FOT") {
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = (value * feeBps) / 10_000;
            if (fee > 0) {
                super._update(from, address(0), fee);
                value -= fee;
            }
        }
        super._update(from, to, value);
    }
}

/// @notice Returns `false` instead of reverting on failure — the classic
///         non-compliant pattern SafeERC20 exists to catch.
contract FalseReturningToken is IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _total;

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        _total += amount;
    }

    function totalSupply() external view returns (uint256) {
        return _total;
    }

    function balanceOf(address a) external view returns (uint256) {
        return _balances[a];
    }

    function allowance(address o, address s) external view returns (uint256) {
        return _allowances[o][s];
    }

    function approve(address s, uint256 v) external returns (bool) {
        _allowances[msg.sender][s] = v;
        return true;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

/// @notice Reports a balance it never actually credits, to show that the
///         router's delta check depends on honest `balanceOf` reporting.
contract LyingBalanceToken is ERC20 {
    constructor() ERC20("Lying", "LIE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function balanceOf(address) public pure override returns (uint256) {
        return 0;
    }
}

/// @notice Re-enters the router from its own `transferFrom`.
contract ReentrantToken is ERC20 {
    address public router;
    bytes public payload;
    bool private _attacking;

    constructor() ERC20("Reentrant", "RE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setAttack(address router_, bytes calldata payload_) external {
        router = router_;
        payload = payload_;
    }

    function transferFrom(address from, address to, uint256 value)
        public
        override
        returns (bool)
    {
        if (router != address(0) && !_attacking) {
            _attacking = true;
            // Expected to bubble up ReentrancyGuardReentrantCall.
            (bool ok, bytes memory err) = router.call(payload);
            _attacking = false;
            if (!ok) {
                assembly {
                    revert(add(err, 0x20), mload(err))
                }
            }
        }
        return super.transferFrom(from, to, value);
    }
}
