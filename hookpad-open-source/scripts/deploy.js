const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deploying HookPad contracts");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "OKB");

  const MockToken = await ethers.getContractFactory("MockToken");
  const token = await MockToken.deploy("HookPad Demo Token", "HPAD", ethers.parseEther("100000000"));
  await token.waitForDeployment();

  const FeeVault = await ethers.getContractFactory("FeeVault");
  const vault = await FeeVault.deploy(deployer.address);
  await vault.waitForDeployment();

  const FairLaunchHook = await ethers.getContractFactory("FairLaunchHook");
  const hook = await FairLaunchHook.deploy();
  await hook.waitForDeployment();

  const deployment = {
    network: "xlayerTestnet",
    chainId: 1952,
    deployer: deployer.address,
    contracts: {
      mockToken: await token.getAddress(),
      feeVault: await vault.getAddress(),
      fairLaunchHook: await hook.getAddress(),
    },
    explorer: "https://www.okx.com/web3/explorer/xlayer-test",
    createdAt: new Date().toISOString(),
  };

  const outDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "xlayer-testnet.json"), JSON.stringify(deployment, null, 2));

  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
