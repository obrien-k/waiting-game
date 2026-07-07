import type { MiniGamePlugin } from "@/engine/types";
import { assertPlugin } from "@/engine/pluginValidation";
import {
  getInitialState,
  hydrateState,
  tick,
  reset,
  calculateOfflineProgress,
  VARIANTS,
  PAINT_DRY_UPGRADES,
  type PaintDryState,
} from "./paintDryEngine";
import { PaintDryGame } from "./PaintDryGame";
import { PaintDryCardThumbnail } from "./CardThumbnail";
import { emitGoldEarned, emitCrystalEarned, emitOfflineMessage } from "@/engine/eventBus";
import { formatGold } from "@/engine/currency";

const paintDryPlugin: MiniGamePlugin = {
  id: "paint-dry",
  name: "Waiting for Paint to Dry",
  description: "Like watching paint dry — four finishes, four kinds of patience.",
  version: "1.0.0",
  variants: VARIANTS,

  getInitialState,

  hydrateState(raw) {
    const base = hydrateState(raw);
    const { state: progressed, offlineGoldEarned, offlineCrystalsEarned } =
      calculateOfflineProgress(base, Date.now());

    if (offlineGoldEarned > 0 || offlineCrystalsEarned > 0) {
      Promise.resolve().then(() => {
        if (offlineGoldEarned > 0) emitGoldEarned("paint-dry", offlineGoldEarned);
        if (offlineCrystalsEarned > 0) emitCrystalEarned("paint-dry");
        const crystalNote = offlineCrystalsEarned > 0 ? ` +${offlineCrystalsEarned} 💎` : "";
        emitOfflineMessage(
          `Your paint dried to ◈ ${formatGold(offlineGoldEarned)} while you were away!${crystalNote}`
        );
      });
    }

    return progressed;
  },

  tick: (state, deltaMs) => tick(state as PaintDryState, deltaMs),
  reset: (state) => reset(state as PaintDryState),

  Component: PaintDryGame,
  CardThumbnail: PaintDryCardThumbnail,
  upgrades: PAINT_DRY_UPGRADES,
};

assertPlugin(paintDryPlugin);

export default paintDryPlugin;
