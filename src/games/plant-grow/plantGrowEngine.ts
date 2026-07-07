import type { UpgradeDef, GameVariant } from "@/engine/types";
import { OFFLINE_SIM_CAP_MS } from "@/engine/pluginValidation";

// ─── Variants ("what" axis) ──────────────────────────────────────────────────
// Each species grows at its own base rate. The "what" tree switches between
// them; switching resets progress (a new seed starts over).
// Hard-mode oak must be ≥ 172,800s (2 days) per the validation layer.

export const VARIANTS: GameVariant[] = [
  { id: "ryegrass", label: "Ryegrass", emoji: "🌱", baseDurationSeconds: 90, goldPerCompletion: 6, isHardMode: false },
  { id: "sunflower", label: "Sunflower", emoji: "🌻", baseDurationSeconds: 900, goldPerCompletion: 22, isHardMode: false },
  { id: "rose", label: "Rose Bush", emoji: "🌹", baseDurationSeconds: 7200, goldPerCompletion: 75, isHardMode: false },
  // Hard mode: an oak from sapling. 2-day base growth → 1 💎.
  { id: "oak", label: "Oak Sapling", emoji: "🌳", baseDurationSeconds: 172_800, goldPerCompletion: 500, isHardMode: true },
];
// ─────────────────────────────────────────────────────────────────────────────

export interface PlantGrowState {
  activeVariantId: string;     // "what" axis
  conditionMultiplier: number; // "how" axis — 1.0 = windowsill sun
  progress: number;            // 0.0 → 1.0
  isComplete: boolean;
  totalCompletions: number;
  hardModeCompletions: number;
  lifetimeGold: number;
  ownedUpgradeIds: string[];
  lastSaveAt: number;
}

export function getActiveVariant(state: PlantGrowState): GameVariant {
  return VARIANTS.find((v) => v.id === state.activeVariantId) ?? VARIANTS[0];
}

// Maps condition multiplier → the "how" upgrade id that sets it, so the panel
// can show which owned condition is currently active.
const HOW_BY_MULTIPLIER: Record<number, string> = {
  1: "how-windowsill",
  3: "how-watering",
  8: "how-fertilizer",
  20: "how-greenhouse",
};

/** The currently-active upgrade id in each radio group ("what" + "how"). */
export function getActiveUpgradeIds(state: PlantGrowState): string[] {
  const ids = [`what-${state.activeVariantId}`];
  const how = HOW_BY_MULTIPLIER[state.conditionMultiplier];
  if (how) ids.push(how);
  return ids;
}

// Growth stage emoji by progress — a seed becomes a sprout becomes the species.
export function getGrowthStageEmoji(state: PlantGrowState): string {
  const variant = getActiveVariant(state);
  if (state.isComplete) return variant.emoji ?? "🌳";
  if (state.progress < 0.25) return "🌰";
  if (state.progress < 0.6) return "🌱";
  return "🌿";
}

export function getInitialState(): PlantGrowState {
  return {
    activeVariantId: VARIANTS[0].id,
    conditionMultiplier: 1.0,
    progress: 0,
    isComplete: false,
    totalCompletions: 0,
    hardModeCompletions: 0,
    lifetimeGold: 0,
    ownedUpgradeIds: ["what-ryegrass", "how-windowsill"],
    lastSaveAt: Date.now(),
  };
}

export function hydrateState(raw: unknown): PlantGrowState {
  const defaults = getInitialState();
  if (typeof raw !== "object" || raw === null) return defaults;
  const r = raw as Partial<PlantGrowState>;
  return {
    activeVariantId: r.activeVariantId ?? defaults.activeVariantId,
    conditionMultiplier: r.conditionMultiplier ?? 1.0,
    progress: r.progress ?? 0,
    isComplete: r.isComplete ?? false,
    totalCompletions: r.totalCompletions ?? 0,
    hardModeCompletions: r.hardModeCompletions ?? 0,
    lifetimeGold: r.lifetimeGold ?? 0,
    ownedUpgradeIds: r.ownedUpgradeIds ?? defaults.ownedUpgradeIds,
    lastSaveAt: r.lastSaveAt ?? Date.now(),
  };
}

export function getRatePerSecond(state: PlantGrowState): number {
  const variant = getActiveVariant(state);
  // Hard mode is a fixed real-time grind: the condition multiplier does not
  // apply, so the oak always takes its full 2 days once unlocked. (The unlock
  // gate is what makes it "impossible" to reach early, not the rate.)
  if (variant.isHardMode) return 1 / variant.baseDurationSeconds;
  return (1 / variant.baseDurationSeconds) * state.conditionMultiplier;
}

export function getTimeRemainingSeconds(state: PlantGrowState): number {
  if (state.isComplete) return 0;
  const rate = getRatePerSecond(state);
  if (rate <= 0) return Infinity;
  return (1 - state.progress) / rate;
}

export function tick(
  state: PlantGrowState,
  deltaMs: number
): { next: PlantGrowState; goldEarned: number; crystalsEarned: number; artifactId?: string } {
  if (state.isComplete) return { next: state, goldEarned: 0, crystalsEarned: 0 };

  const rate = getRatePerSecond(state);
  const newProgress = Math.min(state.progress + rate * (deltaMs / 1000), 1);

  if (newProgress >= 1) {
    const variant = getActiveVariant(state);
    return {
      next: {
        ...state,
        progress: 1,
        isComplete: true,
        totalCompletions: state.totalCompletions + 1,
        hardModeCompletions: state.hardModeCompletions + (variant.isHardMode ? 1 : 0),
        lifetimeGold: state.lifetimeGold + variant.goldPerCompletion,
        lastSaveAt: Date.now(),
      },
      goldEarned: variant.goldPerCompletion,
      crystalsEarned: variant.isHardMode ? 1 : 0,
      artifactId: variant.id,
    };
  }

  return { next: { ...state, progress: newProgress }, goldEarned: 0, crystalsEarned: 0 };
}

