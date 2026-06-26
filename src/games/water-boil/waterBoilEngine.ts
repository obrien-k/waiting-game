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
    const goldEarned = state.potVolumeLiters * 10;
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

  return { state: current, offlineGoldEarned: totalGold };
}

// Upgrade definitions
export const WATER_BOIL_UPGRADES: UpgradeDef[] = [
  {
    id: "pot-small",
    label: "Small Pot",
    description: "0.5L — your trusty saucepan",
    cost: 0,
    maxLevel: 1,
    apply: (s) => ({ ...(s as WaterBoilState), potVolumeLiters: 0.5 }),
  },
  {
    id: "pot-medium",
    label: "Medium Pot",
    description: "1L — more water, more gold",
    cost: 50,
    maxLevel: 1,
    requires: ["pot-small"],
    apply: (s) => ({ ...(s as WaterBoilState), potVolumeLiters: 1.0 }),
  },
  {
    id: "pot-large",
    label: "Large Pot",
    description: "2L — serious boiling operation",
    cost: 200,
    maxLevel: 1,
    requires: ["pot-medium"],
    apply: (s) => ({ ...(s as WaterBoilState), potVolumeLiters: 2.0 }),
  },
  {
    id: "heat-candle",
    label: "Candle",
    description: "50W — slow but it works",
    cost: 0,
    maxLevel: 1,
    apply: (s) => ({ ...(s as WaterBoilState), heaterWatts: 50 }),
  },
  {
    id: "heat-gas",
    label: "Gas Stove",
    description: "3500W — now we're cooking",
    cost: 100,
    maxLevel: 1,
    requires: ["heat-candle"],
    apply: (s) => ({ ...(s as WaterBoilState), heaterWatts: 3500 }),
  },
  {
    id: "heat-electric",
    label: "Electric Hob",
    description: "1000W — cheaper than gas",
    cost: 500,
    maxLevel: 1,
    requires: ["heat-candle"],
    apply: (s) => ({ ...(s as WaterBoilState), heaterWatts: 1000 }),
  },
  {
    id: "heat-induction",
    label: "Induction Cooktop",
    description: "3000W — efficient & precise",
    cost: 2000,
    maxLevel: 1,
    requires: ["heat-electric"],
    apply: (s) => ({ ...(s as WaterBoilState), heaterWatts: 3000 }),
  },
];

export function getOwnedUpgradeInstances(
  ownedIds: string[]
): UpgradeInstance[] {
  return ownedIds.map((id) => ({ id, level: 1 }));
}
