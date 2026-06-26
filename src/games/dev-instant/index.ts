import type { MiniGamePlugin } from "@/engine/types";
import {
  tick,
  reset,
  hydrateState,
  WATER_BOIL_UPGRADES,
  type WaterBoilState,
} from "@/games/water-boil/waterBoilEngine";
import { WaterBoilGame } from "@/games/water-boil/WaterBoilGame";

// 50,000W heater → 0.5L pot boils in ~3 seconds. Only registered in dev mode.
const DEV_WATTS = 50_000;

function devInitialState(): WaterBoilState {
  return {
    currentTemp: 20,
    isBoiling: false,
    totalBoils: 0,
    potVolumeLiters: 0.5,
    heaterWatts: DEV_WATTS,
    ownedUpgradeIds: ["pot-small", "heat-candle"],
    lastSaveAt: Date.now(),
  };
}

const devInstantPlugin: MiniGamePlugin = {
  id: "dev-instant",
  name: "[DEV] Fast Boil",
  description: "Dev tool: boils in ~3s for testing",
  version: "0.0.0",

  getInitialState: devInitialState,

  hydrateState(raw) {
    const base = hydrateState(raw);
    return { ...base, heaterWatts: DEV_WATTS };
  },

  tick(state, deltaMs) {
    return tick(state as WaterBoilState, deltaMs);
  },

  reset(state) {
    return { ...reset(state as WaterBoilState), heaterWatts: DEV_WATTS };
  },

  Component: WaterBoilGame,
  upgrades: WATER_BOIL_UPGRADES,
};

export default devInstantPlugin;
