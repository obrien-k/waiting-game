import type { MiniGamePlugin } from "@/engine/types";
import { assertPlugin } from "@/engine/pluginValidation";
import {
  getInitialState,
  hydrateState,
  tick,
  reset,
  WATER_BOIL_UPGRADES,
  calculateOfflineProgress,
  type WaterBoilState,
} from "./waterBoilEngine";
import { WaterBoilGame } from "./WaterBoilGame";
import { CardThumbnail } from "./CardThumbnail";
import { emitGoldEarned, emitOfflineMessage } from "@/engine/eventBus";
import { formatGold } from "@/engine/currency";

const waterBoilPlugin: MiniGamePlugin = {
  id: "water-boil",
  name: "Waiting for Water to Boil",
  description: "A watched pot never boils. (It does — physics insists.)",
  version: "1.0.0",

  getInitialState,

  hydrateState(raw) {
    const base = hydrateState(raw);
    const { state: progressed, offlineGoldEarned } = calculateOfflineProgress(
      base,
      Date.now()
    );

    if (offlineGoldEarned > 0) {
      // Fire-and-forget: emit events to hub window after hydration
      Promise.resolve().then(() => {
        emitGoldEarned("water-boil", offlineGoldEarned);
        emitOfflineMessage(
          `Your kettle earned ◈ ${formatGold(offlineGoldEarned)} while you were away!`
        );
      });
    }

    return progressed;
  },

  tick(state, deltaMs) {
    return tick(state as WaterBoilState, deltaMs);
  },

  reset(state) {
    return reset(state as WaterBoilState);
  },

  Component: WaterBoilGame,
  CardThumbnail,
  upgrades: WATER_BOIL_UPGRADES,
};

assertPlugin(waterBoilPlugin);

export default waterBoilPlugin;
