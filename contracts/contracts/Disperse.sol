// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Disperse - batch ERC-20 payroll in a single transaction
/// @notice Non-custodial: the contract never holds funds. It pulls tokens from
///         the caller via `transferFrom` (after the caller has approved this
///         contract on the token), and forwards them to each recipient.
/// @dev    No owner, no admin, no off-switch. Caller controls everything via
///         their ERC-20 approval, which they can revoke at any time.
contract Disperse {
    /// @notice Emitted once per batch. The individual ERC-20 Transfer events
    ///         emitted by the token itself are the source of truth per-recipient.
    event Dispersed(
        address indexed token,
        address indexed sender,
        uint256 totalRecipients,
        uint256 totalAmount
    );

    error LengthMismatch();
    error TransferFailed(address recipient, uint256 amount);

    /// @notice Send `amounts[i]` of `token` to `recipients[i]` for every i,
    ///         all in one transaction. Reverts (and rolls back) if any
    ///         single transfer fails — atomic, all-or-nothing.
    function disperseToken(
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        if (recipients.length != amounts.length) revert LengthMismatch();

        uint256 total;
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 amount = amounts[i];
            total += amount;
            bool ok = token.transferFrom(msg.sender, recipients[i], amount);
            if (!ok) revert TransferFailed(recipients[i], amount);
        }

        emit Dispersed(address(token), msg.sender, recipients.length, total);
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}