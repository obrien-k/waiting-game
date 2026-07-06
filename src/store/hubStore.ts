import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createLedger } from "@/engine/currency";
import { onGoldEarned, onCrystalEarned, onArtifactEarned } from "@/engine/eventBus";
import { deleteSave } from "@/engine/saveLoad";
import { useGameRegistry } from "@/store/gameRegistry";
import type { GoldLedger, CrystalLedger, ArtifactLedger } from "@/engine/types";

const EMPTY_ARTIFACT_LEDGER: ArtifactLedger = { entries: {} };

// Built-in games available out of the box. Dev-only games are appended in dev.
// Hydration unions this with saved installs so newly-shipped games always show.
const DEFAULT_INSTALLED_GAME_IDS = import.meta.env.DEV
  ? ["water-boil", "paint-dry", "plant-grow", "amusement-park", "dev-instant", "dev-paint", "dev-plant", "dev-sandbox"]
  : ["water-boil", "paint-dry", "plant-grow", "amusement-park"];

interface HubStateData {
  gold: GoldLedger;
  crystals: CrystalLedger;
  artifacts: ArtifactLedger;
  installedGameIds: string[];
  unlockedGameIds: string[];
}

interface HubState {
  gold: GoldLedger;
  crystals: CrystalLedger;
  artifacts: ArtifactLedger;
  installedGameIds: string[];
  unlockedGameIds: Set<string>;
  openWindowIds: Set<string>;
  offlineMessage: string | null;
  hydrated: boolean;

  addGold: (amount: number) => Promise<void>;
  spendGold: (amount: number) => Promise<boolean>;
  addCrystal: () => Promise<void>;
  addArtifact: (artifactId: string, count: number) => Promise<void>;
  unlockGame: (gameId: string, cost: number) => Promise<boolean>;
  setWindowOpen: (gameId: string, open: boolean) => void;
  setOfflineMessage: (msg: string | null) => void;
  hydrate: () => Promise<void>;
  /** Dev-only: wipes hub state (gold/crystals/unlocks) and every game's save file. */
  resetAllProgress: () => Promise<void>;
}

export const useHubStore = create<HubState>((set) => {
  return {
    gold: createLedger(),
    crystals: { count: 0 },
    artifacts: EMPTY_ARTIFACT_LEDGER,
    installedGameIds: DEFAULT_INSTALLED_GAME_IDS,
    unlockedGameIds: new Set(),
    openWindowIds: new Set(),
    offlineMessage: null,
    hydrated: false,

    async addGold(amount) {
      const nextState = await invoke<HubStateData>("add_gold", { amount });
      set({ gold: nextState.gold });
    },

    async spendGold(amount) {
      try {
        const nextState = await invoke<HubStateData>("spend_gold", { amount });
        set({ gold: nextState.gold });
        return true;
      } catch {
        return false;
      }
    },

    async addCrystal() {
      const nextState = await invoke<HubStateData>("add_crystal");
      set({ crystals: nextState.crystals });
    },

    async addArtifact(artifactId, count) {
      const nextState = await invoke<HubStateData>("add_artifact", { artifactId, count });
      set({ artifacts: nextState.artifacts ?? EMPTY_ARTIFACT_LEDGER });
    },

    async unlockGame(gameId, cost) {
      try {
        const nextState = await invoke<HubStateData>("unlock_game", { gameId, cost });
        set({ gold: nextState.gold, unlockedGameIds: new Set(nextState.unlockedGameIds ?? []) });
        return true;
      } catch {
        return false;
      }
    },

    setWindowOpen(gameId, open) {
      set((s) => {
        const next = new Set(s.openWindowIds);
        open ? next.add(gameId) : next.delete(gameId);
        return { openWindowIds: next };
      });
    },

    setOfflineMessage(msg) {
      set({ offlineMessage: msg });
    },

    async hydrate() {
      try {
        const saved = await invoke<HubStateData>("hydrate_hub_state");
        const installedGameIds = Array.from(
          new Set([...(saved.installedGameIds ?? []), ...DEFAULT_INSTALLED_GAME_IDS])
        );
        // Sync any new game IDs to backend
        if (installedGameIds.length > (saved.installedGameIds?.length ?? 0)) {
           await invoke("set_installed_games", { gameIds: installedGameIds });
        }
        
        set({
          gold: saved.gold ?? createLedger(),
          crystals: saved.crystals ?? { count: 0 },
          artifacts: saved.artifacts ?? EMPTY_ARTIFACT_LEDGER,
          installedGameIds,
          unlockedGameIds: new Set(saved.unlockedGameIds ?? []),
          hydrated: true,
        });
      } catch (e) {
        console.error("Hydration failed", e);
        set({ hydrated: true });
      }
    },

    async resetAllProgress() {
      const gameIds = Object.keys(useGameRegistry.getState().plugins);
      await Promise.all(gameIds.map((id) => deleteSave(id)));
      const nextState = await invoke<HubStateData>("reset_hub_state");
      set({
        gold: nextState.gold,
        crystals: nextState.crystals,
        artifacts: nextState.artifacts ?? EMPTY_ARTIFACT_LEDGER,
        unlockedGameIds: new Set(nextState.unlockedGameIds ?? []),
      });
    }
  };
});

let stateSyncStarted = false;
let creditListenersStarted = false;

// Read-only sync of Rust-owned hub state into this window's store. Safe in any
// window — it only mirrors balances, it never credits. Every window that shows
// gold (including game pop-outs) must call this, or its balance freezes at the
// value it read on mount.
export async function startHubStateSync() {
  if (stateSyncStarted) return;
  stateSyncStarted = true;

  await listen<HubStateData>("hub-state-updated", (event) => {
    useHubStore.setState({
      gold: event.payload.gold,
      crystals: event.payload.crystals,
      artifacts: event.payload.artifacts ?? EMPTY_ARTIFACT_LEDGER,
      installedGameIds: event.payload.installedGameIds,
      unlockedGameIds: new Set(event.payload.unlockedGameIds ?? []),
    });
  });
}

// Hub-only: credits gold/crystals earned by game windows. Must run in exactly
// one window — game windows emit `gold-earned`, and if they also listened here
// each earning would be credited twice.
export async function startGoldListener() {
  await startHubStateSync();

  if (creditListenersStarted) return;
  creditListenersStarted = true;

  await onGoldEarned(async ({ amount }) => await useHubStore.getState().addGold(amount));
  await onCrystalEarned(async () => await useHubStore.getState().addCrystal());
  await onArtifactEarned(
    async ({ artifactId, count }) => await useHubStore.getState().addArtifact(artifactId, count)
  );
}
