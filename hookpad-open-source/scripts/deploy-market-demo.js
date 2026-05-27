const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

async function waitForTx(label, txPromise) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  console.log(`${label}: ${receipt.hash}`);
  return receipt.hash;
}

function launchConfig(ethers, launchStart, vault) {
  return {
    launchStart,
    launchWindow: 30 * 60,
    coolingWindow: 120 * 60,
    baseFeeBps: 30,
    firstWindowFeeBps: 300,
    secondWindowFeeBps: 150,
    lateWindowFeeBps: 80,
    sizePenaltyBps: 100,
    exposurePenaltyBps: 200,
    maxBuyPerTx: ethers.parseEther("10000"),
    maxBuyPerWallet: ethers.parseEther("500000"),
    vault,
    owner: ethers.ZeroAddress,
  };
}

async function deployMarketPool({ ethers, vault, saleToken, quoteToken, deployer, launchStart, label, hookAddress }) {
  const poolId = ethers.keccak256(ethers.toUtf8Bytes(`HOOKPAD_MARKET_${label}_${Date.now()}`));
  const MarketPool = await ethers.getContractFactory("HookPadMarketPool");
  const marketPool = await MarketPool.deploy(
    poolId,
    hookAddress,
    vault,
    saleToken,
    quoteToken,
    deployer.address,
    launchConfig(ethers, launchStart, vault),
  );
  await marketPool.waitForDeployment();
  const marketPoolAddress = await marketPool.getAddress();

  const sale = await ethers.getContractAt("MockToken", saleToken);
  await waitForTx(`Seed ${label} market pool`, sale.transfer(marketPoolAddress, ethers.parseEther("1000000")));

  return { poolId, marketPool, marketPoolAddress };
}

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const deploymentPath = path.join(process.cwd(), "deployments", "xlayer-testnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const latestBlock = await ethers.provider.getBlock("latest");
  const now = latestBlock.timestamp;

  const saleTokenAddress = deployment.contracts.mockToken;
  const vaultAddress = deployment.contracts.feeVault;
  const hookAddress = deployment.contracts.fairLaunchHook;

  const MockToken = await ethers.getContractFactory("MockToken");
  const quoteToken = await MockToken.deploy("HookPad Mock USDC", "mUSDC", ethers.parseEther("100000000"));
  await quoteToken.waitForDeployment();
  const quoteTokenAddress = await quoteToken.getAddress();

  const launchMarket = await deployMarketPool({
    ethers,
    vault: vaultAddress,
    saleToken: saleTokenAddress,
    quoteToken: quoteTokenAddress,
    deployer,
    launchStart: now - 60,
    label: "LAUNCH",
    hookAddress,
  });

  const openMarket = await deployMarketPool({
    ethers,
    vault: vaultAddress,
    saleToken: saleTokenAddress,
    quoteToken: quoteTokenAddress,
    deployer,
    launchStart: now - 3 * 60 * 60,
    label: "OPEN",
    hookAddress,
  });

  const approveLaunchHash = await waitForTx(
    "Approve launch market mUSDC",
    quoteToken.approve(launchMarket.marketPoolAddress, ethers.parseEther("1000000")),
  );
  const approveOpenHash = await waitForTx(
    "Approve open market mUSDC",
    quoteToken.approve(openMarket.marketPoolAddress, ethers.parseEther("1000000")),
  );

  const smallBuyHash = await waitForTx(
    "Real small purchase succeeds",
    launchMarket.marketPool.buy(ethers.parseEther("2000")),
  );

  let largeBuyHash = null;
  try {
    const tx = await launchMarket.marketPool.buy(ethers.parseEther("12000"), { gasLimit: 500000 });
    const receipt = await tx.wait();
    largeBuyHash = receipt.hash;
    console.log(`Real large purchase unexpectedly mined: ${largeBuyHash}`);
  } catch (error) {
    largeBuyHash = error.receipt?.hash || error.transactionHash || null;
    console.log(`Real large purchase blocked${largeBuyHash ? `: ${largeBuyHash}` : ""}`);
  }

  const openBuyHash = await waitForTx(
    "Real open-market purchase succeeds",
    openMarket.marketPool.buy(ethers.parseEther("75000")),
  );

  deployment.contracts.mockUSDC = quoteTokenAddress;
  deployment.contracts.launchMarketPool = launchMarket.marketPoolAddress;
  deployment.contracts.openMarketPool = openMarket.marketPoolAddress;
  deployment.realPurchaseDemo = {
    mockUSDC: quoteTokenAddress,
    launchMarketPool: launchMarket.marketPoolAddress,
    launchMarketPoolId: launchMarket.poolId,
    openMarketPool: openMarket.marketPoolAddress,
    openMarketPoolId: openMarket.poolId,
    transactions: {
      approvals: [approveLaunchHash, approveOpenHash],
      realSmallPurchase: smallBuyHash,
      realLargePurchaseBlocked: largeBuyHash,
      realOpenMarketPurchase: openBuyHash,
    },
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(JSON.stringify(deployment.realPurchaseDemo, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
