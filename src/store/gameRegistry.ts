import { create } from "zustand";
import type { MiniGamePlugin } from "@/engine/types";
import waterBoilPlugin from "@/games/water-boil";

const BUILTIN_PLUGINS: MiniGamePlugin[] = [waterBoilPlugin];

export interface GameRegistryState {
  plugins: Record<string, MiniGamePlugin>;
}

export const useGameRegistry = create<GameRegistryState>(() => ({
  plugins: Object.fromEntries(BUILTIN_PLUGINS.map((p) => [p.id, p])),
}));