export function reset(state: PlantGrowState): PlantGrowState {
  return { ...state, progress: 0, isComplete: false, lastSaveAt: Date.now() };
}

export function calculateOfflineProgress(
  state: PlantGrowState,
  nowMs: number
): {
  state: PlantGrowState;
  offlineGoldEarned: number;
  offlineCrystalsEarned: number;
  /** Bare artifact id → count minted while away (hoard model, aggregated). */
  offlineArtifacts: Record<string, number>;
} {
  const offlineMs = Math.min(nowMs - state.lastSaveAt, OFFLINE_SIM_CAP_MS);
  if (offlineMs <= 0)
    return { state, offlineGoldEarned: 0, offlineCrystalsEarned: 0, offlineArtifacts: {} };

  let current = state;
  let totalGold = 0;
  let totalCrystals = 0;
  const artifacts: Record<string, number> = {};
  let remaining = offlineMs;
  const CHUNK_MS = 60_000;

  while (remaining > 0) {
    const delta = Math.min(remaining, CHUNK_MS);
    const { next, goldEarned, crystalsEarned, artifactId } = tick(current, delta);
    totalGold += goldEarned;
    totalCrystals += crystalsEarned;
    if (artifactId) artifacts[artifactId] = (artifacts[artifactId] ?? 0) + 1;
    current = next.isComplete ? reset(next) : next;
    remaining -= delta;
  }

  // Mark everything up to now as accounted for, so the next hydrate doesn't
  // re-simulate this same window.
  return {
    state: { ...current, lastSaveAt: nowMs },
    offlineGoldEarned: totalGold,
    offlineCrystalsEarned: totalCrystals,
    offlineArtifacts: artifacts,
  };
}

// ─── Upgrades ────────────────────────────────────────────────────────────────
// "What" selects the species; "how" sets growing conditions (conditionMultiplier).
// Hard-mode oak is gated behind the top "how" tier so it can't be reached early.

// A fresh seed: starts over, regardless of whether the prior plant had matured.
function selectVariant(s: unknown, id: string): PlantGrowState {
  return { ...(s as PlantGrowState), activeVariantId: id, progress: 0, isComplete: false };
}

export const PLANT_GROW_UPGRADES: UpgradeDef[] = [
  // — What tree (species) —
  {
    id: "what-ryegrass",
    group: "what",
    groupLabel: "Plant",
    label: "Ryegrass",
    description: "It's grass. It grows. Quickly.",
    cost: 0,
    maxLevel: 1,
    apply: (s) => selectVariant(s, "ryegrass"),
  },
  {
    id: "what-sunflower",
    group: "what",
    groupLabel: "Plant",
    label: "Sunflower",
    description: "Tall, cheerful, a bit more patience",
    cost: 350,
    maxLevel: 1,
    requires: ["what-ryegrass"],
    apply: (s) => selectVariant(s, "sunflower"),
  },
  {
    id: "what-rose",
    group: "what",
    groupLabel: "Plant",
    label: "Rose Bush",
    description: "Slow to bloom, worth more",
    cost: 2000,
    maxLevel: 1,
    requires: ["what-sunflower"],
    apply: (s) => selectVariant(s, "rose"),
  },
  {
    id: "what-oak",
    group: "what",
    groupLabel: "Plant",
    label: "Oak Sapling 💎",
    description: "From acorn to tree — a 2-day grow, awards 1 crystal",
    cost: 8000,
    maxLevel: 1,
    requires: ["what-rose", "how-greenhouse"],
    apply: (s) => selectVariant(s, "oak"),
  },

  // — How tree (growing conditions) —
  {
    id: "how-windowsill",
    group: "how",
    groupLabel: "Growing Conditions",
    label: "Windowsill",
    description: "A bit of sun — 1×",
    cost: 0,
    maxLevel: 1,
    apply: (s) => ({ ...(s as PlantGrowState), conditionMultiplier: 1.0 }),
  },
  {
    id: "how-watering",
    group: "how",
    groupLabel: "Growing Conditions",
    label: "Daily Watering",
    description: "Keep it hydrated — 3×",
    cost: 400,
    maxLevel: 1,
    requires: ["how-windowsill"],
    apply: (s) => ({ ...(s as PlantGrowState), conditionMultiplier: 3.0 }),
  },
  {
    id: "how-fertilizer",
    group: "how",
    groupLabel: "Growing Conditions",
    label: "Fertilizer",
    description: "Feed the roots — 8×",
    cost: 2500,
    maxLevel: 1,
    requires: ["how-watering"],
    apply: (s) => ({ ...(s as PlantGrowState), conditionMultiplier: 8.0 }),
  },
  {
    id: "how-greenhouse",
    group: "how",
    groupLabel: "Growing Conditions",
    label: "Greenhouse",
    description: "Perfect climate — 20× (unlocks oak)",
    cost: 9000,
    maxLevel: 1,
    requires: ["how-fertilizer"],
    apply: (s) => ({ ...(s as PlantGrowState), conditionMultiplier: 20.0 }),
  },
];
