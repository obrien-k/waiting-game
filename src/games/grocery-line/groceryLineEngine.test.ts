import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...a: unknown[]) => invokeMock(...a),
}));

import {
  tick,
  hydrateState,
  getInitialState,
  getParams,
  getActiveUpgradeIds,
  GROCERY_LINE_UPGRADES,
  type GroceryLineState,
} from "./groceryLineEngine";

const offline = (o: Partial<Record<string, number>> = {}) => ({
  shoppersServed: 0, shoppersAbandoned: 0, goldEarned: 0,
  newQueueLength: 3, timeSimulatedSeconds: 60, ...o,
});

// Braces matter: vitest treats a function returned from beforeEach as teardown.
beforeEach(() => {
  invokeMock.mockReset();
});

describe("grocery-line params are derived, not stored", () => {
  it("re-selecting a lane can't compound upgrades (old amusement-park bug)", () => {
    let s: GroceryLineState = {
      ...getInitialState(),
      ownedUpgradeIds: ["lane-regular", "lane-express", "bagger", "bagger"],
    };
    const before = getParams(s);
    const express = GROCERY_LINE_UPGRADES.find((u) => u.id === "lane-express")!;
    const regular = GROCERY_LINE_UPGRADES.find((u) => u.id === "lane-regular")!;
    for (let i = 0; i < 50; i++) s = regular.apply(express.apply(s, 1), 1) as GroceryLineState;
    expect(getParams(s)).toEqual(before);
  });

  it("bagger and weekly ad scale per level", () => {
    const base = getParams(getInitialState());
    const up = getParams({
      ...getInitialState(),
      ownedUpgradeIds: ["lane-regular", "bagger", "weekly-ad", "weekly-ad"],
    });
    expect(up.paretoScale).toBeCloseTo(base.paretoScale * 0.85);
    expect(up.arrivalRate).toBeCloseTo(base.arrivalRate * 1.3 ** 2);
  });

  it("marks the active lane for the upgrade panel", () => {
    expect(getActiveUpgradeIds(getInitialState())).toEqual(["lane-regular"]);
  });
});

describe("grocery-line hydration", () => {
  it("migrates an amusement-park save: drops ride ids and stored params, keeps stats", async () => {
    invokeMock.mockImplementation(async () => { throw new Error("invoke unavailable"); });
    const legacy = {
      queueLength: 9, totalServed: 500, abandoned: 4, lastSaveAt: Date.now(),
      ownedUpgradeIds: ["ride-carousel", "ride-coaster", "extra-carts", "shade-canopy"],
      arrivalRate: 12_594_992.6, paretoScale: 1.8e-8, paretoAlpha: 2.5, heatIndex: 0.4, goldPerGuest: 30,
    };
    const s = await hydrateState(legacy);
    expect(s.ownedUpgradeIds).toEqual(["lane-regular"]);
    expect(s.activeLaneId).toBe("regular");
    expect(s.totalServed).toBe(500);
    expect(s).not.toHaveProperty("paretoScale");
    expect(s).not.toHaveProperty("heatIndex");
  });

  it("won't activate a lane the save doesn't own", async () => {
    const s = await hydrateState({ ...getInitialState(), activeLaneId: "self", lastSaveAt: Date.now() });
    expect(s.activeLaneId).toBe("regular");
  });

  // Issue #10: a pre-fix save persisted NaN as null.
  it("heals a null/NaN save and keeps running", async () => {
    invokeMock.mockImplementation(async () => { throw new Error("invoke unavailable"); });
    const s = await hydrateState({ queueLength: null, totalServed: null, lastSaveAt: Date.now() - 60_000 });
    expect(s.queueLength).toBe(getInitialState().queueLength);
    expect(s.totalServed).toBe(0);
    const { next, goldEarned } = tick(s, 250);
    expect(Number.isFinite(next.queueLength)).toBe(true);
    expect(Number.isFinite(goldEarned)).toBe(true);
  });

  it("passes an integer queue to the Rust u32 param", async () => {
    invokeMock.mockResolvedValue(offline({ goldEarned: 100 }));
    const s = await hydrateState({ ...getInitialState(), queueLength: 7.6, lastSaveAt: Date.now() - 60_000 });
    expect(invokeMock).toHaveBeenCalledWith("calculate_grocery_line_offline", expect.anything());
    const args = invokeMock.mock.calls[0][1] as { currentQueue: number };
    expect(Number.isInteger(args.currentQueue)).toBe(true);
    expect(s.queueLength).toBe(3);
    expect(s.pendingOfflineGold).toBe(100);
  });

  it("caps the offline window at 8 hours", async () => {
    invokeMock.mockResolvedValue(offline());
    await hydrateState({ ...getInitialState(), lastSaveAt: Date.now() - 8 * 24 * 3600 * 1000 });
    const args = invokeMock.mock.calls[0][1] as { elapsedSeconds: number };
    expect(args.elapsedSeconds).toBeLessThanOrEqual(8 * 3600);
  });

  it("does not re-corrupt a healed save from a bad offline payload", async () => {
    invokeMock.mockResolvedValue(offline({ shoppersServed: NaN, shoppersAbandoned: NaN, goldEarned: NaN, newQueueLength: NaN }));
    const s = await hydrateState({ ...getInitialState(), queueLength: 12, lastSaveAt: Date.now() - 60_000 });
    expect(s.queueLength).toBe(12);
    expect(s.pendingOfflineGold).toBe(0);
    expect(Number.isFinite(s.totalServed)).toBe(true);
  });
});
