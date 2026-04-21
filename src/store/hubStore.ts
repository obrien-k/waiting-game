import { create } from "zustand";
import { createLedger, addGold, spendGold } from "@/engine/currency";
import { saveHub, loadHub } from "@/engine/saveLoad";
import { onGoldEarned } from "@/engine/eventBus";
import type { GoldLedger } from "@/engine/types";

// BroadcastChannel syncs gold across all windows (hub + game pop-outs)
const goldChannel = new BroadcastChannel("waiting-game-gold");

interface GoldSyncMessage {
  type: "gold-sync";
  gold: GoldLedger;
}

interface HubState {
  gold: GoldLedger;
  installedGameIds: string[];
  openWindowIds: Set<string>;
  offlineMessage: string | null;
  hydrated: boolean;

  addGold: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  setWindowOpen: (gameId: string, open: boolean) => void;
  setOfflineMessage: (msg: string | null) => void;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

export const useHubStore = create<HubState>((set, get) => {
  // Listen for gold changes from other windows
  goldChannel.addEventListener("message", (event: MessageEvent<GoldSyncMessage>) => {
    if (event.data.type === "gold-sync") {
      set({ gold: event.data.gold });
    }
  });

  function broadcastGold(gold: GoldLedger) {
    goldChannel.postMessage({ type: "gold-sync", gold } satisfies GoldSyncMessage);
  }

  return {
    gold: createLedger(),
    installedGameIds: ["water-boil"],
    openWindowIds: new Set(),
    offlineMessage: null,
    hydrated: false,

    addGold(amount) {
      const next = addGold(get().gold, amount);
      set({ gold: next });
      broadcastGold(next);
      get().persist();
    },

    spendGold(amount) {
      const next = spendGold(get().gold, amount);
      if (!next) return false;
      set({ gold: next });
      broadcastGold(next);
      get().persist();
      return true;
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
        const saved = await loadHub<{ gold: GoldLedger; installedGameIds: string[] }>();
        if (saved) {
          set({
            gold: saved.gold ?? createLedger(),
            installedGameIds: saved.installedGameIds ?? ["water-boil"],
            hydrated: true,
          });
        } else {
          set({ hydrated: true });
        }
      } catch {
        set({ hydrated: true });
      }
    },

    async persist() {
      const { gold, installedGameIds } = get();
      await saveHub({ gold, installedGameIds });
    },
  };
});

let goldListenerStarted = false;

export async function startGoldListener() {
  if (goldListenerStarted) return;
  goldListenerStarted = true;
  await onGoldEarned(({ amount }) => {
    useHubStore.getState().addGold(amount);
  });
}
