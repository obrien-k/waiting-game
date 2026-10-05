import { invoke } from "@tauri-apps/api/core";
import type { UpgradeDef } from "@/engine/types";
import { OFFLINE_SIM_CAP_MS } from "@/engine/pluginValidation";

// Waiting in Line — a grocery checkout as an M/G/1 queue.
// Poisson arrivals (shoppers), Pareto service times (the heavy tail is the
// person paying by check). Gold per shopper checked out.
//
// Queue parameters are DERIVED from the active lane + owned upgrade levels on
// every read, never stored. That kills the compounding-apply bug class the old
// amusement-park version had (re-selecting a "how" upgrade re-multiplied it).

export type LaneId = "regular" | "express" | "self";

export interface Lane {
  arrivalRate: number;  // λ, shoppers/sec
  paretoScale: number;  // x_m, minimum checkout time (s)
  paretoAlpha: number;  // tail shape; lower = more "price check on aisle 5"
  goldPerShopper: number;
}

// Tuned to be stingy — this Wait is about the waiting. Regular lane ≈ 120
// gold/hr, on par with a sunflower; self-checkout tops out ≈ 180/hr. One
// shopper a minute, half-minute checkouts.
export const LANES: Record<LaneId, Lane> = {
  regular: { arrivalRate: 1 / 60, paretoScale: 20, paretoAlpha: 3.0, goldPerShopper: 2 },   // E[S] 30s, ρ 0.50
  express: { arrivalRate: 1 / 30, paretoScale: 6,  paretoAlpha: 4.0, goldPerShopper: 1.2 }, // E[S] 8s,  ρ 0.27
  self:    { arrivalRate: 1 / 20, paretoScale: 4,  paretoAlpha: 2.2, goldPerShopper: 1 },   // E[S] 7.3s, ρ 0.37, fat tail
};

const BAGGER_SPEEDUP = 0.85;  // service time × per level
const WEEKLY_AD_BOOST = 1.3;  // arrivals × per level

export interface GroceryLineState {
  queueLength: number;
  totalServed: number;
  abandoned: number;
  lastSaveAt: number;
  ownedUpgradeIds: string[];
  activeLaneId: LaneId;
  pendingOfflineGold?: number;
}

export interface QueueParams extends Lane {
  expectedServiceTime: number; // E[S]
  serviceRate: number;         // μ
  utilization: number;         // ρ = λ·E[S]
}

const level = (owned: string[], id: string) => owned.filter((x) => x === id).length;

export function getParams(state: GroceryLineState): QueueParams {
  const lane = LANES[state.activeLaneId] ?? LANES.regular;
  const arrivalRate = lane.arrivalRate * WEEKLY_AD_BOOST ** level(state.ownedUpgradeIds, "weekly-ad");
  const paretoScale = Math.max(0.5, lane.paretoScale * BAGGER_SPEEDUP ** level(state.ownedUpgradeIds, "bagger"));
  const paretoAlpha = Math.max(2.01, lane.paretoAlpha);
  const expectedServiceTime = (paretoAlpha * paretoScale) / (paretoAlpha - 1);
  return {
    ...lane,
    arrivalRate,
    paretoScale,
    paretoAlpha,
    expectedServiceTime,
    serviceRate: 1 / expectedServiceTime,
    utilization: arrivalRate * expectedServiceTime,
  };
}

// Non-finite values heal to the fallback rather than a bound: an old save
// serialized NaN as null (issue #10), and Math.min/max would propagate it.
function clampField(x: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof x === "number" && Number.isFinite(x) ? x : fallback;
  return Math.min(Math.max(n, lo), hi);
}

const isLaneId = (x: unknown): x is LaneId => typeof x === "string" && x in LANES;

export const getInitialState = (): GroceryLineState => ({
  queueLength: 3,
  totalServed: 0,
  abandoned: 0,
  lastSaveAt: Date.now(),
  ownedUpgradeIds: ["lane-regular"],
  activeLaneId: "regular",
});

