import type { MiniGamePlugin } from "@/engine/types";
import {
  getInitialState,
  hydrateState,
  tick,
  reset,
  VARIANTS,
  PAINT_DRY_UPGRADES,
  type PaintDryState,
} from "@/games/paint-dry/paintDryEngine";
import { PaintDryGame } from "@/games/paint-dry/PaintDryGame";

// Cranks conditionMultiplier so emulsion (120s base) dries in ~1s — lets you
// watch the hub card previews and gold sync tick in real time. Dev-only.
const DEV_MULTIPLIER = 100;

function withDevSpeed(state: PaintDryState): PaintDryState {
  return { ...state, conditionMultiplier: DEV_MULTIPLIER };
}

const devPaintPlugin: MiniGamePlugin = {
  id: "dev-paint",
  name: "[DEV] Fast Paint",
  description: "Dev tool: paint dries in ~1s for testing",
  version: "0.0.0",
  variants: VARIANTS,

  getInitialState: () => withDevSpeed(getInitialState()),

  hydrateState: (raw) => withDevSpeed(hydrateState(raw)),

  tick: (state, deltaMs) => tick(state as PaintDryState, deltaMs),
  reset: (state) => withDevSpeed(reset(state as PaintDryState)),

  Component: PaintDryGame,
  upgrades: PAINT_DRY_UPGRADES,
};

export default devPaintPlugin;
