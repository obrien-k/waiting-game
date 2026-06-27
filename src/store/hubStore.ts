import { create } from "zustand";
import { createLedger, addGold, spendGold } from "@/engine/currency";
import { saveHub, loadHub } from "@/engine/saveLoad";
import { onGoldEarned, onCrystalEarned } from "@/engine/eventBus";
import type { GoldLedger, CrystalLedger } from "@/engine/types";

// BroadcastChannel syncs gold across all windows (hub + game pop-outs)
const goldChannel = new BroadcastChannel("waiting-game-gold");

// Built-in games available out of the box. Dev-only games are appended in dev.
// Hydration unions this with saved installs so newly-shipped games always show.
const DEFAULT_INSTALLED_GAME_IDS = import.meta.env.DEV
  ? ["water-boil", "paint-dry", "dev-instant", "dev-paint"]
  : ["water-boil", "paint-dry"];

interface GoldSyncMessage {
  type: "gold-sync";
  gold: GoldLedger;
}

interface CrystalSyncMessage {
  type: "crystal-sync";
  crystals: CrystalLedger;
}

interface HubState {
  gold: GoldLedger;
  crystals: CrystalLedger;
  installedGameIds: string[];
  openWindowIds: Set<string>;
  offlineMessage: string | null;
  hydrated: boolean;

  addGold: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  addCrystal: () => void;
  setWindowOpen: (gameId: string, open: boolean) => void;
  setOfflineMessage: (msg: string | null) => void;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

export const useHubStore = create<HubState>((set, get) => {
  goldChannel.addEventListener("message", (event: MessageEvent<GoldSyncMessage | CrystalSyncMessage>) => {
    if (event.data.type === "gold-sync") set({ gold: event.data.gold });
    if (event.data.type === "crystal-sync") set({ crystals: event.data.crystals });
  });

  function broadcastGold(gold: GoldLedger) {
    goldChannel.postMessage({ type: "gold-sync", gold } satisfies GoldSyncMessage);
  }

  function broadcastCrystals(crystals: CrystalLedger) {
    goldChannel.postMessage({ type: "crystal-sync", crystals } satisfies CrystalSyncMessage);
  }

  return {
    gold: createLedger(),
    crystals: { count: 0 },
    installedGameIds: DEFAULT_INSTALLED_GAME_IDS,
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

    addCrystal() {
      const next: CrystalLedger = { count: get().crystals.count + 1 };
      set({ crystals: next });
      broadcastCrystals(next);
      get().persist();
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
        const saved = await loadHub<{
          gold: GoldLedger;
          crystals: CrystalLedger;
          installedGameIds: string[];
        }>();
        if (saved) {
          // Union so games shipped after this save was written still appear.
          const installedGameIds = Array.from(
            new Set([...(saved.installedGameIds ?? []), ...DEFAULT_INSTALLED_GAME_IDS])
          );
          set({
            gold: saved.gold ?? createLedger(),
            crystals: saved.crystals ?? { count: 0 },
            installedGameIds,
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
      const { gold, crystals, installedGameIds } = get();
      await saveHub({ gold, crystals, installedGameIds });
    },
  };
});

let listenersStarted = false;

export async function startGoldListener() {
  if (listenersStarted) return;
  listenersStarted = true;
  await onGoldEarned(({ amount }) => useHubStore.getState().addGold(amount));
  await onCrystalEarned(() => useHubStore.getState().addCrystal());
}
