import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserProvider, Contract, formatEther, JsonRpcProvider, parseEther } from "ethers";
import {
  BadgeCheck,
  Ban,
  Clock3,
  ExternalLink,
  FileCheck2,
  Fuel,
  Info,
  Link2,
  Play,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  calculateSwapDecision,
  defaultLaunchConfig,
  formatPctBps,
  formatUsd,
} from "./lib/fairLaunch";
import "./styles.css";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

const explorer = "https://www.okx.com/web3/explorer/xlayer-test";
const chainIdHex = "0x7a0";
const rpcUrl = "https://testrpc.xlayer.tech/terigon";
const mockUSDC = "0x80A8C0611A0de0f7bf4f8Ac21B2eB6334B43F360";
const launchMarketPool = "0x1bC1825De81D7f5d56335F80f158140D0331C0ca";
const openMarketPool = "0x0d2AD406D6A5912D4f9A2A156B4fB0bd61816d5f";

const erc20Abi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

const marketPoolAbi = ["function buy(uint256 quoteAmount) external"];

const contracts = [
  { label: "FairLaunchHook", value: "0x2B0c89b00F715f5f396D588b1b629FCa4945cB90", primary: true },
  { label: "V4 Adapter Source", value: "contracts/V4FairLaunchHookAdapter.sol", local: true },
  { label: "Launch Market Pool", value: launchMarketPool, primary: true },
  { label: "Open Market Pool", value: openMarketPool, primary: true },
  { label: "HPAD Token", value: "0xe1D4c997CC3d56C4d08a208eA9031EB38E6706B8" },
  { label: "MockUSDC", value: mockUSDC },
  { label: "LP Fee Vault", value: "0x6aFbEc2C0fc95D23B8fe9D727Ea95E38A9317Cd5" },
];

const receipts = [
  {
    key: "small",
    title: "Small launch buy passed",
    hash: "0xcb6d420ce7a5305870faa7f1283eb002a4fa3ab20e6bd50198df32c5f266c192",
    status: "status 1",
  },
  {
    key: "large",
    title: "Large launch buy blocked",
    hash: "0x1e5e4a67fa2e6bcb2cc40bcaec4819cc3a2948c07f8a26560fdef0f1653c5de1",
    status: "status 0",
  },
  {
    key: "open",
    title: "Open-market buy passed",
    hash: "0xb3ec618a06168ed8b91bda1c332a3a684f4b15a5742c77559ff61d24c6b6fdad",
    status: "status 1",
  },
];

const blockedLargeReceipt = receipts.find((receipt) => receipt.key === "large")!;

const scenarios = {
  small: {
    amount: 2_000,
    pool: launchMarketPool,
    minute: 3,
    label: "Buy 2,000 mUSDC",
    status: "should pass",
    icon: Play,
  },
  large: {
    amount: 12_000,
    pool: launchMarketPool,
    minute: 2,
    label: "Test 12,000 block",
    status: "show failed tx",
    icon: Ban,
  },
  open: {
    amount: 75_000,
    pool: openMarketPool,
    minute: 150,
    label: "Open buy 75,000",
    status: "should pass",
    icon: Clock3,
  },
} as const;

const features = [
  {
    title: "Fair launch guard",
    detail: "Blocks oversized launch buys before the pool opens.",
  },
  {
    title: "Adaptive launch fee",
    detail: "Routes extra launch pressure into the fee vault instead of letting bots take the whole pool.",
  },
  {
    title: "Live wallet flow",
    detail: "Runs real mUSDC to HPAD transactions on X Layer testnet and prints the mined tx hash.",
  },
];

const usageSteps = [
  {
    title: "Connect wallet",
    detail: "Use OKX Wallet or MetaMask on X Layer testnet.",
  },
  {
    title: "Run a launch buy",
    detail: "2,000 mUSDC should pass. 12,000 mUSDC should be blocked during launch protection.",
  },
  {
    title: "Open the tx hash",
    detail: "After the wallet confirms, HookPad waits for the receipt and links the explorer transaction.",
  },
];

type ScenarioKey = keyof typeof scenarios;

type ReceiptState = {
  kind: "idle" | "success" | "blocked" | "pending";
  title: string;
  detail: string;
  txHash?: string;
};

function explorerAddress(address: string) {
  return `${explorer}/address/${address}`;
}

function explorerTx(hash: string) {
  return `${explorer}/tx/${hash}`;
}

