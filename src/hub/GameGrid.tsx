import { useHubStore } from "@/store/hubStore";
import { GameCard } from "./GameCard";

interface Props {
  onFocus: (gameId: string) => void;
}

export function GameGrid({ onFocus }: Props) {
  const installedGameIds = useHubStore((s) => s.installedGameIds);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {installedGameIds.map((id) => (
        <GameCard key={id} gameId={id} onFocus={onFocus} />
      ))}

      {/* Honest placeholder — becomes the install entry point when the
          workshop loader ships. Not a button until it can act. */}
      <div className="h-48 rounded-xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-2 text-white/25 select-none">
        <span className="text-3xl">⏳</span>
        <span className="text-sm">More Waits on the way</span>
        <span className="text-xs text-white/15">Workshop support is planned</span>
      </div>
    </div>
  );
}
