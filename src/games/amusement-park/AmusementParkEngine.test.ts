import { describe, it, expect } from "vitest";
import { tick, type AmusementParkState } from "./AmusementParkEngine";

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
