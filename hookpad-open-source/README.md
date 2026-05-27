# HookPad

Fair Launch Hooks for Uniswap V4 pools on X Layer.

HookPad turns token launches into programmable markets. Instead of letting bots define the first block, the pool itself enforces launch rules: adaptive buy fees, wallet exposure limits, and LP protection fees.

## Problem

New token launches often break in the first few minutes:

- early sniper wallets capture the best entry
- normal users get poor execution
- LPs carry the early volatility risk
- projects have no transparent launch control after the pool goes live

## Solution

HookPad binds a FairLaunch Hook to a new Uniswap V4 pool on X Layer.

During launch, every buy goes through the hook before it clears:

- small buys pass normally
- aggressive early buys pay higher adaptive fees
- buys above launch limits are rejected
- extra launch fees are routed to an LP Protection Vault
- after the launch and cooling windows, the pool returns to normal open-market behavior

## Hook Flow

```text
Project creates pool
       |
       v
FairLaunchHook stores launch config
       |
       v
User submits swap
       |
       v
beforeSwap checks phase, size, wallet exposure
       |
       +--> allowed with adaptive fee
       |
       +--> blocked by fair launch rule
       |
       v
afterSwap records wallet exposure and vault amount
```

## MVP Features

- FairLaunch Hook core logic in `contracts/FairLaunchHook.sol`
- production-facing Uniswap V4 hook in `contracts/HookPadV4FairLaunchHook.sol`
- V4-style adapter surface in `contracts/V4FairLaunchHookAdapter.sol`
- CREATE2 hook deployer for mining the required V4 hook permission bits
- self-deployed Uniswap V4 PoolManager on X Layer testnet
- initialized HookPad V4 Pool on X Layer testnet
- on-chain demo pool harness in `contracts/HookPadDemoPool.sol`
- real purchase market pool in `contracts/HookPadMarketPool.sol`
- LP Protection Vault stub in `contracts/FeeVault.sol`
- demo ERC20 in `contracts/MockToken.sol`
- interactive dashboard and swap simulator in `src/main.tsx`
- tested TypeScript fee engine in `src/lib/fairLaunch.ts`

## Demo Script

1. Open the dashboard.
2. Click `Small Buy`.
3. Show that an early small buyer pays MockUSDC and receives HPAD with an adaptive launch fee.
4. Click `Large Buy`.
5. Show that an aggressive buy gets blocked by the launch cap.
6. Click `Open Market`.
7. Show that after the launch/cooling windows, standard pool behavior returns.
8. Point to the LP Protection Vault value as the transparent destination for extra launch fees.

Full recording script:

```text
DEMO_VIDEO_SCRIPT.md
```

## Hackathon Submission Snapshot

Current X Layer testnet deployment:

```text
HPAD Token:        0xe1D4c997CC3d56C4d08a208eA9031EB38E6706B8
MockUSDC:          0x80A8C0611A0de0f7bf4f8Ac21B2eB6334B43F360
FeeVault:          0x6aFbEc2C0fc95D23B8fe9D727Ea95E38A9317Cd5
FairLaunchHook:    0x2B0c89b00F715f5f396D588b1b629FCa4945cB90
LaunchMarketPool:  0x60868ab240557Bd7Be6A46654bE5AE977633e038
OpenMarketPool:    0x0d2AD406D6A5912D4f9A2A156B4fB0bd61816d5f
```

Real X Layer testnet purchase transactions:

```text
Real MockUSDC -> HPAD launch purchase, status 1:
0xcb6d420ce7a5305870faa7f1283eb002a4fa3ab20e6bd50198df32c5f266c192

Real large purchase blocked, status 0 revert:
0x1e5e4a67fa2e6bcb2cc40bcaec4819cc3a2948c07f8a26560fdef0f1653c5de1

Real open-market MockUSDC -> HPAD purchase, status 1:
0xb3ec618a06168ed8b91bda1c332a3a684f4b15a5742c77559ff61d24c6b6fdad
```

Integration status:

- X Layer testnet contracts and real transaction evidence complete
- V4-style hook adapter included for `beforeSwap` / `afterSwap` production wiring
- official Uniswap V4 hook contract and deployment scripts included
- no official X Layer testnet PoolManager bytecode was found at common deployment addresses
- HookPad self-deployed the Uniswap V4 core PoolManager build on X Layer testnet and initialized a HookPad V4 Pool
- `HookPadMarketPool` remains the live purchase harness for showing MockUSDC payment, HPAD delivery, vault routing, and Hook-controlled reverts

X Layer testnet V4 deployment:

```text
Uniswap V4 PoolManager: 0xda0a1F6edcc326c2165e369784de33d89c76a526
HookPad V4 Hook:        0x3924dfaDf54b396Feee3790cbfB98a49671E00C0
V4 Create2 Deployer:    0x6d2B021b1A1327677153F3fB04D2D1d4ED307918
vHPAD Token:            0x415Af291bE1f724D13BB06Bac8942620662f0469
vUSDC Token:            0xA398712bbBB5A46e2Bd1c42d9c4D9159E878d662

Deploy Hook tx:
0x2f8e2f7a5cbda8c9916578e049ca021ce9701eb59c44147dad23b1eb953fafbb

Initialize V4 Pool tx:
0xaf74947699affd06b4b6ade13977f5358799ca00fe086192fe252e200623e4bd
```

## Why X Layer

X Layer needs visible trading use cases, not just infrastructure demos. HookPad targets a real on-chain behavior pattern: new asset launches, meme pools, and launch liquidity.

The result is easy to demo and easy to explain:

> Ordinary pool: bots define the first block.
>
> HookPad pool: the pool enforces launch rules on-chain.

## Local Development

```bash
npm install
npm run dev
npm test
npm run build
```

## X Layer Testnet Deployment

Create a local `.env` from the example:

```bash
cp .env.example .env
```

Fill only your local `.env`:

```text
DEPLOYER_PRIVATE_KEY=your_local_deployer_private_key
XLAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech/terigon
```

Never commit or share `.env`.

Compile and deploy:

```bash
npm run compile:contracts
npm run deploy:xlayer-testnet
npm run demo:xlayer-testnet
npm run deploy:v4:xlayer-testnet
```

Optional official Uniswap V4 PoolManager deployment path on X Layer mainnet:

```bash
npm run deploy:v4:xlayer-mainnet
```

This script:

- checks the official X Layer mainnet PoolManager bytecode
- deploys HPAD and MockUSDC on X Layer mainnet
- mines a CREATE2 hook address with `BEFORE_SWAP | AFTER_SWAP` permission bits
- deploys `HookPadV4FairLaunchHook`
- initializes an official Uniswap V4 pool through PoolManager

It requires mainnet OKB gas. The current deployer had `0 OKB` on X Layer mainnet when tested, so the script intentionally stops before broadcasting.

The deploy script writes addresses to:

```text
deployments/xlayer-testnet.json
```

## Submission Assets

```text
SUBMISSION.md
SUBMISSION_CHECKLIST.md
DEMO_VIDEO_SCRIPT.md
X_POSTS.md
```

## Roadmap

- wire `FairLaunchHook` into official Uniswap V4 `BaseHook`
- add hook address permission mining
- deploy the production V4 hook to an official X Layer V4 PoolManager environment
- add viem/wagmi wallet actions
- add on-chain event indexer for launch analytics
- add creator-facing pool deployment flow
