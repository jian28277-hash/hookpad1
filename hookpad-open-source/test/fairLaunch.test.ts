import { describe, expect, it } from "vitest";
import { calculateSwapDecision, defaultLaunchConfig } from "../src/lib/fairLaunch";

describe("FairLaunch fee engine", () => {
  it("lets small early buyers pass with adaptive fees", () => {
    const result = calculateSwapDecision(defaultLaunchConfig, {
      minute: 2,
      tradeSize: 2_000,
      walletBought: 0,
      isBuy: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.phase).toBe("Launch");
    expect(result.feeBps).toBe(330);
    expect(result.vaultAmount).toBeGreaterThan(0);
  });

  it("blocks launch buys above the transaction cap", () => {
    const result = calculateSwapDecision(defaultLaunchConfig, {
      minute: 3,
      tradeSize: 12_000,
      walletBought: 0,
      isBuy: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/per-transaction/);
  });

  it("keeps sells open during launch windows", () => {
    const result = calculateSwapDecision(defaultLaunchConfig, {
      minute: 1,
      tradeSize: 20_000,
      walletBought: 0,
      isBuy: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.feeBps).toBe(defaultLaunchConfig.baseFeeBps);
  });

  it("returns to standard fees after launch and cooling", () => {
    const result = calculateSwapDecision(defaultLaunchConfig, {
      minute: 150,
      tradeSize: 200_000,
      walletBought: 0,
      isBuy: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.phase).toBe("Open");
    expect(result.feeBps).toBe(defaultLaunchConfig.baseFeeBps);
  });
});
