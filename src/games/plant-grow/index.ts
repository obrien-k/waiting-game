import type { MiniGamePlugin } from "@/engine/types";
import { assertPlugin } from "@/engine/pluginValidation";
import {
  getInitialState,
  hydrateState,
  tick,
  reset,
  calculateOfflineProgress,
  VARIANTS,
  PLANT_GROW_UPGRADES,
  type PlantGrowState,
} from "./plantGrowEngine";
import { PlantGrowGame } from "./PlantGrowGame";
import { PlantGrowCardThumbnail } from "./CardThumbnail";
import { emitGoldEarned, emitCrystalEarned, emitOfflineMessage } from "@/engine/eventBus";
import { formatGold } from "@/engine/currency";

const plantGrowPlugin: MiniGamePlugin = {
  id: "plant-grow",
  name: "Watching a Plant Grow",
  description: "From ryegrass to a two-day oak",
  version: "1.0.0",
  variants: VARIANTS,

  getInitialState,

  hydrateState(raw) {
    const base = hydrateState(raw);
    const { state: progressed, offlineGoldEarned, offlineCrystalsEarned } =
      calculateOfflineProgress(base, Date.now());

    if (offlineGoldEarned > 0 || offlineCrystalsEarned > 0) {
      Promise.resolve().then(() => {
        if (offlineGoldEarned > 0) emitGoldEarned("plant-grow", offlineGoldEarned);
        if (offlineCrystalsEarned > 0) emitCrystalEarned("plant-grow");
        const crystalNote = offlineCrystalsEarned > 0 ? ` +${offlineCrystalsEarned} 💎` : "";
        emitOfflineMessage(
          `Your garden grew ◈ ${formatGold(offlineGoldEarned)} while you were away!${crystalNote}`
        );
      });
    }

    return progressed;
  },

  tick: (state, deltaMs) => tick(state as PlantGrowState, deltaMs),
  reset: (state) => reset(state as PlantGrowState),

  Component: PlantGrowGame,
  CardThumbnail: PlantGrowCardThumbnail,
  upgrades: PLANT_GROW_UPGRADES,
};

assertPlugin(plantGrowPlugin);

export default plantGrowPlugin;
