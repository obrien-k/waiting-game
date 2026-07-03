import type { UpgradeDef, GameVariant } from "@/engine/types";

// ─── Real evaporation physics ────────────────────────────────────────────────
// A wet coat dries as its solvent (water, for these paints) evaporates. We model
// the constant-rate drying period: the solvent mass per area divided by the
// evaporative mass flux gives the drying time.
//
//   Psat(T)        Tetens saturation vapour pressure of water           [kPa]
//   C(T,RH)        vapour concentration = RH·Psat·Mw/(R·T)              [kg/m³]
//   h_m            convective mass-transfer coeff = h0 + k·√v            [m/s]
//                  (natural-convection floor + forced convection ∝ v^0.5,
//                   the laminar flat-plate Sherwood result Sh ∝ Re^0.5)
//   J              flux = h_m·volatility·(C_surface − C_air)         [kg/m²/s]
//   rate/s         J / (ρ·thickness·solventFraction)            = 1 / t_dry
//
// The "how" upgrades are real drying conditions (airflow / humidity / heat), not
// an arbitrary multiplier. Constants below are tuned so a standard emulsion coat
// in still air dries in ~40 min — all are physically plausible and adjustable.

const MW_WATER = 0.018; // kg/mol
const R_GAS = 8.314; // J/(mol·K)
const AMBIENT_C = 20; // surrounding room air temperature
const SOLVENT_DENSITY = 1000; // kg/m³ (water-borne paints)
const H0 = 0.0015; // natural-convection mass-transfer floor [m/s]
const K_CONV = 0.004795; // forced-convection coefficient [m/s per √(m/s)]

/** Per-variant film properties (the "what" axis). */
interface PaintPhysical {
  wetThicknessMicrons: number;
  solventVolumeFraction: number;
  /** Relative solvent volatility vs. water (oil/enamel solvents evaporate slower). */
  volatility: number;
}

const PHYSICAL: Record<string, PaintPhysical> = {
  emulsion: { wetThicknessMicrons: 100, solventVolumeFraction: 0.5, volatility: 1.0 },
  matte: { wetThicknessMicrons: 110, solventVolumeFraction: 0.5, volatility: 0.5 },
  gloss: { wetThicknessMicrons: 150, solventVolumeFraction: 0.55, volatility: 0.2 },
  enamel: { wetThicknessMicrons: 300, solventVolumeFraction: 0.45, volatility: 0.05 },
};

// ─── Variants ("what" axis) ──────────────────────────────────────────────────
// baseDurationSeconds is the still-air reference time (used for validation,
// hard-mode gating, and as the fixed cure time for the reaction-limited enamel).
// Real rate is computed from the physics above for the non-hard paints.

export const VARIANTS: GameVariant[] = [
  { id: "emulsion", label: "Emulsion", emoji: "🪣", baseDurationSeconds: 2400, goldPerCompletion: 8, isHardMode: false },
  { id: "matte", label: "Matte", emoji: "🎨", baseDurationSeconds: 5280, goldPerCompletion: 18, isHardMode: false },
  { id: "gloss", label: "Gloss", emoji: "✨", baseDurationSeconds: 19800, goldPerCompletion: 60, isHardMode: false },
  // Hard mode: a marine enamel that cures by oxidative crosslinking, not just
  // evaporation — reaction-limited, so airflow/heat don't accelerate it. Fixed
  // ~5-day cure (≥ the 2-day hard-mode floor) → 1 💎.
  { id: "enamel", label: "Marine Enamel", emoji: "🛢️", baseDurationSeconds: 432_000, goldPerCompletion: 500, isHardMode: true },
];
// ─────────────────────────────────────────────────────────────────────────────

