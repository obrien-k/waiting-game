import type { MiniGamePlugin } from "@/engine/types";
import { assertPlugin } from "@/engine/pluginValidation";
import {
  getInitialState,
  hydrateState,
  tick,
  reset,
  AMUSEMENT_PARK_UPGRADES,
  type AmusementParkState,
} from "./AmusementParkEngine";
import { AmusementParkGame } from "./AmusementParkGame";
import { CardThumbnail } from "./CardThumbnail";
import { emitGoldEarned, emitOfflineMessage } from "@/engine/eventBus";
import { formatGold } from "@/engine/currency";

const amusementParkPlugin: MiniGamePlugin = {
  id: "amusement-park",
  name: "Waiting in Line",
  description: "The other line always moves faster. Manage rides, heat, and crowds.",
  version: "1.0.0",

  getInitialState,

  async hydrateState(raw) {
    const hydrated = await hydrateState(raw);

    if (hydrated.pendingOfflineGold && hydrated.pendingOfflineGold > 0) {
      const gold = hydrated.pendingOfflineGold;
      // Fire-and-forget after hydration settles
      Promise.resolve().then(() => {
        emitGoldEarned("amusement-park", gold);
        emitOfflineMessage(
          `Your park earned ◈ ${formatGold(gold)} while you were away!`
        );
      });
      // Clear the pending amount so it doesn't re-trigger
      return { ...hydrated, pendingOfflineGold: 0 };
    }

    return hydrated;
  },

  tick(state, deltaMs) {
    return tick(state as AmusementParkState, deltaMs);
  },

  reset(state) {
    return reset(state as AmusementParkState);
  },

  Component: AmusementParkGame,
  CardThumbnail,
  upgrades: AMUSEMENT_PARK_UPGRADES,
};

assertPlugin(amusementParkPlugin);

export default amusementParkPlugin;