function clampState(state: GroceryLineState): GroceryLineState {
  return {
    ...state,
    queueLength: clampField(state.queueLength, 0, 1_000_000, 3),
    totalServed: clampField(state.totalServed, 0, Number.MAX_SAFE_INTEGER, 0),
    abandoned: clampField(state.abandoned, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

const KNOWN_UPGRADE_IDS = new Set<string>(); // filled after GROCERY_LINE_UPGRADES

export const hydrateState = async (raw: unknown): Promise<GroceryLineState> => {
  const saved = (raw ?? {}) as Partial<GroceryLineState> & Record<string, unknown>;

  // Saves from the amusement-park era carry ride-*/extra-carts/... ids and
  // stored queue params. Drop both; only current upgrade ids survive.
  const owned = Array.isArray(saved.ownedUpgradeIds)
    ? saved.ownedUpgradeIds.filter((id): id is string => typeof id === "string" && KNOWN_UPGRADE_IDS.has(id))
    : [];
  if (!owned.includes("lane-regular")) owned.unshift("lane-regular");

  const activeLaneId = isLaneId(saved.activeLaneId) && owned.includes(`lane-${saved.activeLaneId}`)
    ? saved.activeLaneId
    : "regular";

  const hydrated = clampState({
    queueLength: saved.queueLength as number,
    totalServed: saved.totalServed as number,
    abandoned: saved.abandoned as number,
    lastSaveAt: 0,
    ownedUpgradeIds: owned,
    activeLaneId,
  });

  const now = Date.now();
  const lastSaveAt = clampField(saved.lastSaveAt, 0, now, now);
  const elapsedSeconds = Math.min(now - lastSaveAt, OFFLINE_SIM_CAP_MS) / 1000;

  if (elapsedSeconds > 5) {
    const p = getParams(hydrated);
    try {
      const r = await invoke<{
        shoppersServed: number;
        shoppersAbandoned: number;
        goldEarned: number;
        newQueueLength: number;
        timeSimulatedSeconds: number;
      }>("calculate_grocery_line_offline", {
        elapsedSeconds,
        arrivalRate: p.arrivalRate,
        paretoScale: p.paretoScale,
        paretoAlpha: p.paretoAlpha,
        // Active ticks make queueLength fractional; the Rust param is u32 and
        // serde rejects a float, which silently skipped offline progress.
        currentQueue: Math.floor(hydrated.queueLength),
        goldPerShopper: p.goldPerShopper,
      });

      // Rust owns the math, but never let a bad payload re-corrupt a healed save.
      hydrated.totalServed += Math.max(0, r.shoppersServed || 0);
      hydrated.abandoned += Math.max(0, r.shoppersAbandoned || 0);
      hydrated.queueLength = clampField(r.newQueueLength, 0, 1_000_000, hydrated.queueLength);
      hydrated.pendingOfflineGold = Math.max(0, r.goldEarned || 0);
    } catch (e) {
      console.error("Failed to calculate offline progress:", e);
    }
  }

  hydrated.lastSaveAt = now;
  return clampState(hydrated);
};

// Live tick: deterministic expected-throughput approximation for smooth UI.
// The stochastic version runs in Rust for offline windows.
export const tick = (rawState: GroceryLineState, deltaMs: number) => {
  const state = clampState(rawState);
  const p = getParams(state);
  const arrivals = (p.arrivalRate * deltaMs) / 1000;
  const served = Math.min(state.queueLength + arrivals, (p.serviceRate * deltaMs) / 1000);

  return {
    next: clampState({
      ...state,
      queueLength: Math.max(0, state.queueLength + arrivals - served),
      totalServed: state.totalServed + served,
      lastSaveAt: Date.now(),
    }),
    goldEarned: served * p.goldPerShopper,
    crystalsEarned: 0,
  };
};

export const reset = (state: GroceryLineState): GroceryLineState => ({
  ...state,
  queueLength: 3,
  totalServed: 0,
  abandoned: 0,
  lastSaveAt: Date.now(),
});

// ─── Upgrades ────────────────────────────────────────────────
// "What" = which lane you're in (radio group). "How" = two permanent,
// repeatable store upgrades. Both are read by getParams; apply() only
// records the lane switch.

const selectLane = (id: LaneId) => (s: unknown): GroceryLineState => ({
  ...(s as GroceryLineState),
  activeLaneId: id,
  queueLength: 3, // you changed lines; new line, new strangers
});

export const GROCERY_LINE_UPGRADES: UpgradeDef[] = [
  {
    id: "lane-regular",
    label: "Regular Lane",
    description: "Full carts, one cashier. Slow, but every shopper pays well.",
    cost: 0,
    maxLevel: 1,
    group: "what",
    groupLabel: "Lane",
    icon: "🛒",
    apply: selectLane("regular"),
  },
  {
    id: "lane-express",
    label: "Express Lane",
    description: "10 items or less. More shoppers, smaller baskets.",
    cost: 1500,
    maxLevel: 1,
    group: "what",
    groupLabel: "Lane",
    icon: "🧺",
    apply: selectLane("express"),
  },
  {
    id: "lane-self",
    label: "Self-Checkout",
    description: "Fastest on average. Unexpected item in bagging area.",
    cost: 5000,
    maxLevel: 1,
    group: "what",
    groupLabel: "Lane",
    icon: "🤖",
    requires: ["lane-express"],
    apply: selectLane("self"),
  },
  {
    id: "bagger",
    label: "Bagger",
    description: "Checkout 15% faster per level.",
    cost: 150,
    costScaling: 1.6,
    maxLevel: 3,
    icon: "🛍️",
    apply: (s) => s,
  },
  {
    id: "weekly-ad",
    label: "Weekly Ad",
    description: "30% more shoppers per level. Watch the line.",
    cost: 300,
    costScaling: 1.8,
    maxLevel: 3,
    icon: "📰",
    apply: (s) => s,
  },
];

for (const u of GROCERY_LINE_UPGRADES) KNOWN_UPGRADE_IDS.add(u.id);

/** Active member of the lane radio group, for UpgradePanel's ✓ Active badge. */
export function getActiveUpgradeIds(state: GroceryLineState): string[] {
  return [`lane-${state.activeLaneId}`];
}
