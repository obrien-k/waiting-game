import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...a: unknown[]) => invokeMock(...a),
}));

import {
  tick,
  hydrateState,
  getInitialState,
  type AmusementParkState,
} from "./AmusementParkEngine";

describe("amusement-park tick clamping", () => {
  it("pulls an exploded state (from the pre-fix unbounded-upgrade bug) back into sane bounds", () => {
    const exploded: AmusementParkState = {
      queueLength: 330_382_777_364,
      totalServed: 10_493_264_810,
      abandoned: 0,
      lastSaveAt: Date.now(),
      ownedUpgradeIds: ["ride-coaster", "extra-carts", "marketing-blitz", "shade-canopy", "ride-waterslide"],
      arrivalRate: 12_594_992.6,
      paretoScale: 1.8e-8,
      paretoAlpha: 2.5,
      heatIndex: 0,
      goldPerGuest: 30,
    };

    const { next } = tick(exploded, 250);

    expect(next.arrivalRate).toBeLessThanOrEqual(10);
    expect(next.paretoScale).toBeGreaterThanOrEqual(0.5);
    expect(next.queueLength).toBeLessThanOrEqual(1_000_000);
    expect(next.heatIndex).toBeGreaterThanOrEqual(0);
    expect(next.heatIndex).toBeLessThanOrEqual(1);
    expect(next.goldPerGuest).toBeLessThanOrEqual(1000);
    expect(Number.isFinite(next.queueLength)).toBe(true);
  });

  it("leaves normal in-range state untouched", () => {
    const normal: AmusementParkState = {
      queueLength: 12,
      totalServed: 40,
      abandoned: 2,
      lastSaveAt: Date.now(),
      ownedUpgradeIds: [],
      arrivalRate: 0.1,
      paretoScale: 5.0,
      paretoAlpha: 3.0,
      heatIndex: 0.2,
      goldPerGuest: 10,
    };

    const { next } = tick(normal, 250);

    expect(next.arrivalRate).toBe(0.1);
    expect(next.paretoScale).toBe(5.0);
    expect(next.heatIndex).toBe(0.2);
    expect(next.goldPerGuest).toBe(10);
  });
});

// Issue #10: a pre-fix save persisted NaN as null; hydration must heal it
// instead of letting the explicit null override the defaults.
describe("amusement-park hydration recovery", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("heals the corrupt null/NaN save to finite defaults", async () => {
    invokeMock.mockRejectedValue(new Error("invoke unavailable"));
    const corrupt = {
      queueLength: null,
      totalServed: null,
      lastSaveAt: Date.now() - 60_000,
    };

    const healed = await hydrateState(corrupt);

    expect(Number.isFinite(healed.queueLength)).toBe(true);
    expect(healed.queueLength).toBe(getInitialState().queueLength);
    expect(healed.totalServed).toBe(0);
    // ...and the game must actually run from the healed state.
    const { next, goldEarned } = tick(healed, 250);
    expect(Number.isFinite(next.queueLength)).toBe(true);
    expect(Number.isFinite(goldEarned)).toBe(true);
  });

  it("passes an integer queue to the Rust u32 param (fractional queue skipped offline calc)", async () => {
    invokeMock.mockResolvedValue({
      guestsServed: 10,
      guestsAbandoned: 1,
      goldEarned: 100,
      newQueueLength: 3,
      timeSimulatedSeconds: 60,
    });
    const saved: Partial<AmusementParkState> = {
      ...getInitialState(),
      queueLength: 7.6,
      lastSaveAt: Date.now() - 60_000,
    };

    const hydrated = await hydrateState(saved);

    expect(invokeMock).toHaveBeenCalledOnce();
    const args = invokeMock.mock.calls[0][1] as { currentQueue: number };
    expect(Number.isInteger(args.currentQueue)).toBe(true);
    expect(hydrated.queueLength).toBe(3);
    expect(hydrated.pendingOfflineGold).toBe(100);
  });

  it("does not re-corrupt a healed save from a bad offline payload", async () => {
    invokeMock.mockResolvedValue({
      guestsServed: NaN,
      guestsAbandoned: NaN,
      goldEarned: NaN,
      newQueueLength: NaN,
      timeSimulatedSeconds: 60,
    });
    const saved: Partial<AmusementParkState> = {
      ...getInitialState(),
      queueLength: 12,
      lastSaveAt: Date.now() - 60_000,
    };

    const hydrated = await hydrateState(saved);

    expect(hydrated.queueLength).toBe(12);
    expect(hydrated.pendingOfflineGold).toBe(0);
    expect(Number.isFinite(hydrated.totalServed)).toBe(true);
  });
});
