// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMarketFairLaunchHook {
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

interface IMarketFeeVault {
    function recordProtectedFee(address token, uint256 amount) external;
}

interface IMarketToken {
    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Testnet market pool for a real purchase flow: quote token in, launch token out.
/// @dev This is a hackathon verification pool. It is intentionally simple, fixed-price,
/// and uses FairLaunchHook as the policy layer before executing the token transfers.
contract HookPadMarketPool {
    bytes32 public immutable poolId;
    IMarketFairLaunchHook public immutable hook;
    IMarketFeeVault public immutable vault;
    IMarketToken public immutable saleToken;
    IMarketToken public immutable quoteToken;
    address public immutable treasury;

    uint256 public totalQuoteCollected;
    uint256 public totalSaleTokenBought;

    event MarketBuyExecuted(
        bytes32 indexed poolId,
        address indexed buyer,
        uint256 quoteAmount,
        uint256 saleTokenAmount,
        uint256 vaultAmount,
        uint16 feeBps,
        string reason
    );

    constructor(
        bytes32 poolId_,
        address hook_,
        address vault_,
        address saleToken_,
        address quoteToken_,
        address treasury_,
        IMarketFairLaunchHook.LaunchConfig memory config
    ) {
        require(hook_ != address(0), "HOOK_REQUIRED");
        require(vault_ != address(0), "VAULT_REQUIRED");
        require(saleToken_ != address(0), "SALE_TOKEN_REQUIRED");
        require(quoteToken_ != address(0), "QUOTE_TOKEN_REQUIRED");
        require(treasury_ != address(0), "TREASURY_REQUIRED");

        poolId = poolId_;
        hook = IMarketFairLaunchHook(hook_);
        vault = IMarketFeeVault(vault_);
        saleToken = IMarketToken(saleToken_);
        quoteToken = IMarketToken(quoteToken_);
        treasury = treasury_;

        config.vault = vault_;
        config.owner = address(0);
        IMarketFairLaunchHook(hook_).configureLaunch(poolId_, config);
    }

    function buy(uint256 quoteAmount) external returns (IMarketFairLaunchHook.SwapDecision memory decision) {
        decision = hook.previewSwap(poolId, msg.sender, true, quoteAmount);
        require(decision.allowed, decision.reason);

        uint256 saleTokenAmount = quoteAmount;
        uint256 treasuryAmount = quoteAmount - decision.vaultAmount;

        if (decision.vaultAmount > 0) {
            require(quoteToken.transferFrom(msg.sender, address(vault), decision.vaultAmount), "VAULT_PAYMENT_FAILED");
            vault.recordProtectedFee(address(quoteToken), decision.vaultAmount);
        }

        if (treasuryAmount > 0) {
            require(quoteToken.transferFrom(msg.sender, treasury, treasuryAmount), "TREASURY_PAYMENT_FAILED");
        }

        require(saleToken.transfer(msg.sender, saleTokenAmount), "SALE_TOKEN_TRANSFER_FAILED");

        hook.recordSwap(poolId, msg.sender, true, quoteAmount);
        totalQuoteCollected += quoteAmount;
        totalSaleTokenBought += saleTokenAmount;

        emit MarketBuyExecuted(
            poolId,
            msg.sender,
            quoteAmount,
            saleTokenAmount,
            decision.vaultAmount,
            decision.feeBps,
            decision.reason
        );
    }
}
