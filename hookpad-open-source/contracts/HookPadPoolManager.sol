// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";

/// @notice X Layer testnet deployable Uniswap V4 PoolManager build.
/// @dev Inherits the official Uniswap V4 core PoolManager so Hardhat emits a local artifact.
contract HookPadPoolManager is PoolManager {
    constructor(address initialOwner) PoolManager(initialOwner) {}
}
