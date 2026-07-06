import { useEffect, useState } from "react";
import { useGameRegistry, UNLOCK_COSTS, type GameRegistryState } from "@/store/gameRegistry";
import { useHubStore } from "@/store/hubStore";
import { openGameWindow } from "@/engine/windowManager";
import { onTickBroadcast } from "@/engine/eventBus";
import { formatGold } from "@/engine/currency";
import { isExternalPlugin, type RegisteredPlugin } from "@/engine/pluginTrust";

interface Props {
  gameId: string;
  onFocus: (gameId: string) => void;
}

export function GameCard({ gameId, onFocus }: Props) {
  const plugin = useGameRegistry((s: GameRegistryState) => s.plugins[gameId] as RegisteredPlugin | undefined);
  const isOpen = useHubStore((s) => s.openWindowIds.has(gameId));
  const setWindowOpen = useHubStore((s) => s.setWindowOpen);
  const isUnlocked = useHubStore((s) => s.unlockedGameIds.has(gameId));
  const goldBalance = useHubStore((s) => s.gold.balance);
  const unlockGame = useHubStore((s) => s.unlockGame);
  const [liveState, setLiveState] = useState<unknown>(null);

  useEffect(() => {
    const unsub = onTickBroadcast(gameId, setLiveState);
    return unsub;
  }, [gameId]);

  if (!plugin) {
    return (
      <div className="h-48 rounded-xl bg-white/5 flex items-center justify-center text-white/20">
        Unknown game: {gameId}
      </div>
    );
  }

  async function handlePopOut() {
    if (!plugin) return;
    await openGameWindow(gameId, plugin.name);
    setWindowOpen(gameId, true);
  }

  const unlockCost = UNLOCK_COSTS[gameId] ?? 0;
  const locked = unlockCost > 0 && !isUnlocked;

  if (locked) {
    const affordable = goldBalance >= unlockCost;
    return (
      <div className="relative h-48 rounded-xl bg-[var(--color-surface-raised)] border border-white/10 overflow-hidden flex flex-col opacity-70">
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
          <div className="text-4xl opacity-40">🔒</div>
          <div className="text-sm font-medium text-white/70">{plugin.name}</div>
          <div className="text-xs text-white/40 text-center px-2">{plugin.description}</div>
        </div>
        <div className="px-3 py-2 border-t border-white/10">
          <button
            onClick={() => unlockGame(gameId, unlockCost)}
            disabled={!affordable}
            className={`w-full py-1.5 rounded text-xs border transition-colors ${
              affordable
                ? "border-[var(--color-gold)]/50 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10"
                : "border-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            🔒 Unlock for ◈ {formatGold(unlockCost)}
          </button>
        </div>
      </div>
    );
  }

  // External (Tier-2) plugins have no host-side thumbnail component; they fall
  // back to the ⏳ placeholder.
  const Thumbnail = isExternalPlugin(plugin) ? undefined : plugin.CardThumbnail;

  return (
    <div className="relative h-48 rounded-xl bg-[var(--color-surface-raised)] border border-white/10 overflow-hidden flex flex-col hover:border-white/20 transition-colors group">
      {/* Game thumbnail / live preview — click to big screen (disabled if already in a pop-out) */}
      <button
        onClick={() => !isOpen && onFocus(gameId)}
        disabled={isOpen}
        className="flex-1 flex items-center justify-center p-4 w-full hover:bg-white/5 disabled:cursor-default transition-colors"
        title={isOpen ? "Game is open in a pop-out window" : "Focus game"}
      >
        {Thumbnail && liveState ? (
          <Thumbnail state={liveState} />
        ) : (
          <div className="text-4xl opacity-60">⏳</div>
        )}
      </button>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{plugin.name}</div>
          <div className="text-xs text-white/40 truncate">{plugin.description}</div>
        </div>

        <button
          onClick={handlePopOut}
          disabled={isOpen}
          title={isOpen ? "Already open" : "Pop out to desktop"}
          className="ml-2 shrink-0 px-2 py-1 rounded text-xs border border-white/20 text-white/60 hover:text-white hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {isOpen ? "Open" : "⎋ Pop out"}
        </button>
      </div>
    </div>
  );
}
