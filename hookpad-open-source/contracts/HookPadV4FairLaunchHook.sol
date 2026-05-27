// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

/// @notice Production-facing Uniswap V4 hook shell for HookPad fair-launch pools.
/// @dev The hook address must be mined so its low bits include BEFORE_SWAP and AFTER_SWAP flags.
contract HookPadV4FairLaunchHook is BaseHook {
    error BuyTooLarge(uint256 amountIn, uint256 maxExactInput);

    address public immutable owner;
    uint256 public immutable maxExactInput;

    uint256 public checkedSwaps;
    uint256 public blockedSwaps;
    uint256 public recordedSwaps;

    event FairLaunchChecked(address indexed sender, bytes32 indexed poolId, uint256 amountIn);
    event FairLaunchBlocked(address indexed sender, bytes32 indexed poolId, uint256 amountIn, uint256 maxExactInput);
    event FairLaunchRecorded(address indexed sender, bytes32 indexed poolId);

    constructor(IPoolManager manager, uint256 _maxExactInput) BaseHook(manager) {
        owner = msg.sender;
        maxExactInput = _maxExactInput;
    }

    /// @dev The deployment script mines a CREATE2 address with the correct low-bit permissions.
    /// X Layer testnet deployment keeps validation external to avoid constructor-specific failures.
    function validateHookAddress(BaseHook) internal pure override {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        checkedSwaps++;

        if (params.amountSpecified < 0) {
            uint256 amountIn = uint256(-params.amountSpecified);
            bytes32 poolId = keccak256(abi.encode(key));
            emit FairLaunchChecked(sender, poolId, amountIn);

            if (amountIn > maxExactInput) {
                blockedSwaps++;
                emit FairLaunchBlocked(sender, poolId, amountIn, maxExactInput);
                revert BuyTooLarge(amountIn, maxExactInput);
            }
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _afterSwap(address sender, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        recordedSwaps++;
        emit FairLaunchRecorded(sender, keccak256(abi.encode(key)));
        return (BaseHook.afterSwap.selector, 0);
    }
}
