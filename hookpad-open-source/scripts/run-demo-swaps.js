const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

async function waitForTx(label, txPromise) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  console.log(`${label}: ${receipt.hash}`);
  return receipt.hash;
}

function launchConfig(ethers, launchStart) {
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
    vault: ethers.ZeroAddress,
    owner: ethers.ZeroAddress,
  };
}

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const deploymentPath = path.join(process.cwd(), "deployments", "xlayer-testnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const latestBlock = await ethers.provider.getBlock("latest");
  const now = latestBlock.timestamp;

  const tokenAddress = deployment.contracts.mockToken;
  const vaultAddress = deployment.contracts.feeVault;
  const hookAddress = deployment.contracts.fairLaunchHook;

  const DemoPool = await ethers.getContractFactory("HookPadDemoPool");

  const launchPoolId = ethers.keccak256(ethers.toUtf8Bytes(`HOOKPAD_LAUNCH_${Date.now()}`));
  const launchPool = await DemoPool.deploy(
    launchPoolId,
    hookAddress,
    vaultAddress,
    tokenAddress,
    launchConfig(ethers, now - 60),
  );
  await launchPool.waitForDeployment();

  const openPoolId = ethers.keccak256(ethers.toUtf8Bytes(`HOOKPAD_OPEN_${Date.now()}`));
  const openPool = await DemoPool.deploy(
    openPoolId,
    hookAddress,
    vaultAddress,
    tokenAddress,
    launchConfig(ethers, now - 3 * 60 * 60),
  );
  await openPool.waitForDeployment();

  const token = await ethers.getContractAt("MockToken", tokenAddress);
  const launchPoolAddress = await launchPool.getAddress();
  const openPoolAddress = await openPool.getAddress();

  const approvals = [];
  approvals.push(await waitForTx("Approve launch demo pool", token.approve(launchPoolAddress, ethers.parseEther("1000000"))));
  approvals.push(await waitForTx("Approve open demo pool", token.approve(openPoolAddress, ethers.parseEther("1000000"))));

  const smallBuyHash = await waitForTx(
    "Small launch buy allowed",
    launchPool.executeSwap(true, ethers.parseEther("2000")),
  );

  let largeBuyRevertHash = null;
  try {
    const tx = await launchPool.executeSwap(true, ethers.parseEther("12000"), { gasLimit: 500000 });
    const receipt = await tx.wait();
    largeBuyRevertHash = receipt.hash;
    console.log(`Large launch buy unexpectedly mined: ${largeBuyRevertHash}`);
  } catch (error) {
    largeBuyRevertHash = error.receipt?.hash || error.transactionHash || null;
    console.log(`Large launch buy blocked${largeBuyRevertHash ? `: ${largeBuyRevertHash}` : ""}`);
  }

  const openBuyHash = await waitForTx(
    "Open-market buy allowed",
    openPool.executeSwap(true, ethers.parseEther("75000")),
  );

  const demo = {
    launchDemoPool: launchPoolAddress,
    launchPoolId,
    openDemoPool: openPoolAddress,
    openPoolId,
    transactions: {
      approvals,
      smallBuyAllowed: smallBuyHash,
      largeBuyBlocked: largeBuyRevertHash,
      openMarketBuyAllowed: openBuyHash,
    },
    updatedAt: new Date().toISOString(),
  };

  deployment.contracts.launchDemoPool = launchPoolAddress;
  deployment.contracts.openDemoPool = openPoolAddress;
  deployment.demo = demo;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log(JSON.stringify(demo, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
