import { create } from "zustand";
import type { MiniGamePlugin } from "@/engine/types";
import waterBoilPlugin from "@/games/water-boil";
import paintDryPlugin from "@/games/paint-dry";
import plantGrowPlugin from "@/games/plant-grow";
import devInstantPlugin from "@/games/dev-instant";
import devPaintPlugin from "@/games/dev-paint";
import devPlantPlugin from "@/games/dev-plant";

const BUILTIN_PLUGINS: MiniGamePlugin[] = [
  waterBoilPlugin,
  paintDryPlugin,
  plantGrowPlugin,
  ...(import.meta.env.DEV ? [devInstantPlugin, devPaintPlugin, devPlantPlugin] : []),
];

export interface GameRegistryState {
  plugins: Record<string, MiniGamePlugin>;
}

export const useGameRegistry = create<GameRegistryState>(() => ({
  plugins: Object.fromEntries(BUILTIN_PLUGINS.map((p) => [p.id, p])),
}));
