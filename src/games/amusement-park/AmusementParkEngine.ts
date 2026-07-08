import { invoke } from "@tauri-apps/api/core";
import type { UpgradeDef } from "@/engine/types";
import { OFFLINE_SIM_CAP_MS } from "@/engine/pluginValidation";

export interface AmusementParkState {
  queueLength: number;
  totalServed: number;
  abandoned: number;
  lastSaveAt: number;
  ownedUpgradeIds: string[];
  pendingOfflineGold?: number;

  // Game parameters
  arrivalRate: number;      // lambda (guests/sec)
  paretoScale: number;      // min service time
  paretoAlpha: number;      // consistency/reliability of ride
  heatIndex: number;        // friction [0.0 – 1.0]
  goldPerGuest: number;
}

export const getInitialState = (): AmusementParkState => ({
  queueLength: 5,
  totalServed: 0,
  abandoned: 0,
  lastSaveAt: Date.now(),
  ownedUpgradeIds: [],
  arrivalRate: 0.1,         // 1 guest per 10s
  paretoScale: 5.0,         // base ride time
  paretoAlpha: 3.0,         // quite reliable
  heatIndex: 0.0,
  goldPerGuest: 10.0,
});

// Safety net beyond what the upgrade math can reach (maxLevel × costScaling
// already caps each upgrade) — guards against a corrupted/hand-edited save
// or a future compounding upgrade blowing these up (e.g. paretoScale → ~0
// sends serviceRate → ∞; the pre-fix purchase bug that let repeatable
// upgrades be bought unboundedly hit exactly this).
//
// Non-finite values heal to the fresh-state default rather than a bound:
// a pre-fix save serialized NaN as null (issue #10), and Math.min/max would
// only propagate it.
function clampField(x: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof x === "number" && Number.isFinite(x) ? x : fallback;
  return Math.min(Math.max(n, lo), hi);
}

const DEFAULTS = getInitialState();

