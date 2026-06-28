import type { UpgradeDef, UpgradeInstance } from "@/engine/types";

export interface WaterBoilState {
  currentTemp: number;       // °C
  isBoiling: boolean;
  totalBoils: number;
  potVolumeLiters: number;   // derived from upgrades
  heaterWatts: number;       // derived from upgrades
  ownedUpgradeIds: string[];
  lastSaveAt: number;
}

const SPECIFIC_HEAT = 4182; // J/(kg·°C) for water
const BOIL_TEMP = 100;
const START_TEMP = 20;

// Gold scales with the SQUARE of volume so a bigger pot improves the gold RATE,
// not just the lump sum. (Boil time ∝ volume, so linear gold left rate flat —
// the pot upgrade was a trap that only lengthened each cycle.) goldRate now
// ∝ volume·watts. Tuned so the 0.5 L starter stays at 5 gold.
export function goldPerBoil(volumeLiters: number): number {
  return volumeLiters * volumeLiters * 20;
}

export function getInitialState(): WaterBoilState {
  return {
    currentTemp: START_TEMP,
    isBoiling: false,
    totalBoils: 0,
    potVolumeLiters: 0.5,
    heaterWatts: 50,
    ownedUpgradeIds: ["pot-small", "heat-candle"],
    lastSaveAt: Date.now(),
  };
}

export function hydrateState(raw: unknown): WaterBoilState {
  const defaults = getInitialState();
  if (typeof raw !== "object" || raw === null) return defaults;
  const r = raw as Partial<WaterBoilState>;
  return {
    currentTemp: r.currentTemp ?? defaults.currentTemp,
    isBoiling: r.isBoiling ?? false,
    totalBoils: r.totalBoils ?? 0,
    potVolumeLiters: r.potVolumeLiters ?? defaults.potVolumeLiters,
    heaterWatts: r.heaterWatts ?? defaults.heaterWatts,
    ownedUpgradeIds: r.ownedUpgradeIds ?? defaults.ownedUpgradeIds,
    lastSaveAt: r.lastSaveAt ?? Date.now(),
  };
}

export function tick(
  state: WaterBoilState,
  deltaMs: number
): { next: WaterBoilState; goldEarned: number; crystalsEarned: number } {
  if (state.isBoiling) {
    return { next: state, goldEarned: 0, crystalsEarned: 0 };
  }

  const deltaSeconds = deltaMs / 1000;
  const massKg = state.potVolumeLiters;
  const deltaTemp = (state.heaterWatts * deltaSeconds) / (massKg * SPECIFIC_HEAT);
  const newTemp = Math.min(state.currentTemp + deltaTemp, BOIL_TEMP);

  if (newTemp >= BOIL_TEMP) {
    const goldEarned = goldPerBoil(state.potVolumeLiters);
    return {
      next: {
        ...state,
        currentTemp: BOIL_TEMP,
        isBoiling: true,
        totalBoils: state.totalBoils + 1,
        lastSaveAt: Date.now(),
      },
      goldEarned,
      crystalsEarned: 0,
    };
  }

  return {
    next: { ...state, currentTemp: newTemp },
    goldEarned: 0,
    crystalsEarned: 0,
  };
}

export function reset(state: WaterBoilState): WaterBoilState {
  return {
    ...state,
    currentTemp: START_TEMP,
    isBoiling: false,
    lastSaveAt: Date.now(),
  };
}

export function getTimeRemainingSeconds(state: WaterBoilState): number {
  if (state.isBoiling) return 0;
  const massKg = state.potVolumeLiters;
  const heatNeeded = massKg * SPECIFIC_HEAT * (BOIL_TEMP - state.currentTemp);
  return heatNeeded / state.heaterWatts;
}

export function calculateOfflineProgress(
  state: WaterBoilState,
  nowMs: number
): { state: WaterBoilState; offlineGoldEarned: number } {
  const offlineMs = Math.min(nowMs - state.lastSaveAt, 8 * 60 * 60 * 1000);
  if (offlineMs <= 0) return { state, offlineGoldEarned: 0 };

  let current = state;
  let totalGold = 0;
  const CHUNK_MS = 60_000;
  let remaining = offlineMs;

  while (remaining > 0) {
    const delta = Math.min(remaining, CHUNK_MS);
    const { next, goldEarned } = tick(current, delta);
    totalGold += goldEarned;
    // Auto-reset between boils during offline simulation
    current = next.isBoiling ? reset(next) : next;
    remaining -= delta;
  }

  // Mark everything up to now as accounted for, so the next hydrate doesn't
  // re-simulate this same window.
  return {
    state: { ...current, lastSaveAt: nowMs },
    offlineGoldEarned: totalGold,
  };
}

