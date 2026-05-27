// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal, hackathon-friendly Fair Launch Hook core.
/// @dev The production version should inherit the official Uniswap V4 BaseHook
/// and wire this logic into beforeSwap / afterSwap with real PoolKey types.
contract FairLaunchHook {
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

    enum Phase {
        Launch,
        Cooling,
        Open
    }

    struct SwapDecision {
        Phase phase;
        bool allowed;
        uint16 feeBps;
        uint256 vaultAmount;
        string reason;
    }

    mapping(bytes32 poolId => LaunchConfig) public launchConfigs;
    mapping(bytes32 poolId => mapping(address wallet => uint256 amount)) public walletBought;

    event LaunchConfigured(bytes32 indexed poolId, address indexed owner, address vault);
    event SwapChecked(
        bytes32 indexed poolId,
        address indexed wallet,
        bool isBuy,
        bool allowed,
        uint16 feeBps,
        uint256 vaultAmount,
        string reason
    );

    modifier onlyPoolOwner(bytes32 poolId) {
        require(launchConfigs[poolId].owner == msg.sender, "NOT_POOL_OWNER");
        _;
    }

    function configureLaunch(bytes32 poolId, LaunchConfig calldata config) external {
        require(launchConfigs[poolId].owner == address(0), "POOL_EXISTS");
        require(config.vault != address(0), "VAULT_REQUIRED");
        require(config.maxBuyPerTx > 0, "TX_LIMIT_REQUIRED");
        require(config.maxBuyPerWallet >= config.maxBuyPerTx, "BAD_WALLET_LIMIT");

        LaunchConfig memory next = config;
        next.owner = msg.sender;
        if (next.launchStart == 0) {
            next.launchStart = uint64(block.timestamp);
        }
        if (next.baseFeeBps == 0) {
            next.baseFeeBps = 30;
        }

        launchConfigs[poolId] = next;
        emit LaunchConfigured(poolId, msg.sender, next.vault);
    }

    function previewSwap(
        bytes32 poolId,
        address wallet,
        bool isBuy,
        uint256 amount
    ) public view returns (SwapDecision memory decision) {
        LaunchConfig memory config = launchConfigs[poolId];
        require(config.owner != address(0), "UNKNOWN_POOL");

        Phase currentPhase = phaseOf(poolId);

        if (!isBuy) {
            return
                SwapDecision({
                    phase: currentPhase,
                    allowed: true,
                    feeBps: config.baseFeeBps,
                    vaultAmount: 0,
                    reason: "SELL_FLOW_OPEN"
                });
        }

        if (currentPhase != Phase.Open && amount > config.maxBuyPerTx) {
            return
                SwapDecision({
                    phase: currentPhase,
                    allowed: false,
                    feeBps: 0,
                    vaultAmount: 0,
                    reason: "MAX_TX_EXCEEDED"
                });
        }

        if (currentPhase != Phase.Open && walletBought[poolId][wallet] + amount > config.maxBuyPerWallet) {
            return
                SwapDecision({
                    phase: currentPhase,
                    allowed: false,
                    feeBps: 0,
                    vaultAmount: 0,
                    reason: "MAX_WALLET_EXCEEDED"
                });
        }

        uint16 feeBps = config.baseFeeBps + adaptiveFee(config, currentPhase);

        if (currentPhase != Phase.Open && amount > (config.maxBuyPerTx * 70) / 100) {
            feeBps += config.sizePenaltyBps;
        }

        if (currentPhase != Phase.Open && walletBought[poolId][wallet] + amount > (config.maxBuyPerWallet * 75) / 100) {
            feeBps += config.exposurePenaltyBps;
        }

        uint256 feeAmount = (amount * feeBps) / 10_000;
        uint256 baseFeeAmount = (amount * config.baseFeeBps) / 10_000;

        return
            SwapDecision({
                phase: currentPhase,
                allowed: true,
                feeBps: feeBps,
                vaultAmount: feeAmount > baseFeeAmount ? feeAmount - baseFeeAmount : 0,
                reason: currentPhase == Phase.Open ? "OPEN_MARKET" : "ADAPTIVE_LAUNCH_FEE"
            });
    }

    function recordSwap(bytes32 poolId, address wallet, bool isBuy, uint256 amount) external onlyPoolOwner(poolId) {
        SwapDecision memory decision = previewSwap(poolId, wallet, isBuy, amount);
        require(decision.allowed, decision.reason);

        if (isBuy && decision.phase != Phase.Open) {
            walletBought[poolId][wallet] += amount;
        }

        emit SwapChecked(poolId, wallet, isBuy, decision.allowed, decision.feeBps, decision.vaultAmount, decision.reason);
    }

    function phaseOf(bytes32 poolId) public view returns (Phase) {
        LaunchConfig memory config = launchConfigs[poolId];
        require(config.owner != address(0), "UNKNOWN_POOL");

        uint256 elapsed = block.timestamp - config.launchStart;
        if (elapsed < config.launchWindow) {
            return Phase.Launch;
        }
        if (elapsed < config.coolingWindow) {
            return Phase.Cooling;
        }
        return Phase.Open;
    }

    function adaptiveFee(LaunchConfig memory config, Phase currentPhase) internal view returns (uint16) {
        if (currentPhase == Phase.Open) {
            return 0;
        }

        if (currentPhase == Phase.Cooling) {
            return config.lateWindowFeeBps / 2;
        }

        uint256 elapsed = block.timestamp - config.launchStart;
        if (elapsed < 5 minutes) {
            return config.firstWindowFeeBps;
        }
        if (elapsed < 15 minutes) {
            return config.secondWindowFeeBps;
        }
        return config.lateWindowFeeBps;
    }
}