export interface PaintDryState {
  activeVariantId: string; // "what" axis
  // "how" axis — physical drying conditions, set by the how-* upgrades.
  airVelocity: number; // m/s over the film
  relHumidity: number; // 0..1 ambient
  filmTempC: number; // °C at the film surface
  progress: number; // 0.0 → 1.0
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

// — Physics helpers —
function psatKPa(tempC: number): number {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

function vapourConc(tempC: number, relHumidity: number): number {
  const pPa = relHumidity * psatKPa(tempC) * 1000;
  return (pPa * MW_WATER) / (R_GAS * (tempC + 273.15));
}

/** Evaporative mass flux from the film [kg/m²/s]. */
function evapFlux(state: PaintDryState, phys: PaintPhysical): number {
  const hM = H0 + K_CONV * Math.sqrt(Math.max(0, state.airVelocity));
  const cSurface = vapourConc(state.filmTempC, 1.0); // saturated at the wet surface
  const cAir = vapourConc(AMBIENT_C, state.relHumidity);
  return hM * phys.volatility * Math.max(0, cSurface - cAir);
}

function solventMassPerArea(phys: PaintPhysical): number {
  return SOLVENT_DENSITY * phys.wetThicknessMicrons * 1e-6 * phys.solventVolumeFraction;
}

export function getRatePerSecond(state: PaintDryState): number {
  const variant = getActiveVariant(state);
  // Enamel is reaction-limited, not evaporation-limited: fixed cure time,
  // unaffected by airflow/heat. (Mirrors the hard-mode rule in the other games.)
  if (variant.isHardMode) return 1 / variant.baseDurationSeconds;
  const phys = PHYSICAL[variant.id] ?? PHYSICAL.emulsion;
  return evapFlux(state, phys) / solventMassPerArea(phys);
}

export function getTimeRemainingSeconds(state: PaintDryState): number {
  if (state.isComplete) return 0;
  const rate = getRatePerSecond(state);
  if (rate <= 0) return Infinity;
  return (1 - state.progress) / rate;
}

/** Live physical readout for the UI ("show the math"). */
export function getDryingStats(state: PaintDryState): {
  fluxGramsPerM2PerHour: number;
  filmTempC: number;
  relHumidity: number;
  airVelocity: number;
} {
  const variant = getActiveVariant(state);
  const phys = PHYSICAL[variant.id] ?? PHYSICAL.emulsion;
  const flux = variant.isHardMode ? 0 : evapFlux(state, phys);
  return {
    fluxGramsPerM2PerHour: flux * 1000 * 3600,
    filmTempC: state.filmTempC,
    relHumidity: state.relHumidity,
    airVelocity: state.airVelocity,
  };
}

export function getInitialState(): PaintDryState {
  const still = HOW_CONDITIONS["how-still"];
  return {
    activeVariantId: VARIANTS[0].id,
    airVelocity: still.airVelocity,
    relHumidity: still.relHumidity,
    filmTempC: still.filmTempC,
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
    airVelocity: r.airVelocity ?? defaults.airVelocity,
    relHumidity: r.relHumidity ?? defaults.relHumidity,
    filmTempC: r.filmTempC ?? defaults.filmTempC,
    progress: r.progress ?? 0,
    isComplete: r.isComplete ?? false,
    totalCompletions: r.totalCompletions ?? 0,
    hardModeCompletions: r.hardModeCompletions ?? 0,
    lifetimeGold: r.lifetimeGold ?? 0,
    ownedUpgradeIds: r.ownedUpgradeIds ?? defaults.ownedUpgradeIds,
    lastSaveAt: r.lastSaveAt ?? Date.now(),
  };
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

  // Mark everything up to now as accounted for, so the next hydrate doesn't
  // re-simulate this same window.
  return {
    state: { ...current, lastSaveAt: nowMs },
    offlineGoldEarned: totalGold,
    offlineCrystalsEarned: totalCrystals,
  };
}

// ─── Upgrades ────────────────────────────────────────────────────────────────
// "What" selects the paint film; "how" sets real drying conditions. Buying
// unlocks; selecting an owned tier switches to it. Hard-mode enamel is gated
// behind the top "how" tier so it can't be reached early.

/** Physical conditions each "how" tier applies. Each tier keeps the prior
 *  benefits (a heat lamp run still has the fan on), so the ladder is monotonic. */
const HOW_CONDITIONS: Record<
  string,
  { airVelocity: number; relHumidity: number; filmTempC: number }
> = {
  "how-still": { airVelocity: 0.1, relHumidity: 0.6, filmTempC: 20 },
  "how-fan": { airVelocity: 2.5, relHumidity: 0.6, filmTempC: 20 },
  "how-dehumidifier": { airVelocity: 2.5, relHumidity: 0.2, filmTempC: 20 },
  "how-heatlamp": { airVelocity: 2.5, relHumidity: 0.2, filmTempC: 48 },
};

function selectVariant(s: unknown, id: string): PaintDryState {
  // A fresh coat: starts wet, regardless of whether the prior one had finished.
  return { ...(s as PaintDryState), activeVariantId: id, progress: 0, isComplete: false };
}

function selectCondition(s: unknown, howId: string): PaintDryState {
  const c = HOW_CONDITIONS[howId];
  return { ...(s as PaintDryState), airVelocity: c.airVelocity, relHumidity: c.relHumidity, filmTempC: c.filmTempC };
}

/** The currently-active upgrade id in each radio group ("what" + "how"). */
export function getActiveUpgradeIds(state: PaintDryState): string[] {
  const ids = [`what-${state.activeVariantId}`];
  const how = Object.keys(HOW_CONDITIONS).find((id) => {
    const c = HOW_CONDITIONS[id];
    return c.airVelocity === state.airVelocity && c.relHumidity === state.relHumidity && c.filmTempC === state.filmTempC;
  });
  if (how) ids.push(how);
  return ids;
}

export const PAINT_DRY_UPGRADES: UpgradeDef[] = [
  // — What tree (paint film) —
  {
    id: "what-emulsion",
    group: "what",
    groupLabel: "Paint",
    label: "Emulsion",
    description: "Thin water-based wall paint — dries quick",
    cost: 0,
    maxLevel: 1,
    apply: (s) => selectVariant(s, "emulsion"),
  },
  {
    id: "what-matte",
    group: "what",
    groupLabel: "Paint",
    label: "Matte",
    description: "Flat finish, less volatile, a little more patience",
    cost: 350,
    maxLevel: 1,
    requires: ["what-emulsion"],
    apply: (s) => selectVariant(s, "matte"),
  },
  {
    id: "what-gloss",
    group: "what",
    groupLabel: "Paint",
    label: "Gloss",
    description: "Thick, slow-evaporating, worth more",
    cost: 2000,
    maxLevel: 1,
    requires: ["what-matte"],
    apply: (s) => selectVariant(s, "gloss"),
  },
  {
    id: "what-enamel",
    group: "what",
    groupLabel: "Paint",
    label: "Marine Enamel 💎",
    description: "Thick industrial coat — a ~5-day chemical cure, awards 1 crystal",
    cost: 8000,
    maxLevel: 1,
    requires: ["what-gloss", "how-heatlamp"],
    apply: (s) => selectVariant(s, "enamel"),
  },

  // — How tree (drying conditions) —
  {
    id: "how-still",
    group: "how",
    groupLabel: "Drying Conditions",
    label: "Still Air",
    description: "Just let it sit — 0.1 m/s, 60% RH, 20°C",
    cost: 0,
    maxLevel: 1,
    apply: (s) => selectCondition(s, "how-still"),
  },
  {
    id: "how-fan",
    group: "how",
    groupLabel: "Drying Conditions",
    label: "Box Fan",
    description: "Airflow over the coat — 2.5 m/s",
    cost: 400,
    maxLevel: 1,
    requires: ["how-still"],
    apply: (s) => selectCondition(s, "how-fan"),
  },
  {
    id: "how-dehumidifier",
    group: "how",
    groupLabel: "Drying Conditions",
    label: "Dehumidifier",
    description: "Drier air pulls solvent faster — 20% RH",
    cost: 2500,
    maxLevel: 1,
    requires: ["how-fan"],
    apply: (s) => selectCondition(s, "how-dehumidifier"),
  },
  {
    id: "how-heatlamp",
    group: "how",
    groupLabel: "Drying Conditions",
    label: "Heat Lamp",
    description: "Warm film, higher vapour pressure — 48°C (unlocks enamel)",
    cost: 9000,
    maxLevel: 1,
    requires: ["how-dehumidifier"],
    apply: (s) => selectCondition(s, "how-heatlamp"),
  },
];