function clampState(state: AmusementParkState): AmusementParkState {
  return {
    ...state,
    arrivalRate: clampField(state.arrivalRate, 0, 10, DEFAULTS.arrivalRate),
    paretoScale: clampField(state.paretoScale, 0.5, 50, DEFAULTS.paretoScale),
    paretoAlpha: clampField(state.paretoAlpha, 2.01, 10, DEFAULTS.paretoAlpha),
    queueLength: clampField(state.queueLength, 0, 1_000_000, DEFAULTS.queueLength),
    heatIndex: clampField(state.heatIndex, 0, 1, DEFAULTS.heatIndex),
    goldPerGuest: clampField(state.goldPerGuest, 0, 1000, DEFAULTS.goldPerGuest),
    totalServed: clampField(state.totalServed, 0, Number.MAX_SAFE_INTEGER, 0),
    abandoned: clampField(state.abandoned, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

export const hydrateState = async (raw: unknown): Promise<AmusementParkState> => {
  const state = (raw ?? {}) as Partial<AmusementParkState>;
  const hydrated: AmusementParkState = clampState({
    ...getInitialState(),
    ...state,
    ownedUpgradeIds: Array.isArray(state.ownedUpgradeIds)
      ? state.ownedUpgradeIds.filter((id): id is string => typeof id === "string")
      : [],
  });

  const now = Date.now();
  const lastSaveAt = clampField(state.lastSaveAt, 0, now, now);
  const elapsedSeconds = Math.min(now - lastSaveAt, OFFLINE_SIM_CAP_MS) / 1000.0;

  // Only calculate if significant time has passed (> 5 seconds)
  if (elapsedSeconds > 5.0) {
    try {
      const offlineResult = await invoke<{
        guestsServed: number;
        guestsAbandoned: number;
        goldEarned: number;
        newQueueLength: number;
        timeSimulatedSeconds: number;
      }>("calculate_amusement_park_offline", {
        elapsedSeconds,
        arrivalRate: hydrated.arrivalRate,
        paretoScale: hydrated.paretoScale,
        paretoAlpha: hydrated.paretoAlpha,
        heatIndex: hydrated.heatIndex,
        // Active ticks make queueLength fractional; the Rust param is u32 and
        // serde rejects a float, which silently skipped offline progress.
        currentQueue: Math.floor(hydrated.queueLength),
        goldPerGuest: hydrated.goldPerGuest,
      });

      // The Rust side owns the math, but never let a bad payload re-corrupt
      // a save we just healed.
      hydrated.totalServed += Math.max(0, offlineResult.guestsServed || 0);
      hydrated.abandoned += Math.max(0, offlineResult.guestsAbandoned || 0);
      hydrated.queueLength = clampField(
        offlineResult.newQueueLength, 0, 1_000_000, hydrated.queueLength
      );
      hydrated.pendingOfflineGold = Math.max(0, offlineResult.goldEarned || 0);
    } catch (e) {
      console.error("Failed to calculate offline progress:", e);
    }
  }

  hydrated.lastSaveAt = now;
  return clampState(hydrated);
};

// Fast local UI tick — deterministic approximation for smooth visuals
export const tick = (state: AmusementParkState, deltaMs: number) => {
  let goldEarned = 0;

  // Simplified active tick using expected throughput
  const arrivals = (state.arrivalRate * deltaMs) / 1000.0;
  const expectedServiceTime =
    (state.paretoAlpha * state.paretoScale) / (state.paretoAlpha - 1.0);
  const serviceRate = 1.0 / expectedServiceTime;
  const served = Math.min(
    state.queueLength + arrivals,
    (serviceRate * deltaMs) / 1000.0
  );

  goldEarned += served * state.goldPerGuest;

  return {
    next: clampState({
      ...state,
      queueLength: Math.max(0, state.queueLength + arrivals - served),
      totalServed: state.totalServed + served,
      lastSaveAt: Date.now(),
    }),
    goldEarned,
    crystalsEarned: 0,
  };
};

export const reset = (state: AmusementParkState): AmusementParkState => ({
  ...state,
  queueLength: 5,
  totalServed: 0,
  abandoned: 0,
  lastSaveAt: Date.now(),
});

// ─── Upgrades ────────────────────────────────────────────────
// Two-axis: "what" = ride type, "how" = ride improvements
// Repeatable "how" upgrades scale via costScaling (cost × scaling^level).

export const AMUSEMENT_PARK_UPGRADES: UpgradeDef[] = [
  // ── "What" axis: Ride type (radio-selectable, resets queue on switch) ──
  {
    id: "ride-carousel",
    label: "Carousel",
    description: "Gentle classic ride. Short service time.",
    cost: 0,
    maxLevel: 1,
    group: "what",
    groupLabel: "Ride",
    icon: "🎠",
    apply: (state, _level) => ({
      ...(state as AmusementParkState),
      paretoScale: 5.0,
      paretoAlpha: 4.0,  // very consistent
      goldPerGuest: 10.0,
      queueLength: 5,
      totalServed: 0,
    }),
  },
  {
    id: "ride-coaster",
    label: "Roller Coaster",
    description: "Thrilling! Longer ride time, but 3× gold.",
    cost: 6000,
    maxLevel: 1,
    group: "what",
    groupLabel: "Ride",
    icon: "🎢",
    apply: (state, _level) => ({
      ...(state as AmusementParkState),
      paretoScale: 12.0,
      paretoAlpha: 2.5,  // heavier tail — breakdowns happen
      goldPerGuest: 30.0,
      queueLength: 5,
      totalServed: 0,
    }),
  },
  {
    id: "ride-waterslide",
    label: "Water Slide",
    description: "Reduces heat index friction by 50%.",
    cost: 25000,
    maxLevel: 1,
    group: "what",
    groupLabel: "Ride",
    icon: "🌊",
    requires: ["ride-coaster"],
    apply: (state, _level) => ({
      ...(state as AmusementParkState),
      paretoScale: 8.0,
      paretoAlpha: 3.0,
      goldPerGuest: 25.0,
      heatIndex: (state as AmusementParkState).heatIndex * 0.5,
      queueLength: 5,
      totalServed: 0,
    }),
  },

  // ── "How" axis: Ride improvements (cumulative, never reset progress) ──
  {
    id: "extra-carts",
    label: "Extra Carts",
    description: "Faster service: ×0.8 ride time per level.",
    cost: 150,
    costScaling: 1.6,
    maxLevel: 5,
    group: "how",
    groupLabel: "Ride Upgrades",
    icon: "🛒",
    apply: (state, level) => ({
      ...(state as AmusementParkState),
      paretoScale: (state as AmusementParkState).paretoScale * Math.pow(0.8, level),
    }),
  },
  {
    id: "shade-canopy",
    label: "Shade Canopy",
    description: "Reduces heat index by 0.1 per level.",
    cost: 300,
    costScaling: 1.6,
    maxLevel: 5,
    group: "how",
    groupLabel: "Ride Upgrades",
    icon: "⛱️",
    apply: (state, level) => ({
      ...(state as AmusementParkState),
      heatIndex: Math.max(0, (state as AmusementParkState).heatIndex - 0.1 * level),
    }),
  },
  {
    id: "marketing-blitz",
    label: "Marketing Blitz",
    description: "Increases arrival rate by ×1.5 per level.",
    cost: 500,
    costScaling: 1.8,
    maxLevel: 3,
    group: "how",
    groupLabel: "Ride Upgrades",
    icon: "📢",
    apply: (state, level) => ({
      ...(state as AmusementParkState),
      arrivalRate: (state as AmusementParkState).arrivalRate * Math.pow(1.5, level),
    }),
  },
];

// ─── Helpers ─────────────────────────────────────────────────

export function getActiveUpgradeIds(state: AmusementParkState): string[] {
  return state.ownedUpgradeIds.filter((id) => {
    const def = AMUSEMENT_PARK_UPGRADES.find((u) => u.id === id);
    return def !== undefined;
  });
}
