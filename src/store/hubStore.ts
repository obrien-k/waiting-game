import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createLedger } from "@/engine/currency";
import { onGoldEarned, onCrystalEarned } from "@/engine/eventBus";
import type { GoldLedger, CrystalLedger } from "@/engine/types";

// Built-in games available out of the box. Dev-only games are appended in dev.
// Hydration unions this with saved installs so newly-shipped games always show.
const DEFAULT_INSTALLED_GAME_IDS = import.meta.env.DEV
  ? ["water-boil", "paint-dry", "plant-grow", "amusement-park", "dev-instant", "dev-paint", "dev-plant"]
  : ["water-boil", "paint-dry", "plant-grow", "amusement-park"];

interface HubStateData {
  gold: GoldLedger;
  crystals: CrystalLedger;
  installedGameIds: string[];
}

interface HubState {
  gold: GoldLedger;
  crystals: CrystalLedger;
  installedGameIds: string[];
  openWindowIds: Set<string>;
  offlineMessage: string | null;
  hydrated: boolean;

  addGold: (amount: number) => Promise<void>;
  spendGold: (amount: number) => Promise<boolean>;
  addCrystal: () => Promise<void>;
  setWindowOpen: (gameId: string, open: boolean) => void;
  setOfflineMessage: (msg: string | null) => void;
  hydrate: () => Promise<void>;
}

export const useHubStore = create<HubState>((set) => {
  return {
    gold: createLedger(),
    crystals: { count: 0 },
    installedGameIds: DEFAULT_INSTALLED_GAME_IDS,
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
          installedGameIds,
          hydrated: true,
        });
      } catch (e) {
        console.error("Hydration failed", e);
        set({ hydrated: true });
      }
    }
  };
});

let listenersStarted = false;

export async function startGoldListener() {
  if (listenersStarted) return;
  listenersStarted = true;
  
  // Listen for Rust backend state updates
  await listen<HubStateData>("hub-state-updated", (event) => {
    useHubStore.setState({
      gold: event.payload.gold,
      crystals: event.payload.crystals,
      installedGameIds: event.payload.installedGameIds,
    });
  });

  await onGoldEarned(async ({ amount }) => await useHubStore.getState().addGold(amount));
  await onCrystalEarned(async () => await useHubStore.getState().addCrystal());
}
