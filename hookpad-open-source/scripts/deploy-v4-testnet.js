const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
const {
  AbiCoder,
  Contract,
  getAddress,
  getCreate2Address,
  keccak256,
  parseEther,
  solidityPacked,
} = require("ethers");

const EXPLORER = "https://www.okx.com/web3/explorer/xlayer-test";
const FLAGS = 128 + 64; // BEFORE_SWAP_FLAG | AFTER_SWAP_FLAG
const FLAG_MASK = (1n << 14n) - 1n;
const SQRT_PRICE_1_1 = 79228162514264337593543950336n;

const poolManagerAbi = [
  "function initialize((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,uint160 sqrtPriceX96) external returns (int24 tick)",
];

function sortCurrencies(a, b) {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

function mineSalt(deployer, creationCodeWithArgs) {
  const initCodeHash = keccak256(creationCodeWithArgs);
  for (let i = 0n; i < 250000n; i++) {
    const salt = `0x${i.toString(16).padStart(64, "0")}`;
    const address = getCreate2Address(deployer, salt, initCodeHash);
    if ((BigInt(address) & FLAG_MASK) === BigInt(FLAGS)) {
      return { salt, address };
    }
  }
  throw new Error("No CREATE2 salt found for HookPad V4 hook flags.");
}

async function waitForTx(label, txPromise) {
  const tx = await txPromise;
  console.log(`${label} submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`${label} mined: ${receipt.hash}`);
  return receipt.hash;
}

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Native balance: ${ethers.formatEther(balance)} OKB`);

  if (balance === 0n) {
    throw new Error("NO_TESTNET_OKB: fund the deployer on X Layer testnet before running this script.");
  }

  const PoolManager = await ethers.getContractFactory("HookPadPoolManager");
  const poolManager = await PoolManager.deploy(deployer.address);
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();
  console.log(`PoolManager: ${poolManagerAddress}`);

  const MockToken = await ethers.getContractFactory("MockToken");
  const hpad = await MockToken.deploy("HookPad V4 Test Token", "vHPAD", parseEther("100000000"));
  await hpad.waitForDeployment();
  const hpadAddress = await hpad.getAddress();
  console.log(`vHPAD: ${hpadAddress}`);

  const usdc = await MockToken.deploy("HookPad V4 Mock USDC", "vUSDC", parseEther("100000000"));
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`vUSDC: ${usdcAddress}`);

  const Create2HookDeployer = await ethers.getContractFactory("Create2HookDeployer");
  const hookDeployer = await Create2HookDeployer.deploy();
  await hookDeployer.waitForDeployment();
  const hookDeployerAddress = await hookDeployer.getAddress();
  console.log(`Create2HookDeployer: ${hookDeployerAddress}`);

  const Hook = await ethers.getContractFactory("HookPadV4FairLaunchHook");
  const constructorArgs = AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256"],
    [poolManagerAddress, parseEther("10000")],
  );
  const creationCodeWithArgs = solidityPacked(["bytes", "bytes"], [Hook.bytecode, constructorArgs]);
  const mined = mineSalt(hookDeployerAddress, creationCodeWithArgs);
  console.log(`Mined hook address: ${mined.address}`);
  console.log(`Hook salt: ${mined.salt}`);

  const deployHookHash = await waitForTx(
    "Deploy HookPadV4FairLaunchHook",
    hookDeployer.deploy(mined.salt, creationCodeWithArgs),
  );

  const [currency0, currency1] = sortCurrencies(getAddress(hpadAddress), getAddress(usdcAddress));
  const poolKey = {
    currency0,
    currency1,
    fee: 3000,
    tickSpacing: 60,
    hooks: mined.address,
  };

  const manager = new Contract(poolManagerAddress, poolManagerAbi, deployer);
  const initializeHash = await waitForTx(
    "Initialize Uniswap V4 testnet pool",
    manager.initialize(poolKey, SQRT_PRICE_1_1),
  );

  const deployment = {
    network: "xlayerTestnet",
    chainId: 1952,
    explorer: EXPLORER,
    deployer: deployer.address,
    note: "Self-deployed Uniswap V4 PoolManager on X Layer testnet because no official X Layer testnet PoolManager bytecode was found.",
    uniswapV4: {
      poolManager: poolManagerAddress,
      hook: mined.address,
      hookFlags: "BEFORE_SWAP | AFTER_SWAP",
      create2HookDeployer: hookDeployerAddress,
      hpad: hpadAddress,
      mockUSDC: usdcAddress,
      poolKey,
      transactions: {
        deployHook: deployHookHash,
        initializePool: initializeHash,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(process.cwd(), "deployments", "xlayer-testnet-v4.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
