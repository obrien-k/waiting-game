import type { ArtifactCatalogEntry, MiniGamePlugin } from "@/engine/types";
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
import {
  emitGoldEarned,
  emitCrystalEarned,
  emitOfflineMessage,
  emitArtifactEarned,
} from "@/engine/eventBus";
import { formatGold } from "@/engine/currency";

// One flora collectible per species. Keys are fully-qualified so the hub can
// merge catalogs across games. Descriptions mirror each variant's flavor.
const ARTIFACT_CATALOG: ArtifactCatalogEntry[] = VARIANTS.map((v) => ({
  id: `plant-grow:${v.id}`,
  gameId: "plant-grow",
  category: "flora",
  name: v.label,
  emoji: v.emoji ?? "🌱",
  description: `A fully grown ${v.label.toLowerCase()}.`,
}));

const plantGrowPlugin: MiniGamePlugin = {
  id: "plant-grow",
  name: "Waiting for a Plant to Grow",
  description: "Like watching grass grow — from ryegrass to a two-day oak.",
  version: "1.0.0",
  variants: VARIANTS,

  getInitialState,

  hydrateState(raw) {
    const base = hydrateState(raw);
    const { state: progressed, offlineGoldEarned, offlineCrystalsEarned, offlineArtifacts } =
      calculateOfflineProgress(base, Date.now());

    const offlineArtifactEntries = Object.entries(offlineArtifacts);
    if (offlineGoldEarned > 0 || offlineCrystalsEarned > 0 || offlineArtifactEntries.length > 0) {
      Promise.resolve().then(() => {
        if (offlineGoldEarned > 0) emitGoldEarned("plant-grow", offlineGoldEarned);
        if (offlineCrystalsEarned > 0) emitCrystalEarned("plant-grow");
        // Batched: one emit per artifact type, not one per completion, so a long
        // offline window doesn't fire thousands of events.
        for (const [bareId, count] of offlineArtifactEntries) {
          emitArtifactEarned("plant-grow", `plant-grow:${bareId}`, count);
        }
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
  artifactCatalog: ARTIFACT_CATALOG,
};

assertPlugin(plantGrowPlugin);

export default plantGrowPlugin;