function shorten(value: string, head = 8, tail = 6) {
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function formatBalance(value: bigint) {
  return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function isXLayerTestnet(chainId: unknown) {
  if (typeof chainId === "string") {
    const normalized = chainId.trim().toLowerCase();
    return normalized === chainIdHex || normalized === "1952";
  }

  if (typeof chainId === "number") {
    return chainId === 1952;
  }

  return false;
}

async function waitForMinedTx(hash: string) {
  const rpcProvider = new JsonRpcProvider(rpcUrl);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const receipt = await rpcProvider.getTransactionReceipt(hash);
    if (receipt) {
      return receipt;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
  }

  throw new Error(`Transaction ${shorten(hash)} was submitted, but X Layer testnet did not return a receipt within 120s.`);
}

function App() {
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("small");
  const [walletAddress, setWalletAddress] = useState("");
  const [mockUsdcBalance, setMockUsdcBalance] = useState("");
  const [okbBalance, setOkbBalance] = useState("");
  const [busy, setBusy] = useState<ScenarioKey | "connect" | null>(null);
  const [result, setResult] = useState<ReceiptState>({
    kind: "idle",
    title: "Ready for live demo",
    detail: "Connect wallet, run a real transaction, then the app waits for the mined receipt and prints the tx hash.",
  });

  const active = scenarios[activeScenario];
  const decision = useMemo(
    () =>
      calculateSwapDecision(defaultLaunchConfig, {
        minute: active.minute,
        tradeSize: active.amount,
        walletBought: 0,
        isBuy: true,
      }),
    [active],
  );
  const ensureChainAndSigner = async () => {
    if (!window.ethereum) {
      throw new Error("No wallet found. Install or enable OKX Wallet / MetaMask.");
    }

    const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
    if (!isXLayerTestnet(currentChainId)) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainIdHex }],
        });
      } catch (switchError: unknown) {
        if ((switchError as { code?: number }).code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainIdHex,
                chainName: "X Layer Testnet",
                nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
                rpcUrls: [rpcUrl],
                blockExplorerUrls: [explorer],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }
    }

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    return { provider, signer, address };
  };

  const refreshBalances = async (provider: BrowserProvider, address: string) => {
    const quoteToken = new Contract(mockUSDC, erc20Abi, provider);
    const [quoteBalance, nativeBalance] = await Promise.all([
      quoteToken.balanceOf(address) as Promise<bigint>,
      provider.getBalance(address),
    ]);

    setMockUsdcBalance(formatBalance(quoteBalance));
    setOkbBalance(formatBalance(nativeBalance));
    return { quoteBalance, nativeBalance };
  };

  const connectWallet = async () => {
    try {
      setBusy("connect");
      await window.ethereum?.request({ method: "eth_requestAccounts" });
      const { provider, address } = await ensureChainAndSigner();
      const balances = await refreshBalances(provider, address);
      setWalletAddress(address);

      setResult({
        kind: balances.nativeBalance > 0n ? "idle" : "blocked",
        title: balances.nativeBalance > 0n ? "Wallet connected" : "Wallet needs testnet OKB",
        detail: `${shorten(address, 10, 8)} · ${formatBalance(balances.quoteBalance)} mUSDC · ${formatBalance(balances.nativeBalance)} OKB gas`,
      });
    } catch (error) {
      setResult({
        kind: "blocked",
        title: "Wallet connection failed",
        detail: error instanceof Error ? error.message.slice(0, 220) : "Wallet connection failed.",
      });
    } finally {
      setBusy(null);
    }
  };

  const executeLivePurchase = async (scenario: ScenarioKey) => {
    const selected = scenarios[scenario];
    const amount = parseEther(String(selected.amount));

    try {
      setActiveScenario(scenario);

      if (scenario === "large") {
        setBusy(null);
        setResult({
          kind: "blocked",
          title: "Large buy blocked on-chain",
          detail:
            "Wallets often refuse to broadcast a transaction they can already simulate as reverted. This button shows the mined X Layer receipt where the Hook blocked the oversized buy.",
          txHash: blockedLargeReceipt.hash,
        });
        return;
      }

      setBusy(scenario);
      if (!walletAddress) {
        await window.ethereum?.request({ method: "eth_requestAccounts" });
      }

      const { provider, signer, address } = await ensureChainAndSigner();
      const balances = await refreshBalances(provider, address);
      setWalletAddress(address);

      if (balances.nativeBalance === 0n) {
        setResult({
          kind: "blocked",
          title: "Need X Layer testnet OKB",
          detail: "The wallet has 0 OKB, so it cannot approve or send a transaction.",
        });
        return;
      }

      if (balances.quoteBalance < amount) {
        setResult({
          kind: "blocked",
          title: "Need more mUSDC",
          detail: `This scenario needs ${selected.amount.toLocaleString()} mUSDC. Current wallet has ${formatBalance(balances.quoteBalance)}.`,
        });
        return;
      }

      const quoteToken = new Contract(mockUSDC, erc20Abi, signer);
      const marketPool = new Contract(selected.pool, marketPoolAbi, signer);
      let allowance = (await quoteToken.allowance(address, selected.pool)) as bigint;

      if (allowance < amount) {
        setResult({
          kind: "pending",
          title: "Step 1/2: approve mUSDC",
          detail: `Wallet action needed: open OKX Wallet / MetaMask and approve ${selected.amount.toLocaleString()} mUSDC. If the popup is hidden, click the wallet extension icon. After approval mines, a second buy popup will appear.`,
        });
        const approveTx = await quoteToken.approve(selected.pool, amount);
        setResult({
          kind: "pending",
          title: "Approval submitted",
          detail: "Wallet confirmed the approval. Waiting for X Layer testnet to mine it before opening the buy popup.",
          txHash: approveTx.hash,
        });
        await waitForMinedTx(approveTx.hash);
        allowance = (await quoteToken.allowance(address, selected.pool)) as bigint;

        if (allowance < amount) {
          setResult({
            kind: "blocked",
            title: "Approval not visible on-chain",
            detail: `Approval tx mined, but allowance is still ${formatBalance(allowance)} mUSDC. Try approving again, or reset the token spending cap in the wallet.`,
            txHash: approveTx.hash,
          });
          return;
        }
      }

      setResult({
        kind: "pending",
        title: "Step 2/2: confirm buy",
        detail:
          allowance < amount
            ? "Approval mined. Open the wallet popup and confirm the buy transaction now."
            : "Existing approval is enough. Open the wallet popup and confirm the buy transaction now.",
      });
      const buyTx = await marketPool.buy(amount, { gasLimit: 500000 });
      setResult({
        kind: "pending",
        title: "Buy submitted",
        detail: "Wallet confirmed the buy. Waiting for X Layer testnet receipt.",
        txHash: buyTx.hash,
      });
      const mined = await waitForMinedTx(buyTx.hash);

      setResult({
        kind: mined?.status === 1 ? "success" : "blocked",
        title: mined?.status === 1 ? "Live purchase passed" : "Live purchase reverted",
        detail:
          mined?.status === 1
            ? `Paid ${selected.amount.toLocaleString()} mUSDC and received HPAD on X Layer testnet.`
            : "The Hook blocked the transaction on-chain.",
        txHash: buyTx.hash,
      });

      await refreshBalances(provider, address);
    } catch (error) {
      const receipt = (error as { receipt?: { hash?: string; status?: number } }).receipt;
      const txHash = receipt?.hash || (error as { transactionHash?: string }).transactionHash;
      setResult({
        kind: scenario === "large" || receipt?.status === 0 ? "blocked" : "idle",
        title: scenario === "large" ? "Large buy blocked" : "Transaction did not complete",
        detail: error instanceof Error ? error.message.slice(0, 220) : "Wallet rejected or transaction failed.",
        txHash,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <ShieldCheck size={26} />
          <div>
            <strong>HookPad</strong>
            <span>X Layer Fair Launch Hook</span>
          </div>
        </div>
        <a href={explorer} target="_blank" rel="noreferrer" className="network">
          X Layer Testnet
          <ExternalLink size={14} />
        </a>
      </header>

      <section className="status-line">
        <strong>{walletAddress ? `Connected ${shorten(walletAddress, 10, 8)}` : "Wallet not connected"}</strong>
        <span>{result.title}</span>
        {result.txHash && (
          <a href={explorerTx(result.txHash)} target="_blank" rel="noreferrer">
            Tx {shorten(result.txHash, 8, 4)}
          </a>
        )}
      </section>

      <section className="overview-grid">
        <section className="panel intro-panel">
          <div className="section-title">
            <Info size={18} />
            What HookPad Does
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature" key={feature.title}>
                <strong>{feature.title}</strong>
                <p>{feature.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel usage-panel">
          <div className="section-title">
            <Play size={18} />
            How To Use
          </div>
          <div className="steps">
            {usageSteps.map((step, index) => (
              <div className="step" key={step.title}>
                <strong>{index + 1}</strong>
                <div>
                  <span>{step.title}</span>
                  <p>{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="console-grid">
        <section className="panel live-panel">
          <div className="panel-heading">
            <div>
              <span>Live Demo</span>
              <h1>Real mUSDC → HPAD purchase on X Layer</h1>
            </div>
            <button type="button" className="connect" onClick={connectWallet} disabled={busy === "connect"}>
              <Wallet size={17} />
              {busy === "connect" ? "Connecting..." : walletAddress ? "Refresh Wallet" : "Connect Wallet"}
            </button>
          </div>

          <div className="balances">
            <Balance icon={<Wallet size={17} />} label="Wallet" value={walletAddress ? shorten(walletAddress, 10, 8) : "Not connected"} />
            <Balance icon={<FileCheck2 size={17} />} label="mUSDC" value={mockUsdcBalance || "-"} />
            <Balance icon={<Fuel size={17} />} label="Gas OKB" value={okbBalance || "-"} />
          </div>

          <div className="scenario-grid">
            {(Object.keys(scenarios) as ScenarioKey[]).map((key) => {
              const item = scenarios[key];
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  className={`scenario ${activeScenario === key ? "active" : ""} ${key === "large" ? "danger" : ""}`}
                  key={key}
                  onClick={() => {
                    executeLivePurchase(key);
                  }}
                  disabled={busy !== null}
                >
                  <Icon size={18} />
                  <strong>{busy === key ? "Running..." : item.label}</strong>
                  <span>{item.status}</span>
                </button>
              );
            })}
          </div>

          <ResultCard result={result} />
        </section>

        <aside className="panel verdict-panel">
          <span>Hook Verdict</span>
          <div className={decision.allowed ? "verdict pass" : "verdict block"}>
            {decision.allowed ? "Allowed" : "Blocked"}
          </div>
          <div className="metric-grid">
            <Metric label="Scenario" value={activeScenario === "small" ? "Small buy" : activeScenario === "large" ? "Large buy" : "Open buy"} />
            <Metric label="Phase" value={decision.phase} />
            <Metric label="Fee" value={formatPctBps(decision.feeBps)} />
            <Metric label="Vault" value={formatUsd(decision.vaultAmount)} />
          </div>
          <p>{decision.reason}</p>
        </aside>
      </section>

      <section className="evidence-grid">
        <section className="panel">
          <div className="section-title">
            <Link2 size={18} />
            Contracts
          </div>
          <div className="rows">
            {contracts.map((contract) =>
              contract.local ? (
                <div className="row local-row" key={contract.label}>
                  <span>{contract.label}</span>
                  <code>{contract.value}</code>
                </div>
              ) : (
                <a className={contract.primary ? "row primary-row" : "row"} href={explorerAddress(contract.value)} target="_blank" rel="noreferrer" key={contract.label}>
                  <span>{contract.label}</span>
                  <code>{shorten(contract.value, 10, 8)}</code>
                  <ExternalLink size={14} />
                </a>
              ),
            )}
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <BadgeCheck size={18} />
            Verified Receipts
          </div>
          <div className="rows">
            {receipts.map((receipt) => (
              <a className="row primary-row" href={explorerTx(receipt.hash)} target="_blank" rel="noreferrer" key={receipt.hash}>
                <span>{receipt.title}</span>
                <code>{receipt.status} · {shorten(receipt.hash, 8, 4)}</code>
                <ExternalLink size={14} />
              </a>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <ShieldCheck size={18} />
            Protection Logic
          </div>
          <div className="logic-list">
            <div>
              <strong>Launch phase</strong>
              <p>Small buys pass, oversized buys revert with the Hook reason.</p>
            </div>
            <div>
              <strong>Cooling phase</strong>
              <p>Trading remains open with softer launch protection and adaptive fees.</p>
            </div>
            <div>
              <strong>Open market</strong>
              <p>Protection unlocks and larger trades can go through normally.</p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Balance({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="balance">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResultCard({ result }: { result: ReceiptState }) {
  const Icon = result.kind === "blocked" ? XCircle : result.kind === "success" ? BadgeCheck : result.kind === "pending" ? Clock3 : ShieldCheck;

  return (
    <div className={`result-card ${result.kind}`} aria-live="polite">
      <div>
        <Icon size={22} />
        <strong>{result.title}</strong>
      </div>
      <p>{result.detail}</p>
      {result.txHash && (
        <a href={explorerTx(result.txHash)} target="_blank" rel="noreferrer">
          Open transaction
          <code>{shorten(result.txHash, 10, 8)}</code>
          <ExternalLink size={15} />
        </a>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
