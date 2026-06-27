import type { UpgradeDef, GameVariant } from "@/engine/types";

// ─── Variants ("what" axis) ──────────────────────────────────────────────────
// Each paint type dries at its own base rate. The "what" tree switches between
// them; switching resets progress (a fresh coat starts wet).
// Hard-mode enamel must be ≥ 172,800s (2 days) per the validation layer.

export const VARIANTS: GameVariant[] = [
  { id: "emulsion", label: "Emulsion", emoji: "🪣", baseDurationSeconds: 120, goldPerCompletion: 8, isHardMode: false },
  { id: "matte", label: "Matte", emoji: "🎨", baseDurationSeconds: 300, goldPerCompletion: 18, isHardMode: false },
  { id: "gloss", label: "Gloss", emoji: "✨", baseDurationSeconds: 900, goldPerCompletion: 60, isHardMode: false },
  // Hard mode: a thick marine enamel coat. 2-day base cure → 1 💎.
  { id: "enamel", label: "Marine Enamel", emoji: "🛢️", baseDurationSeconds: 172_800, goldPerCompletion: 500, isHardMode: true },
];
// ─────────────────────────────────────────────────────────────────────────────

export interface PaintDryState {
  activeVariantId: string;   // "what" axis
  conditionMultiplier: number; // "how" axis — 1.0 = still air
  progress: number;          // 0.0 → 1.0
  isComplete: boolean;
  totalCompletions: number;
  hardModeCompletions: number;
  lifetimeGold: number;
  ownedUpgradeIds: string[];
  lastSaveAt: number;
}

export function getActiveVariant(state: PaintDryState): GameVariant {
  return VARIANTS.find((v) => v.id === state.activeVariantId) ?? VARIANTS[0];
}

export function getInitialState(): PaintDryState {
  return {
    activeVariantId: VARIANTS[0].id,
    conditionMultiplier: 1.0,
    progress: 0,
    isComplete: false,
    totalCompletions: 0,
    hardModeCompletions: 0,
    lifetimeGold: 0,
    ownedUpgradeIds: ["what-emulsion", "how-still"],
    lastSaveAt: Date.now(),
  };
}

export function hydrateState(raw: unknown): PaintDryState {
  const defaults = getInitialState();
  if (typeof raw !== "object" || raw === null) return defaults;
  const r = raw as Partial<PaintDryState>;
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

export function getRatePerSecond(state: PaintDryState): number {
  const variant = getActiveVariant(state);
  return (1 / variant.baseDurationSeconds) * state.conditionMultiplier;
}

export function getTimeRemainingSeconds(state: PaintDryState): number {
  if (state.isComplete) return 0;
  const rate = getRatePerSecond(state);
  if (rate <= 0) return Infinity;
  return (1 - state.progress) / rate;
}

export function tick(
  state: PaintDryState,
  deltaMs: number
): { next: PaintDryState; goldEarned: number; crystalsEarned: number } {
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
    };
  }

  return { next: { ...state, progress: newProgress }, goldEarned: 0, crystalsEarned: 0 };
}

export function reset(state: PaintDryState): PaintDryState {
  return { ...state, progress: 0, isComplete: false, lastSaveAt: Date.now() };
}

export function calculateOfflineProgress(
  state: PaintDryState,
  nowMs: number
): { state: PaintDryState; offlineGoldEarned: number; offlineCrystalsEarned: number } {
  const offlineMs = Math.min(nowMs - state.lastSaveAt, 8 * 60 * 60 * 1000);
  if (offlineMs <= 0) return { state, offlineGoldEarned: 0, offlineCrystalsEarned: 0 };

  let current = state;
  let totalGold = 0;
  let totalCrystals = 0;
  let remaining = offlineMs;
  const CHUNK_MS = 60_000;

  while (remaining > 0) {
    const delta = Math.min(remaining, CHUNK_MS);
    const { next, goldEarned, crystalsEarned } = tick(current, delta);
    totalGold += goldEarned;
    totalCrystals += crystalsEarned;
    current = next.isComplete ? reset(next) : next;
    remaining -= delta;
  }

  return { state: current, offlineGoldEarned: totalGold, offlineCrystalsEarned: totalCrystals };
}

// ─── Upgrades ────────────────────────────────────────────────────────────────
// "What" selects the paint; "how" sets drying conditions (conditionMultiplier).
// Hard-mode enamel is gated behind the top "how" tier so it can't be reached early.

export const PAINT_DRY_UPGRADES: UpgradeDef[] = [
  // — What tree (paint type) —
  {
    id: "what-emulsion",
    label: "Emulsion",
    description: "Water-based wall paint — dries quick",
    cost: 0,
    maxLevel: 1,
    apply: (s) => ({ ...(s as PaintDryState), activeVariantId: "emulsion", progress: 0 }),
  },
  {
    id: "what-matte",
    label: "Matte",
    description: "Flat finish, a little more patience",
    cost: 40,
    maxLevel: 1,
    requires: ["what-emulsion"],
    apply: (s) => ({ ...(s as PaintDryState), activeVariantId: "matte", progress: 0 }),
  },
  {
    id: "what-gloss",
    label: "Gloss",
    description: "Shiny, slow, worth more",
    cost: 150,
    maxLevel: 1,
    requires: ["what-matte"],
    apply: (s) => ({ ...(s as PaintDryState), activeVariantId: "gloss", progress: 0 }),
  },
  {
    id: "what-enamel",
    label: "Marine Enamel 💎",
    description: "Thick industrial coat — a 2-day cure, awards 1 crystal",
    cost: 600,
    maxLevel: 1,
    requires: ["what-gloss", "how-heatlamp"],
    apply: (s) => ({ ...(s as PaintDryState), activeVariantId: "enamel", progress: 0 }),
  },

  // — How tree (drying conditions) —
  {
    id: "how-still",
    label: "Still Air",
    description: "Just let it sit — 1×",
    cost: 0,
    maxLevel: 1,
    apply: (s) => ({ ...(s as PaintDryState), conditionMultiplier: 1.0 }),
  },
  {
    id: "how-fan",
    label: "Box Fan",
    description: "Airflow over the coat — 3×",
    cost: 50,
    maxLevel: 1,
    requires: ["how-still"],
    apply: (s) => ({ ...(s as PaintDryState), conditionMultiplier: 3.0 }),
  },
  {
    id: "how-dehumidifier",
    label: "Dehumidifier",
    description: "Pull the moisture out — 8×",
    cost: 200,
    maxLevel: 1,
    requires: ["how-fan"],
    apply: (s) => ({ ...(s as PaintDryState), conditionMultiplier: 8.0 }),
  },
  {
    id: "how-heatlamp",
    label: "Heat Lamp",
    description: "Bake it dry — 20× (unlocks enamel)",
    cost: 600,
    maxLevel: 1,
    requires: ["how-dehumidifier"],
    apply: (s) => ({ ...(s as PaintDryState), conditionMultiplier: 20.0 }),
  },
];
