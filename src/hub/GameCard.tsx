import { useEffect, useState } from "react";
import { useGameRegistry, type GameRegistryState } from "@/store/gameRegistry";
import { useHubStore } from "@/store/hubStore";
import { openGameWindow } from "@/engine/windowManager";
import { onTickBroadcast } from "@/engine/eventBus";
import type { MiniGamePlugin } from "@/engine/types";

interface Props {
  gameId: string;
  onFocus: (gameId: string) => void;
}

export function GameCard({ gameId, onFocus }: Props) {
  const plugin = useGameRegistry((s: GameRegistryState) => s.plugins[gameId] as MiniGamePlugin | undefined);
  const isOpen = useHubStore((s) => s.openWindowIds.has(gameId));
  const setWindowOpen = useHubStore((s) => s.setWindowOpen);
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

  const Thumbnail = plugin.CardThumbnail;

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
