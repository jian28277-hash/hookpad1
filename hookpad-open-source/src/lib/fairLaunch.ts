export type LaunchPhase = "Launch" | "Cooling" | "Open";

export type LaunchConfig = {
  launchMinutes: number;
  coolingMinutes: number;
  baseFeeBps: number;
  firstWindowFeeBps: number;
  secondWindowFeeBps: number;
  lateWindowFeeBps: number;
  sizePenaltyBps: number;
  exposurePenaltyBps: number;
  maxBuyPerTxPct: number;
  maxBuyPerWalletPct: number;
  poolLiquidity: number;
  totalSupply: number;
};

export type SwapInput = {
  minute: number;
  tradeSize: number;
  walletBought: number;
  isBuy: boolean;
};

export type SwapDecision = {
  phase: LaunchPhase;
  allowed: boolean;
  feeBps: number;
  feeAmount: number;
  vaultAmount: number;
  reason: string;
  txLimit: number;
  walletLimit: number;
};

export const defaultLaunchConfig: LaunchConfig = {
  launchMinutes: 30,
  coolingMinutes: 120,
  baseFeeBps: 30,
  firstWindowFeeBps: 300,
  secondWindowFeeBps: 150,
  lateWindowFeeBps: 80,
  sizePenaltyBps: 100,
  exposurePenaltyBps: 200,
  maxBuyPerTxPct: 2,
  maxBuyPerWalletPct: 0.5,
  poolLiquidity: 500_000,
  totalSupply: 100_000_000,
};

export function getPhase(config: LaunchConfig, minute: number): LaunchPhase {
  if (minute < config.launchMinutes) return "Launch";
  if (minute < config.coolingMinutes) return "Cooling";
  return "Open";
}

export function calculateSwapDecision(
  config: LaunchConfig,
  input: SwapInput,
): SwapDecision {
  const phase = getPhase(config, input.minute);
  const txLimit =
    phase === "Open"
      ? Number.POSITIVE_INFINITY
      : (config.poolLiquidity * config.maxBuyPerTxPct) / 100;
  const walletLimit =
    phase === "Open"
      ? Number.POSITIVE_INFINITY
      : (config.totalSupply * config.maxBuyPerWalletPct) / 100;

  if (!input.isBuy) {
    return {
      phase,
      allowed: true,
      feeBps: config.baseFeeBps,
      feeAmount: (input.tradeSize * config.baseFeeBps) / 10_000,
      vaultAmount: 0,
      reason: "Sell flow stays open to avoid trapping users.",
      txLimit,
      walletLimit,
    };
  }

  if (input.tradeSize > txLimit) {
    return {
      phase,
      allowed: false,
      feeBps: 0,
      feeAmount: 0,
      vaultAmount: 0,
      reason: "Trade exceeds launch-phase per-transaction limit.",
      txLimit,
      walletLimit,
    };
  }

  if (input.walletBought + input.tradeSize > walletLimit) {
    return {
      phase,
      allowed: false,
      feeBps: 0,
      feeAmount: 0,
      vaultAmount: 0,
      reason: "Wallet exceeds launch-phase cumulative buy limit.",
      txLimit,
      walletLimit,
    };
  }

  let feeBps = config.baseFeeBps;
  if (phase === "Launch") {
    if (input.minute < 5) feeBps += config.firstWindowFeeBps;
    else if (input.minute < 15) feeBps += config.secondWindowFeeBps;
    else feeBps += config.lateWindowFeeBps;
  } else if (phase === "Cooling") {
    feeBps += Math.round(config.lateWindowFeeBps / 2);
  }

  if (phase !== "Open" && input.tradeSize > txLimit * 0.7) {
    feeBps += config.sizePenaltyBps;
  }

  if (phase !== "Open" && input.walletBought + input.tradeSize > walletLimit * 0.75) {
    feeBps += config.exposurePenaltyBps;
  }

  const feeAmount = (input.tradeSize * feeBps) / 10_000;
  const baseFeeAmount = (input.tradeSize * config.baseFeeBps) / 10_000;

  return {
    phase,
    allowed: true,
    feeBps,
    feeAmount,
    vaultAmount: Math.max(0, feeAmount - baseFeeAmount),
    reason:
      phase === "Open"
        ? "Open market phase. Standard pool behavior."
        : "Buy passes with adaptive launch protection fee.",
    txLimit,
    walletLimit,
  };
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPctBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
