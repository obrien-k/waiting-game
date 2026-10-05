import type { MiniGamePlugin } from "@/engine/types";
import { assertPlugin } from "@/engine/pluginValidation";
import {
  getInitialState,
  hydrateState,
  tick,
  reset,
  GROCERY_LINE_UPGRADES,
  type GroceryLineState,
} from "./groceryLineEngine";
import { GroceryLineGame } from "./GroceryLineGame";
import { CardThumbnail } from "./CardThumbnail";
import { emitGoldEarned, emitOfflineMessage } from "@/engine/eventBus";
import { formatGold } from "@/engine/currency";

// The id predates the grocery re-theme and is frozen (ADR 0003): it keys
// saves, the unlock cost, and the artifact namespace. Don't rename it.
const PLUGIN_ID = "amusement-park";

const groceryLinePlugin: MiniGamePlugin = {
  id: PLUGIN_ID,
  name: "Waiting in Line",
  description: "The other line always moves faster. (Pareto says it might.)",
  version: "2.0.0",

  getInitialState,

  async hydrateState(raw) {
    const hydrated = await hydrateState(raw);
    const gold = hydrated.pendingOfflineGold ?? 0;
    if (gold > 0) {
      Promise.resolve().then(() => {
        emitGoldEarned(PLUGIN_ID, gold);
        emitOfflineMessage(`Your checkout lane earned ◈ ${formatGold(gold)} while you were away!`);
      });
      return { ...hydrated, pendingOfflineGold: 0 };
    }
    return hydrated;
  },

  tick(state, deltaMs) {
    return tick(state as GroceryLineState, deltaMs);
  },

  reset(state) {
    return reset(state as GroceryLineState);
  },

  Component: GroceryLineGame,
  CardThumbnail,
  upgrades: GROCERY_LINE_UPGRADES,
};

assertPlugin(groceryLinePlugin);

export default groceryLinePlugin;
