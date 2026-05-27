// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFairLaunchHook {
    struct LaunchConfig {
        uint64 launchStart;
        uint64 launchWindow;
        uint64 coolingWindow;
        uint16 baseFeeBps;
        uint16 firstWindowFeeBps;
        uint16 secondWindowFeeBps;
        uint16 lateWindowFeeBps;
        uint16 sizePenaltyBps;
        uint16 exposurePenaltyBps;
        uint256 maxBuyPerTx;
        uint256 maxBuyPerWallet;
        address vault;
        address owner;
    }

    struct SwapDecision {
        uint8 phase;
        bool allowed;
        uint16 feeBps;
        uint256 vaultAmount;
        string reason;
    }

    function configureLaunch(bytes32 poolId, LaunchConfig calldata config) external;

    function previewSwap(
        bytes32 poolId,
        address wallet,
        bool isBuy,
        uint256 amount
    ) external view returns (SwapDecision memory decision);

    function recordSwap(bytes32 poolId, address wallet, bool isBuy, uint256 amount) external;
}

interface IFeeVault {
    function recordProtectedFee(address token, uint256 amount) external;
}

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice A minimal on-chain pool harness that triggers the FairLaunchHook with real transactions.
/// @dev This is not a replacement for Uniswap V4 PoolManager. It exists so judges can verify
/// hook decisions, fee collection, and blocked swaps on X Layer testnet while the official V4
/// integration is completed.
contract HookPadDemoPool {
    bytes32 public immutable poolId;
    IFairLaunchHook public immutable hook;
    IFeeVault public immutable vault;
    IERC20Like public immutable quoteToken;

    event DemoSwapExecuted(
        bytes32 indexed poolId,
        address indexed trader,
        bool isBuy,
        uint256 amount,
        uint16 feeBps,
        uint256 vaultAmount,
        string reason
    );

    constructor(
        bytes32 poolId_,
        address hook_,
        address vault_,
        address quoteToken_,
        IFairLaunchHook.LaunchConfig memory config
    ) {
        require(hook_ != address(0), "HOOK_REQUIRED");
        require(vault_ != address(0), "VAULT_REQUIRED");
        require(quoteToken_ != address(0), "TOKEN_REQUIRED");

        poolId = poolId_;
        hook = IFairLaunchHook(hook_);
        vault = IFeeVault(vault_);
        quoteToken = IERC20Like(quoteToken_);

        config.vault = vault_;
        config.owner = address(0);
        hook.configureLaunch(poolId_, config);
    }

    function executeSwap(bool isBuy, uint256 amount) external returns (IFairLaunchHook.SwapDecision memory decision) {
        decision = hook.previewSwap(poolId, msg.sender, isBuy, amount);
        require(decision.allowed, decision.reason);

        if (decision.vaultAmount > 0) {
            require(quoteToken.transferFrom(msg.sender, address(vault), decision.vaultAmount), "FEE_TRANSFER_FAILED");
            vault.recordProtectedFee(address(quoteToken), decision.vaultAmount);
        }

        hook.recordSwap(poolId, msg.sender, isBuy, amount);
        emit DemoSwapExecuted(poolId, msg.sender, isBuy, amount, decision.feeBps, decision.vaultAmount, decision.reason);
    }
}
