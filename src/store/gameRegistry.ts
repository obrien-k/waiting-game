import { create } from "zustand";
import type { MiniGamePlugin } from "@/engine/types";
import waterBoilPlugin from "@/games/water-boil";
import paintDryPlugin from "@/games/paint-dry";
import devInstantPlugin from "@/games/dev-instant";
import devPaintPlugin from "@/games/dev-paint";

const BUILTIN_PLUGINS: MiniGamePlugin[] = [
  waterBoilPlugin,
  paintDryPlugin,
  ...(import.meta.env.DEV ? [devInstantPlugin, devPaintPlugin] : []),
];

export interface GameRegistryState {
  plugins: Record<string, MiniGamePlugin>;
}

export const useGameRegistry = create<GameRegistryState>(() => ({
  plugins: Object.fromEntries(BUILTIN_PLUGINS.map((p) => [p.id, p])),
}));
