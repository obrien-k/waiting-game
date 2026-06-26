// Change `id` and `name`. Both must be unique. See README.md for full instructions.

import type { MiniGamePlugin } from "@/engine/types";
import { assertPlugin } from "@/engine/pluginValidation";
import {
  getInitialState,
  hydrateState,
  tick,
  reset,
  calculateOfflineProgress,
  VARIANTS,
  TEMPLATE_UPGRADES,
  type TemplateState,
} from "./engine";
import { TemplateGame } from "./Game";
import { TemplateCardThumbnail } from "./CardThumbnail";
import { emitGoldEarned, emitCrystalEarned, emitOfflineMessage } from "@/engine/eventBus";
import { formatGold } from "@/engine/currency";

const templatePlugin: MiniGamePlugin = {
  id: "my-game",           // ← change this (must match gameRegistry + hubStore)
  name: "My Waiting Game", // ← change this
  description: "Something worth waiting for",
  version: "1.0.0",
  variants: VARIANTS,

  getInitialState,

  hydrateState(raw) {
    const base = hydrateState(raw);
    const { state: progressed, offlineGoldEarned, offlineCrystalsEarned } =
      calculateOfflineProgress(base, Date.now());

    if (offlineGoldEarned > 0 || offlineCrystalsEarned > 0) {
      Promise.resolve().then(() => {
        if (offlineGoldEarned > 0) emitGoldEarned(this.id, offlineGoldEarned);
        if (offlineCrystalsEarned > 0) emitCrystalEarned(this.id);
        const crystalNote = offlineCrystalsEarned > 0 ? ` +${offlineCrystalsEarned} 💎` : "";
        emitOfflineMessage(
          `◈ ${formatGold(offlineGoldEarned)} earned while you were away!${crystalNote}`
        );
      });
    }

    return progressed;
  },

  tick: (state, deltaMs) => tick(state as TemplateState, deltaMs),
  reset: (state) => reset(state as TemplateState),

  Component: TemplateGame,
  CardThumbnail: TemplateCardThumbnail,
  upgrades: TEMPLATE_UPGRADES,
};

assertPlugin(templatePlugin);

export default templatePlugin;
