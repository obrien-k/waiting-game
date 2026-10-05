import { create } from "zustand";
import type { RegisteredPlugin } from "@/engine/pluginTrust";
import waterBoilPlugin from "@/games/water-boil";
import paintDryPlugin from "@/games/paint-dry";
import plantGrowPlugin from "@/games/plant-grow";
import devInstantPlugin from "@/games/dev-instant";
import devPaintPlugin from "@/games/dev-paint";
import devPlantPlugin from "@/games/dev-plant";
import devSandboxPlugin from "@/games/dev-sandbox";
import groceryLinePlugin from "@/games/grocery-line";

// Native (Tier-1) built-ins plus, in dev, the Tier-2 iframe fixture. When the
// workshop loader ships (issue #3) it will append parsed `ExternalPlugin`s here.
const BUILTIN_PLUGINS: RegisteredPlugin[] = [
  waterBoilPlugin,
  paintDryPlugin,
  plantGrowPlugin,
  groceryLinePlugin,
  ...(import.meta.env.DEV
    ? [devInstantPlugin, devPaintPlugin, devPlantPlugin, devSandboxPlugin]
    : []),
];

// Gold cost to unlock a game's card on the hub. 0 = always unlocked.
// water-boil is the free starter; dev-only games never gate behind gold.
export const UNLOCK_COSTS: Record<string, number> = {
  "water-boil": 0,
  "plant-grow": 1000,
  "paint-dry": 5000,
  "amusement-park": 15000, // Waiting in Line (grocery-line); id frozen
  "dev-instant": 0,
  "dev-paint": 0,
  "dev-plant": 0,
  "dev-sandbox": 0,
};

export interface GameRegistryState {
  plugins: Record<string, RegisteredPlugin>;
}

export const useGameRegistry = create<GameRegistryState>(() => ({
  plugins: Object.fromEntries(BUILTIN_PLUGINS.map((p) => [p.id, p])),
}));
