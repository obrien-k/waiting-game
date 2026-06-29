import { invoke } from "@tauri-apps/api/core";
import type { UpgradeDef, UpgradeInstance } from "@/engine/types";

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

export const hydrateState = async (raw: unknown): Promise<AmusementParkState> => {
  const state = raw as Partial<AmusementParkState>;
  const hydrated: AmusementParkState = {
    ...getInitialState(),
    ...state,
  };

  const now = Date.now();
  const elapsedSeconds = (now - hydrated.lastSaveAt) / 1000.0;

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
        currentQueue: hydrated.queueLength,
        goldPerGuest: hydrated.goldPerGuest,
      });

      hydrated.totalServed += offlineResult.guestsServed;
      hydrated.abandoned += offlineResult.guestsAbandoned;
      hydrated.queueLength = offlineResult.newQueueLength;
      hydrated.pendingOfflineGold = offlineResult.goldEarned;
    } catch (e) {
      console.error("Failed to calculate offline progress:", e);
    }
  }

  hydrated.lastSaveAt = now;
  return hydrated;
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
    next: {
      ...state,
      queueLength: Math.max(0, state.queueLength + arrivals - served),
      totalServed: state.totalServed + served,
      lastSaveAt: Date.now(),
    },
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
// Cost scaling: Tier 1 = Base × 1.15^Level

export const AMUSEMENT_PARK_UPGRADES: UpgradeDef[] = [
  // ── "What" axis: Ride type (radio-selectable, resets queue on switch) ──
  {
    id: "ride-carousel",
    label: "Carousel",
    description: "Gentle classic ride. Short service time.",
    cost: 0,
    maxLevel: 1,
    group: "what",
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
    cost: 500,
    maxLevel: 1,
    group: "what",
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
    cost: 2000,
    maxLevel: 1,
    group: "what",
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
    cost: 100,
    maxLevel: 5,
    group: "how",
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
    cost: 200,
    maxLevel: 5,
    group: "how",
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
    cost: 300,
    maxLevel: 3,
    group: "how",
    icon: "📢",
    apply: (state, level) => ({
      ...(state as AmusementParkState),
      arrivalRate: (state as AmusementParkState).arrivalRate * Math.pow(1.5, level),
    }),
  },
];

// ─── Helpers ─────────────────────────────────────────────────

export function getOwnedUpgradeInstances(
  ownedIds: string[] | undefined
): UpgradeInstance[] {
  return (ownedIds ?? []).map((id) => ({ id, level: 1 }));
}

export function getActiveUpgradeIds(state: AmusementParkState): string[] {
  return state.ownedUpgradeIds.filter((id) => {
    const def = AMUSEMENT_PARK_UPGRADES.find((u) => u.id === id);
    return def !== undefined;
  });
}
