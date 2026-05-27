// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract FeeVault {
    address public immutable poolOwner;
    uint256 public totalProtectedFees;

    event ProtectedFeeReceived(address indexed token, address indexed from, uint256 amount);

    constructor(address owner) {
        require(owner != address(0), "OWNER_REQUIRED");
        poolOwner = owner;
    }

    function recordProtectedFee(address token, uint256 amount) external {
        require(amount > 0, "AMOUNT_REQUIRED");
        totalProtectedFees += amount;
        emit ProtectedFeeReceived(token, msg.sender, amount);
    }
}
