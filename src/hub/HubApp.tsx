import { useEffect, useState } from "react";
import { useHubStore, startGoldListener } from "@/store/hubStore";
import { useGameRegistry, type GameRegistryState } from "@/store/gameRegistry";
import { onOfflineMessage, onWindowClosed } from "@/engine/eventBus";
import { listOpenGameIds } from "@/engine/windowManager";
import { InlineGameShell } from "@/game-window/InlineGameShell";
import { GameGrid } from "./GameGrid";
import { Garden } from "./Garden";
import { GoldDisplay } from "@/components/GoldDisplay";
import { CrystalDisplay } from "@/components/CrystalDisplay";

export function HubApp() {
  const hydrate = useHubStore((s) => s.hydrate);
  const hydrated = useHubStore((s) => s.hydrated);
  const offlineMessage = useHubStore((s) => s.offlineMessage);
  const setOfflineMessage = useHubStore((s) => s.setOfflineMessage);
  const setWindowOpen = useHubStore((s) => s.setWindowOpen);
  const resetAllProgress = useHubStore((s) => s.resetAllProgress);

  async function handleResetAllProgress() {
    if (!window.confirm("Reset all progress? This wipes gold, crystals, unlocks, and every game's save file.")) return;
    await resetAllProgress();
    window.location.reload();
  }

  const [focusedGameId, setFocusedGameId] = useState<string | null>(null);
  const focusedPlugin = useGameRegistry(
    (s: GameRegistryState) => focusedGameId ? s.plugins[focusedGameId] : null
  );

  useEffect(() => {
    hydrate();
    startGoldListener();
    // Reconcile the in-memory open-window set with reality. After a hub reload
    // it resets to empty, which would re-enable focus for a still-open pop-out
    // and let two shells race on the same save.
    listOpenGameIds().then((ids) => ids.forEach((id) => setWindowOpen(id, true)));
    let cleanupOffline: (() => void) | null = null;
    let cleanupClosed: (() => void) | null = null;
    onOfflineMessage((msg) => setOfflineMessage(msg)).then((fn) => { cleanupOffline = fn; });
    onWindowClosed((gameId) => setWindowOpen(gameId, false)).then((fn) => { cleanupClosed = fn; });
    return () => {
      cleanupOffline?.();
      cleanupClosed?.();
    };
  }, [hydrate, setOfflineMessage, setWindowOpen]);

  const isBigScreen = focusedPlugin !== null;

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[var(--color-surface-raised)]">
        <div className="flex items-center gap-3">
          {isBigScreen ? (
            <>
              <button
                onClick={() => setFocusedGameId(null)}
                className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
                title="Back to all games"
              >
                ← All games
              </button>
              <span className="text-white/20">·</span>
              <span className="text-sm font-medium text-white/80">{focusedPlugin.name}</span>
            </>
          ) : (
            <>
              <span className="text-2xl">⏳</span>
              <h1 className="text-xl font-bold tracking-wide text-white font-[var(--font-display)]">
                The Waiting Game
              </h1>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {import.meta.env.DEV && (
            <button
              onClick={handleResetAllProgress}
              title="Dev only: wipe gold, crystals, unlocks, and all save files"
              className="px-2 py-1 rounded text-xs border border-red-500/30 text-red-300/70 hover:text-red-200 hover:border-red-500/60 transition-colors"
            >
              Reset Progress
            </button>
          )}
          <CrystalDisplay />
          <GoldDisplay />
        </div>
      </header>

      {/* Offline earnings banner */}
      {offlineMessage && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-lg bg-amber-900/40 border border-amber-500/40 text-amber-200 text-sm flex items-center justify-between">
          <span>{offlineMessage}</span>
          <button
            onClick={() => setOfflineMessage(null)}
            className="ml-4 text-amber-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main content: big screen or chiclet grid */}
      <main className="flex-1 overflow-auto">
        {!hydrated ? (
          <div className="flex items-center justify-center h-full text-white/40">
            Loading…
          </div>
        ) : isBigScreen ? (
          <InlineGameShell plugin={focusedPlugin} />
        ) : (
          <div className="p-6">
            <Garden />
            <GameGrid onFocus={setFocusedGameId} />
          </div>
        )}
      </main>

      {!isBigScreen && (
        <footer className="px-6 py-2 text-xs text-white/20 border-t border-white/10">
          The Waiting Game v0.2.3
        </footer>
      )}
    </div>
  );
}
