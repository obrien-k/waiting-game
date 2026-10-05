import { type GroceryLineState, LANES, getParams } from "./groceryLineEngine";

const LANE_ICON: Record<keyof typeof LANES, string> = { regular: "🛒", express: "🧺", self: "🤖" };

export function CardThumbnail({ state: rawState }: { state: unknown }) {
  const state = rawState as GroceryLineState;
  const p = getParams(state);
  const color = p.utilization > 1 ? "#f87171" : p.utilization > 0.8 ? "#fb923c" : "#34d399";

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-3 w-full">
        <div className="text-2xl shrink-0">{LANE_ICON[state.activeLaneId] ?? "🛒"}</div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-white font-mono font-bold text-sm truncate">
            {Math.floor(state.queueLength).toLocaleString()} in line
          </div>
          <div className="text-white/40 text-xs mt-0.5">
            {p.utilization > 1 ? "backing up" : "moving"}
          </div>
        </div>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(p.utilization, 1) * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
