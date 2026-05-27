# HookPad Submission Draft

## One-Liner

HookPad is a Fair Launch Hook for Uniswap V4 pools on X Layer that protects new token launches with adaptive fees, wallet limits, and LP protection.

## Short Description

HookPad turns token launches into programmable markets. Instead of letting early bots define the first block, the pool itself enforces fair-launch rules through a Uniswap V4 Hook. Small users can buy normally, aggressive early buys pay more or get blocked, and extra launch fees are routed into an LP Protection Vault.

## Why It Matters

New asset launches are one of the most visible on-chain trading moments. They are also where normal users and LPs get hurt fastest. HookPad gives X Layer a launch primitive that is easy to understand, easy to demo, and tied directly to trading growth.

## Technical Highlights

- phase-based launch protection
- dynamic buy fees based on launch time, trade size, and wallet exposure
- per-transaction and per-wallet buy caps
- sell path stays open
- LP Protection Vault accounting
- self-deployed Uniswap V4 PoolManager on X Layer testnet
- HookPad V4 Hook with `beforeSwap` and `afterSwap` permissions
- initialized HookPad V4 Pool on X Layer testnet
- real X Layer testnet purchase transactions: MockUSDC in, HPAD out
- interactive dashboard for live fee decisions

## X Layer Testnet Contracts

```text
HPAD Token:        0xe1D4c997CC3d56C4d08a208eA9031EB38E6706B8
MockUSDC:          0x80A8C0611A0de0f7bf4f8Ac21B2eB6334B43F360
FeeVault:          0x6aFbEc2C0fc95D23B8fe9D727Ea95E38A9317Cd5
FairLaunchHook:    0x2B0c89b00F715f5f396D588b1b629FCa4945cB90
LaunchMarketPool:  0x60868ab240557Bd7Be6A46654bE5AE977633e038
OpenMarketPool:    0x0d2AD406D6A5912D4f9A2A156B4fB0bd61816d5f
Deployer:          0xbaf5e0801964eaFABED9bad115f8C4C78a6161B6
Network:           X Layer testnet, chainId 1952
```

## X Layer Testnet V4 Pool

```text
Uniswap V4 PoolManager: 0xda0a1F6edcc326c2165e369784de33d89c76a526
HookPad V4 Hook:        0x3924dfaDf54b396Feee3790cbfB98a49671E00C0
V4 Create2 Deployer:    0x6d2B021b1A1327677153F3fB04D2D1d4ED307918
vHPAD Token:            0x415Af291bE1f724D13BB06Bac8942620662f0469
vUSDC Token:            0xA398712bbBB5A46e2Bd1c42d9c4D9159E878d662
Pool fee:               3000
Tick spacing:           60
Hook flags:             BEFORE_SWAP | AFTER_SWAP

Deploy Hook tx:
0x2f8e2f7a5cbda8c9916578e049ca021ce9701eb59c44147dad23b1eb953fafbb

Initialize V4 Pool tx:
0xaf74947699affd06b4b6ade13977f5358799ca00fe086192fe252e200623e4bd
```

Explorer:

```text
https://www.okx.com/web3/explorer/xlayer-test
```

## Real Transaction Evidence

```text
Real MockUSDC -> HPAD launch purchase, status 1:
0xcb6d420ce7a5305870faa7f1283eb002a4fa3ab20e6bd50198df32c5f266c192

Real large purchase blocked, status 0 revert:
0x1e5e4a67fa2e6bcb2cc40bcaec4819cc3a2948c07f8a26560fdef0f1653c5de1

Real open-market MockUSDC -> HPAD purchase, status 1:
0xb3ec618a06168ed8b91bda1c332a3a684f4b15a5742c77559ff61d24c6b6fdad
```

Note: X Layer testnet did not have a discoverable official Uniswap V4 PoolManager bytecode address, so HookPad deployed the Uniswap V4 core PoolManager build to X Layer testnet and initialized a HookPad V4 Pool against `HookPadV4FairLaunchHook`. `HookPadMarketPool` remains the live purchase harness used to demonstrate MockUSDC payment, HPAD delivery, Vault fee routing, and Hook-controlled reverts.

## Demo Video Flow

1. Explain the launch-sniping problem.
2. Create or load a HookPad launch pool.
3. Run a small early buy and show it passes.
4. Run a large early buy and show it is blocked or receives a high fee.
5. Open the matching X Layer testnet transaction hashes.
6. Show the LP Protection Vault amount.
7. Move to open-market phase and show standard fee behavior.

## X Post Draft

We built HookPad for the X Layer Build X Hackathon.

It is a Fair Launch Hook for Uniswap V4 pools on X Layer.

Most token launches are decided in the first few minutes by bots and aggressive early wallets. HookPad moves launch rules into the pool itself.

Small buys pass normally.
Large early buys pay more or get blocked.
Extra launch fees go into LP protection.

On X Layer, new assets should not just launch. They should launch with programmable market rules.

Demo:
GitHub:

@XLayerOfficial @Uniswap @flapdotsh
