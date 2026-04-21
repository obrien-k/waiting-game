import { useHubStore } from "@/store/hubStore";
import { GameCard } from "./GameCard";

export function GameGrid() {
  const installedGameIds = useHubStore((s) => s.installedGameIds);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {installedGameIds.map((id) => (
        <GameCard key={id} gameId={id} />
      ))}

      {/* Install placeholder */}
      <button className="h-48 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 text-white/30 hover:text-white/50 hover:border-white/40 transition-all">
        <span className="text-3xl">+</span>
        <span className="text-sm">Install Game</span>
      </button>
    </div>
  );
}
