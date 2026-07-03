import { describe, it, expect } from "vitest";
import {
  tick,
  calculateOfflineProgress,
  getInitialState,
  reset,
  VARIANTS,
  type PlantGrowState,
} from "./plantGrowEngine";
import { PLUGIN_LIMITS } from "@/engine/pluginValidation";

// Force a variant to complete on the next tick so we can inspect the payout.
function aboutToComplete(variantId: string): PlantGrowState {
  return {
    ...getInitialState(),
    activeVariantId: variantId,
    // Hard mode ignores conditionMultiplier, so a high value is harmless there
    // and lets the non-hard variants complete in a single large tick.
    conditionMultiplier: 1,
    progress: 0.999999,
    isComplete: false,
  };
}

describe("plant-grow gold-clamp invariant", () => {
  // The live-path bug: the shell clamps each tick's gold to goldPerTickMax, but
  // a completion pays its full lump sum in one tick. If the ceiling is below the
  // max completion payout, online completions truncate while offline pays full.
  it("per-tick gold ceiling is at least the max completion payout", () => {
    expect(PLUGIN_LIMITS.goldPerTickMax).toBeGreaterThanOrEqual(
      PLUGIN_LIMITS.goldPerCompletion.max
    );
  });

  it("every variant's completion payout survives the clamp untruncated", () => {
    for (const v of VARIANTS) {
      const { goldEarned } = tick(aboutToComplete(v.id), 10_000);
      expect(goldEarned).toBe(v.goldPerCompletion);
      expect(Math.min(goldEarned, PLUGIN_LIMITS.goldPerTickMax)).toBe(
        v.goldPerCompletion
      );
    }
  });
});

describe("plant-grow artifact minting", () => {
  it("emits the completed variant id as artifactId on completion", () => {
    const oak = VARIANTS.find((v) => v.isHardMode)!;
    const { artifactId, crystalsEarned } = tick(aboutToComplete(oak.id), 10_000);
    expect(artifactId).toBe(oak.id);
    expect(crystalsEarned).toBe(1);
  });

  it("does not mint an artifact on a non-completing tick", () => {
    const state = { ...getInitialState(), progress: 0.1 };
    const { artifactId } = tick(state, 250);
    expect(artifactId).toBeUndefined();
  });

  it("aggregates offline completions into counts (hoard model)", () => {
    // Ryegrass (90s) over an 8h-capped offline window completes many times; the
    // chunked replay resets after each completion, so counts accumulate.
    const start = getInitialState();
    const eightHoursAgo = Date.now() - 9 * 60 * 60 * 1000; // beyond the 8h cap
    const { offlineArtifacts, offlineGoldEarned } = calculateOfflineProgress(
      { ...start, activeVariantId: "ryegrass", lastSaveAt: eightHoursAgo },
      Date.now()
    );
    expect(offlineArtifacts["ryegrass"]).toBeGreaterThan(0);
    // Offline gold is the unclamped sum — the count of completions times payout.
    const ryegrass = VARIANTS.find((v) => v.id === "ryegrass")!;
    expect(offlineGoldEarned).toBe(
      offlineArtifacts["ryegrass"] * ryegrass.goldPerCompletion
    );
  });
});

describe("reset", () => {
  it("clears progress without touching upgrades", () => {
    const s = { ...getInitialState(), progress: 0.5, isComplete: true };
    const r = reset(s);
    expect(r.progress).toBe(0);
    expect(r.isComplete).toBe(false);
    expect(r.ownedUpgradeIds).toEqual(s.ownedUpgradeIds);
  });
});
