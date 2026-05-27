const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
const {
  AbiCoder,
  Contract,
  getAddress,
  getCreate2Address,
  id,
  keccak256,
  parseEther,
  solidityPacked,
  ZeroAddress,
} = require("ethers");

const POOL_MANAGER = "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32";
const EXPLORER = "https://www.okx.com/web3/explorer/xlayer";
const FLAGS = 128 + 64; // BEFORE_SWAP_FLAG | AFTER_SWAP_FLAG
const FLAG_MASK = (1n << 14n) - 1n;
const SQRT_PRICE_1_1 = 79228162514264337593543950336n;

const poolManagerAbi = [
  "function initialize((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,uint160 sqrtPriceX96) external returns (int24 tick)",
];

function sortCurrencies(a, b) {
  const left = BigInt(a);
  const right = BigInt(b);
  return left < right ? [a, b] : [b, a];
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
    throw new Error("NO_MAINNET_OKB: fund the deployer on X Layer mainnet before running this script.");
  }

  const poolManagerCode = await ethers.provider.getCode(POOL_MANAGER);
  if (poolManagerCode === "0x") {
    throw new Error(`No PoolManager bytecode at ${POOL_MANAGER} on this network.`);
  }

  const MockToken = await ethers.getContractFactory("MockToken");
  const hpad = await MockToken.deploy("HookPad Token", "HPAD", parseEther("100000000"));
  await hpad.waitForDeployment();
  const hpadAddress = await hpad.getAddress();
  console.log(`HPAD: ${hpadAddress}`);

  const usdc = await MockToken.deploy("HookPad Mainnet Mock USDC", "mUSDC", parseEther("100000000"));
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`mUSDC: ${usdcAddress}`);

  const Create2HookDeployer = await ethers.getContractFactory("Create2HookDeployer");
  const hookDeployer = await Create2HookDeployer.deploy();
  await hookDeployer.waitForDeployment();
  const hookDeployerAddress = await hookDeployer.getAddress();
  console.log(`Create2HookDeployer: ${hookDeployerAddress}`);

  const Hook = await ethers.getContractFactory("HookPadV4FairLaunchHook");
  const constructorArgs = AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256"],
    [POOL_MANAGER, parseEther("10000")],
  );
  const creationCodeWithArgs = solidityPacked(["bytes", "bytes"], [Hook.bytecode, constructorArgs]);
  const mined = mineSalt(hookDeployerAddress, creationCodeWithArgs);
  console.log(`Mined hook address: ${mined.address}`);
  console.log(`Hook salt: ${mined.salt}`);

  const deployHookHash = await waitForTx(
    "Deploy HookPadV4FairLaunchHook",
    hookDeployer.deploy(mined.salt, creationCodeWithArgs),
  );

  const hookAddress = mined.address;
  const [currency0, currency1] = sortCurrencies(getAddress(hpadAddress), getAddress(usdcAddress));
  const poolKey = {
    currency0,
    currency1,
    fee: 3000,
    tickSpacing: 60,
    hooks: hookAddress,
  };

  const poolManager = new Contract(POOL_MANAGER, poolManagerAbi, deployer);
  const initializeHash = await waitForTx(
    "Initialize Uniswap V4 pool",
    poolManager.initialize(poolKey, SQRT_PRICE_1_1),
  );

  const poolId = id(
    `${poolKey.currency0}:${poolKey.currency1}:${poolKey.fee}:${poolKey.tickSpacing}:${poolKey.hooks}`,
  );

  const deployment = {
    network: "xlayerMainnet",
    chainId: 196,
    explorer: EXPLORER,
    deployer: deployer.address,
    uniswapV4: {
      poolManager: POOL_MANAGER,
      hook: hookAddress,
      hookFlags: "BEFORE_SWAP | AFTER_SWAP",
      create2HookDeployer: hookDeployerAddress,
      hpad: hpadAddress,
      mockUSDC: usdcAddress,
      poolKey,
      poolIdNote: "PoolKey tuple above is the source of truth; V4 PoolManager emits Initialize with the canonical PoolId.",
      transactions: {
        deployHook: deployHookHash,
        initializePool: initializeHash,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(process.cwd(), "deployments", "xlayer-mainnet-v4.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
