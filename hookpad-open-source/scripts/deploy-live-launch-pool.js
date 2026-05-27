const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

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

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const deploymentPath = path.join(process.cwd(), "deployments", "xlayer-testnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const latestBlock = await ethers.provider.getBlock("latest");
  const launchStart = latestBlock.timestamp - 30;

  const saleTokenAddress = deployment.contracts.mockToken;
  const quoteTokenAddress = deployment.contracts.mockUSDC;
  const vaultAddress = deployment.contracts.feeVault;
  const hookAddress = deployment.contracts.fairLaunchHook;
  const poolId = ethers.keccak256(ethers.toUtf8Bytes(`HOOKPAD_LIVE_LAUNCH_${Date.now()}`));

  const MarketPool = await ethers.getContractFactory("HookPadMarketPool");
  const marketPool = await MarketPool.deploy(
    poolId,
    hookAddress,
    vaultAddress,
    saleTokenAddress,
    quoteTokenAddress,
    deployer.address,
    launchConfig(ethers, launchStart, vaultAddress),
  );
  await marketPool.waitForDeployment();
  const marketPoolAddress = await marketPool.getAddress();

  const sale = await ethers.getContractAt("MockToken", saleTokenAddress);
  const seedTx = await sale.transfer(marketPoolAddress, ethers.parseEther("1000000"));
  const seedReceipt = await seedTx.wait();

  deployment.contracts.launchMarketPool = marketPoolAddress;
  deployment.realPurchaseDemo = {
    ...(deployment.realPurchaseDemo || {}),
    launchMarketPool: marketPoolAddress,
    launchMarketPoolId: poolId,
    liveRedeploy: {
      launchMarketPool: marketPoolAddress,
      launchMarketPoolId: poolId,
      launchStart,
      seedTx: seedReceipt.hash,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(
    JSON.stringify(
      {
        launchMarketPool: marketPoolAddress,
        launchMarketPoolId: poolId,
        launchStart,
        seedTx: seedReceipt.hash,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
