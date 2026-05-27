# HookPad Demo Video Script

Target length: 90 to 120 seconds.

## 0:00 - 0:12 Problem

Most new token pools are decided in the first few minutes.

Snipers and aggressive early wallets take the best entries, normal users get worse execution, and LPs carry the launch volatility.

HookPad moves launch protection into the pool itself.

## 0:12 - 0:28 Product

HookPad is a Fair Launch Hook for Uniswap V4-style pools on X Layer.

Project teams configure launch windows, wallet limits, per-transaction caps, and adaptive buy fees.

The extra launch fee is routed to an LP Protection Vault.

## 0:28 - 0:48 Small Buy

Click `Small Buy`.

Show:

- `SUCCESS: SMALL BUY EXECUTED`
- `on-chain status 1`
- Hook verdict: Allowed
- Vault impact
- X Layer explorer transaction link

Voiceover:

Small launch buyers are allowed. This is a real testnet purchase: MockUSDC goes in, HPAD goes out, and the adaptive fee is routed into LP protection.

## 0:48 - 1:08 Large Buy

Click `Large Buy`.

Show:

- `BLOCKED: LARGE BUY REVERTED`
- `on-chain status 0`
- the reason text
- X Layer explorer transaction link

Voiceover:

Aggressive early buys are blocked by the Hook before the swap clears. This is the core anti-sniping behavior.

## 1:08 - 1:25 Open Market

Click `Open Market`.

Show:

- `SUCCESS: OPEN MARKET BUY EXECUTED`
- standard fee behavior
- X Layer explorer transaction link

Voiceover:

After launch and cooling windows, the pool returns to normal open-market behavior.

## 1:25 - 1:45 Verification

Scroll to `Submission Snapshot`.

Show:

- FairLaunchHook
- LaunchMarketPool
- OpenMarketPool
- MockUSDC
- HPAD Token
- Real X Layer Testnet Swaps

Voiceover:

The demo includes deployed X Layer testnet contracts and real transaction receipts for allowed, blocked, and open-market flows.

## Closing

HookPad gives X Layer launches a programmable market primitive: fairer early access, transparent protection rules, and LP protection baked into the pool.
