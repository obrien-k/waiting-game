import { create } from "zustand";
import type { MiniGamePlugin } from "@/engine/types";
import waterBoilPlugin from "@/games/water-boil";
import paintDryPlugin from "@/games/paint-dry";
import plantGrowPlugin from "@/games/plant-grow";
import devInstantPlugin from "@/games/dev-instant";
import devPaintPlugin from "@/games/dev-paint";
import devPlantPlugin from "@/games/dev-plant";
import amusementParkPlugin from "@/games/amusement-park";

const BUILTIN_PLUGINS: MiniGamePlugin[] = [
  waterBoilPlugin,
  paintDryPlugin,
  plantGrowPlugin,
  amusementParkPlugin,
  ...(import.meta.env.DEV ? [devInstantPlugin, devPaintPlugin, devPlantPlugin] : []),
];

// Gold cost to unlock a game's card on the hub. 0 = always unlocked.
// water-boil is the free starter; dev-only games never gate behind gold.
export const UNLOCK_COSTS: Record<string, number> = {
  "water-boil": 0,
  "plant-grow": 1000,
  "paint-dry": 5000,
  "amusement-park": 15000,
  "dev-instant": 0,
  "dev-paint": 0,
  "dev-plant": 0,
};

export interface GameRegistryState {
  plugins: Record<string, MiniGamePlugin>;
}

export const useGameRegistry = create<GameRegistryState>(() => ({
  plugins: Object.fromEntries(BUILTIN_PLUGINS.map((p) => [p.id, p])),
}));
