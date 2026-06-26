// =============================================================================
// STEP 1 — Define your variants in the VARIANTS array below.
//           The first entry is the default (free) mode.
//           Hard-mode variants (isHardMode: true) award 1 crystal on completion.
// STEP 2 — Name your upgrade IDs and adjust costs/multipliers.
// STEP 3 — Rename this file and update imports in index.ts.
// =============================================================================

import type { UpgradeDef, GameVariant } from "@/engine/types";

// ─── Variants ("what" axis) ──────────────────────────────────────────────────
// Each variant is a selectable mode. The "what" upgrade tree switches between them.
// Hard-mode variants must have baseDurationSeconds ≥ 3,600 (1 hour).
// goldPerCompletion is capped at 500 by the validation layer.

export const VARIANTS: GameVariant[] = [
  {
    id: "standard",
    label: "Standard",        // ← rename to fit your theme
    emoji: "⏳",
    baseDurationSeconds: 300, // ← how long at 1× speed with no conditions
    goldPerCompletion: 10,    // ← reward
    isHardMode: false,
  },
  // Uncomment and fill in to add a hard mode:
  // {
  //   id: "hard",
  //   label: "Hard Mode",
  //   emoji: "💀",
  //   baseDurationSeconds: 14_400,  // 4 hours minimum
  //   goldPerCompletion: 500,       // max allowed
  //   isHardMode: true,             // awards 1 💎 crystal on completion
  // },
];
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateState {
  // "What" axis — which variant is active. Set by "what" upgrades.
  activeVariantId: string;

  // "How" axis — speed multiplier. Set by "how" upgrades. 1.0 = base speed.
  conditionMultiplier: number;

  progress: number; // 0.0 → 1.0
  isComplete: boolean;
  totalCompletions: number;
  hardModeCompletions: number;
  ownedUpgradeIds: string[];
  lastSaveAt: number;
}

export function getActiveVariant(state: TemplateState): GameVariant {
  return VARIANTS.find((v) => v.id === state.activeVariantId) ?? VARIANTS[0];
}

export function getInitialState(): TemplateState {
  return {
    activeVariantId: VARIANTS[0].id,
    conditionMultiplier: 1.0,
    progress: 0,
    isComplete: false,
    totalCompletions: 0,
    hardModeCompletions: 0,
    ownedUpgradeIds: ["what-standard", "how-base"],
    lastSaveAt: Date.now(),
  };
}

export function hydrateState(raw: unknown): TemplateState {
  const defaults = getInitialState();
  if (typeof raw !== "object" || raw === null) return defaults;
  const r = raw as Partial<TemplateState>;
  return {
    activeVariantId: r.activeVariantId ?? defaults.activeVariantId,
    conditionMultiplier: r.conditionMultiplier ?? 1.0,
    progress: r.progress ?? 0,
    isComplete: r.isComplete ?? false,
    totalCompletions: r.totalCompletions ?? 0,
    hardModeCompletions: r.hardModeCompletions ?? 0,
    ownedUpgradeIds: r.ownedUpgradeIds ?? defaults.ownedUpgradeIds,
    lastSaveAt: r.lastSaveAt ?? Date.now(),
  };
}

export function getRatePerSecond(state: TemplateState): number {
  const variant = getActiveVariant(state);
  return (1 / variant.baseDurationSeconds) * state.conditionMultiplier;
}

export function getTimeRemainingSeconds(state: TemplateState): number {
  if (state.isComplete) return 0;
  const rate = getRatePerSecond(state);
  if (rate <= 0) return Infinity;
  return (1 - state.progress) / rate;
}

export function tick(
  state: TemplateState,
  deltaMs: number
): { next: TemplateState; goldEarned: number; crystalsEarned: number } {
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
        lastSaveAt: Date.now(),
      },
      goldEarned: variant.goldPerCompletion,
      crystalsEarned: variant.isHardMode ? 1 : 0,
    };
  }

  return { next: { ...state, progress: newProgress }, goldEarned: 0, crystalsEarned: 0 };
}

export function reset(state: TemplateState): TemplateState {
  return { ...state, progress: 0, isComplete: false, lastSaveAt: Date.now() };
}

export function calculateOfflineProgress(
  state: TemplateState,
  nowMs: number
): { state: TemplateState; offlineGoldEarned: number; offlineCrystalsEarned: number } {
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
// Two trees: "what" selects the variant, "how" sets conditionMultiplier.
// Rename labels/descriptions to fit your theme. Adjust costs freely.

export const TEMPLATE_UPGRADES: UpgradeDef[] = [
  // — What tree —
  {
    id: "what-standard",
    label: "Standard (rename me)",
    description: "The default thing you're waiting for",
    cost: 0,
    maxLevel: 1,
    apply: (s) => ({
      ...(s as TemplateState),
      activeVariantId: "standard",
      progress: 0,         // switching variant resets progress
    }),
  },
  // Add more "what" entries for each VARIANT above, e.g.:
  // {
  //   id: "what-hard",
  //   label: "Hard Mode (rename me)",
  //   description: "...",
  //   cost: 500,
  //   maxLevel: 1,
  //   requires: ["what-standard", "how-3x"],
  //   apply: (s) => ({ ...(s as TemplateState), activeVariantId: "hard", progress: 0 }),
  // },

  // — How tree —
  {
    id: "how-base",
    label: "Default Conditions (rename me)",
    description: "Base speed — 1×",
    cost: 0,
    maxLevel: 1,
    apply: (s) => ({ ...(s as TemplateState), conditionMultiplier: 1.0 }),
  },
  {
    id: "how-2x",
    label: "Better Conditions (rename me)",
    description: "2× speed",
    cost: 50,
    maxLevel: 1,
    requires: ["how-base"],
    apply: (s) => ({ ...(s as TemplateState), conditionMultiplier: 2.0 }),
  },
  {
    id: "how-5x",
    label: "Best Conditions (rename me)",
    description: "5× speed",
    cost: 200,
    maxLevel: 1,
    requires: ["how-2x"],
    apply: (s) => ({ ...(s as TemplateState), conditionMultiplier: 5.0 }),
  },
];
