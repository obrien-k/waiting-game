import { useEffect } from "react";
import { useHubStore, startGoldListener } from "@/store/hubStore";
import { onOfflineMessage } from "@/engine/eventBus";
import { GameGrid } from "./GameGrid";
import { GoldDisplay } from "@/components/GoldDisplay";

export function HubApp() {
  const hydrate = useHubStore((s) => s.hydrate);
  const hydrated = useHubStore((s) => s.hydrated);
  const offlineMessage = useHubStore((s) => s.offlineMessage);
  const setOfflineMessage = useHubStore((s) => s.setOfflineMessage);

  useEffect(() => {
    hydrate();
    startGoldListener();
    let cleanup: (() => void) | null = null;
    onOfflineMessage((msg) => setOfflineMessage(msg)).then((fn) => {
      cleanup = fn;
    });
    return () => { cleanup?.(); };
  }, [hydrate, setOfflineMessage]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[var(--color-surface-raised)]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <h1 className="text-xl font-bold tracking-wide text-white font-[var(--font-display)]">
            The Waiting Game
          </h1>
        </div>
        <GoldDisplay />
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

      {/* Game grid */}
      <main className="flex-1 overflow-auto p-6">
        {hydrated ? (
          <GameGrid />
        ) : (
          <div className="flex items-center justify-center h-full text-white/40">
            Loading…
          </div>
        )}
      </main>

      <footer className="px-6 py-2 text-xs text-white/20 border-t border-white/10">
        The Waiting Game v0.1.0
      </footer>
    </div>
  );
}
