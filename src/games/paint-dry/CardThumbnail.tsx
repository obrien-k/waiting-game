import { type PaintDryState, getActiveVariant } from "./paintDryEngine";

export function PaintDryCardThumbnail({ state: rawState }: { state: unknown }) {
  const state = rawState as PaintDryState;
  const variant = getActiveVariant(state);
  const pct = Math.round(state.progress * 100);
  const fillColor = state.isComplete
    ? variant.isHardMode ? "#c084fc" : "var(--color-gold)"
    : variant.isHardMode
      ? `hsl(270, 70%, ${45 + state.progress * 20}%)`
      : `hsl(${Math.round(200 + state.progress * 80)}, 70%, 55%)`;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-center gap-3 w-full">
        <span className="text-2xl shrink-0">{variant.emoji ?? "🎨"}</span>
        <div className="flex-1 text-left">
          <div className="text-white font-mono font-bold text-sm">
            {state.isComplete ? "Dry!" : `${pct}%`}
          </div>
          <div className="flex items-center gap-1 text-white/40 text-xs mt-0.5">
            <span>{variant.label}</span>
            {variant.isHardMode && <span className="text-purple-400">💎</span>}
          </div>
        </div>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: fillColor }}
        />
      </div>
    </div>
  );
}
