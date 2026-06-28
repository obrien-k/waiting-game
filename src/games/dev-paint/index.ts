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

// Cranks the physical drying conditions (blast-furnace heat, gale-force airflow,
// bone-dry air) so emulsion dries in ~1s — lets you watch the hub card previews
// and gold sync tick in real time. Dev-only.
function withDevSpeed(state: PaintDryState): PaintDryState {
  return { ...state, airVelocity: 1000, relHumidity: 0, filmTempC: 95 };
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
