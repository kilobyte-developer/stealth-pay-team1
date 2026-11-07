// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title StealthPayTestToken
 * @notice Mintable ERC-20 faucet token deployed to Avalanche Fuji so the
 *         ERC-20 stealth-payment path (`StealthPaymentRouter.payERC20`) has a
 *         real, worthless-by-design token to move — not a mainnet asset, and
 *         not a mock compiled only for the test suite.
 *
 * `faucet` is deliberately open to anyone: this token carries no value, so
 * restricting who can mint it would only make testing harder for no benefit.
 *
 * NOT AUDITED. Fuji testnet only. Holds no real value.
 */
contract StealthPayTestToken is ERC20 {
    uint8 private constant TOKEN_DECIMALS = 6;

    /// @notice Upper bound per `faucet` call, in whole tokens (before decimals).
    uint256 public constant MAX_FAUCET_WHOLE_TOKENS = 1_000_000;

    error FaucetAmountTooLarge(uint256 requested, uint256 max);

    constructor() ERC20("StealthPay Test USD", "stUSD") {}

    function decimals() public pure override returns (uint8) {
        return TOKEN_DECIMALS;
    }

    /// @notice Mints `amount` (in this token's base units) to the caller.
    function faucet(uint256 amount) external {
        uint256 max = MAX_FAUCET_WHOLE_TOKENS * 10 ** TOKEN_DECIMALS;
        if (amount > max) revert FaucetAmountTooLarge(amount, max);
        _mint(msg.sender, amount);
    }
}
