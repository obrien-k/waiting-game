import { create } from "zustand";
import type { MiniGamePlugin } from "@/engine/types";
import waterBoilPlugin from "@/games/water-boil";
import devInstantPlugin from "@/games/dev-instant";

const BUILTIN_PLUGINS: MiniGamePlugin[] = [
  waterBoilPlugin,
  ...(import.meta.env.DEV ? [devInstantPlugin] : []),
];

export interface GameRegistryState {
  plugins: Record<string, MiniGamePlugin>;
}

export const useGameRegistry = create<GameRegistryState>(() => ({
  plugins: Object.fromEntries(BUILTIN_PLUGINS.map((p) => [p.id, p])),
}));