// Changing the pot means fresh, cold water — reset the heat. (Switching the
// heater keeps whatever's already in the pot.)
function selectPot(s: unknown, liters: number): WaterBoilState {
  return {
    ...(s as WaterBoilState),
    potVolumeLiters: liters,
    currentTemp: START_TEMP,
    isBoiling: false,
  };
}

// Two radio groups: "pot" (the "what" axis — volume) and "heater" (the "how"
// axis — watts). Heater is a single smooth ladder (50→500→1000→3000→3500 W);
// the old tree jumped 50→3500 W in one cheap step.
export const WATER_BOIL_UPGRADES: UpgradeDef[] = [
  {
    id: "pot-small",
    group: "pot",
    label: "Small Pot",
    description: "0.5L — your trusty saucepan",
    cost: 0,
    maxLevel: 1,
    apply: (s) => selectPot(s, 0.5),
  },
  {
    id: "pot-medium",
    group: "pot",
    label: "Medium Pot",
    description: "1L — 4× the gold per boil",
    cost: 50,
    maxLevel: 1,
    requires: ["pot-small"],
    apply: (s) => selectPot(s, 1.0),
  },
  {
    id: "pot-large",
    group: "pot",
    label: "Large Pot",
    description: "2L — serious boiling operation",
    cost: 200,
    maxLevel: 1,
    requires: ["pot-medium"],
    apply: (s) => selectPot(s, 2.0),
  },
  {
    id: "heat-candle",
    group: "heater",
    label: "Candle",
    description: "50W — slow but it works",
    cost: 0,
    maxLevel: 1,
    apply: (s) => ({ ...(s as WaterBoilState), heaterWatts: 50 }),
  },
  {
    id: "heat-hotplate",
    group: "heater",
    label: "Hot Plate",
    description: "500W — a real step up from the candle",
    cost: 80,
    maxLevel: 1,
    requires: ["heat-candle"],
    apply: (s) => ({ ...(s as WaterBoilState), heaterWatts: 500 }),
  },
  {
    id: "heat-electric",
    group: "heater",
    label: "Electric Hob",
    description: "1000W — steady kitchen heat",
    cost: 300,
    maxLevel: 1,
    requires: ["heat-hotplate"],
    apply: (s) => ({ ...(s as WaterBoilState), heaterWatts: 1000 }),
  },
  {
    id: "heat-induction",
    group: "heater",
    label: "Induction Cooktop",
    description: "3000W — efficient & precise",
    cost: 1200,
    maxLevel: 1,
    requires: ["heat-electric"],
    apply: (s) => ({ ...(s as WaterBoilState), heaterWatts: 3000 }),
  },
  {
    id: "heat-gas",
    group: "heater",
    label: "Gas Stove",
    description: "3500W — now we're cooking",
    cost: 2500,
    maxLevel: 1,
    requires: ["heat-induction"],
    apply: (s) => ({ ...(s as WaterBoilState), heaterWatts: 3500 }),
  },
];

export function getOwnedUpgradeInstances(
  ownedIds: string[]
): UpgradeInstance[] {
  return ownedIds.map((id) => ({ id, level: 1 }));
}

const POT_BY_VOLUME: Record<number, string> = {
  0.5: "pot-small",
  1: "pot-medium",
  2: "pot-large",
};

const HEATER_BY_WATTS: Record<number, string> = {
  50: "heat-candle",
  500: "heat-hotplate",
  1000: "heat-electric",
  3000: "heat-induction",
  3500: "heat-gas",
};

/** The currently-active upgrade id in each radio group ("pot" + "heater"). */
export function getActiveUpgradeIds(state: WaterBoilState): string[] {
  const ids: string[] = [];
  const pot = POT_BY_VOLUME[state.potVolumeLiters];
  if (pot) ids.push(pot);
  const heater = HEATER_BY_WATTS[state.heaterWatts];
  if (heater) ids.push(heater);
  return ids;
}
