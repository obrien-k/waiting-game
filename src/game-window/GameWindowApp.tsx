import { useGameRegistry, type GameRegistryState } from "@/store/gameRegistry";
import { GameWindowShell } from "./GameWindowShell";

interface Props {
  gameId: string;
}

export function GameWindowApp({ gameId }: Props) {
  const plugin = useGameRegistry((s: GameRegistryState) => s.plugins[gameId]);

  if (!plugin) {
    return (
      <div className="h-full flex items-center justify-center text-white/40 bg-[var(--color-surface)]">
        <div className="text-center">
          <div className="text-4xl mb-2">?</div>
          <div>Unknown game: {gameId}</div>
        </div>
      </div>
    );
  }

  return <GameWindowShell plugin={plugin} />;
}
