import type { MiniGamePlugin } from "@/engine/types";
import {
  getInitialState,
  hydrateState,
  tick,
  reset,
  VARIANTS,
  PLANT_GROW_UPGRADES,
  type PlantGrowState,
} from "@/games/plant-grow/plantGrowEngine";
import { PlantGrowGame } from "@/games/plant-grow/PlantGrowGame";

// Cranks conditionMultiplier so ryegrass (90s base) grows in ~1s — lets you
// watch the hub card previews and gold sync tick in real time. Dev-only.
const DEV_MULTIPLIER = 100;

function withDevSpeed(state: PlantGrowState): PlantGrowState {
  return { ...state, conditionMultiplier: DEV_MULTIPLIER };
}

const devPlantPlugin: MiniGamePlugin = {
  id: "dev-plant",
  name: "[DEV] Fast Grow",
  description: "Dev tool: plants grow in ~1s for testing",
  version: "0.0.0",
  variants: VARIANTS,

  getInitialState: () => withDevSpeed(getInitialState()),

  hydrateState: (raw) => withDevSpeed(hydrateState(raw)),

  tick: (state, deltaMs) => tick(state as PlantGrowState, deltaMs),
  reset: (state) => withDevSpeed(reset(state as PlantGrowState)),

  Component: PlantGrowGame,
  upgrades: PLANT_GROW_UPGRADES,
};

export default devPlantPlugin;
