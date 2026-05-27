# HookPad Submission Checklist

## Product

- [x] Judge-ready live transaction dashboard
- [x] Wallet connect, X Layer testnet switch/add, and balance check
- [x] Three live actions: small buy pass, large buy block, open-market buy pass
- [x] Clear success, blocked, and preview states
- [x] Real X Layer testnet transaction links
- [x] Activity rules check on the page

## Contracts

- [x] `FairLaunchHook.sol`
- [x] `HookPadV4FairLaunchHook.sol`
- [x] `Create2HookDeployer.sol`
- [x] `HookPadDemoPool.sol`
- [x] `HookPadMarketPool.sol`
- [x] `V4FairLaunchHookAdapter.sol`
- [x] `FeeVault.sol`
- [x] `MockToken.sol`
- [x] X Layer testnet deployment artifact
- [x] Self-deployed Uniswap V4 PoolManager on X Layer testnet
- [x] HookPad V4 pool initialized on X Layer testnet
- [x] Official Uniswap V4 PoolManager mainnet deployment script

## Chain Evidence

- [x] Real MockUSDC -> HPAD launch purchase succeeds, status 1
- [x] Real large MockUSDC -> HPAD purchase reverts, status 0
- [x] Real open-market MockUSDC -> HPAD purchase succeeds, status 1
- [x] V4 PoolManager bytecode verified on X Layer testnet
- [x] HookPad V4 hook bytecode verified on X Layer testnet
- [x] V4 pool initialize transaction mined, status 1
- [x] Explorer links included in dashboard, README, and submission draft

## Required Materials

- [x] README
- [x] Submission draft
- [x] Demo video script
- [x] X post drafts
- [ ] GitHub repository URL
- [ ] Demo video URL
- [ ] Independent X account URL
- [ ] Final hackathon form submission

## Final Checks

- [x] `npm run compile:contracts`
- [x] `npm test`
- [x] `npm run build`
- [x] Local dev service returns 200 on `http://localhost:5177/`
- [x] `npm run deploy:v4:xlayer-testnet`
- [ ] Record demo video
- [ ] Push GitHub repo
- [ ] Publish X build posts after approval
