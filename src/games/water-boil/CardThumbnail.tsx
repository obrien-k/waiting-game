import type { WaterBoilState } from "./waterBoilEngine";

export function CardThumbnail({ state: rawState }: { state: unknown }) {
  const state = rawState as WaterBoilState;
  const fraction = Math.min(1, Math.max(0, (state.currentTemp - 20) / 80));
  const hue = Math.round(200 - fraction * 200);
  const fillColor = `hsl(${hue}, 80%, 55%)`;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Mini thermometer */}
      <div className="flex items-center gap-3">
        <svg width="16" height="50" viewBox="0 0 16 50">
          <rect x="6" y="2" width="4" height="32" rx="2" fill="rgba(255,255,255,0.1)" />
          <rect
            x="6"
            y={2 + 32 - Math.round(32 * fraction)}
            width="4"
            height={Math.round(32 * fraction)}
            rx="2"
            fill={fillColor}
            style={{ transition: "all 0.3s" }}
          />
          <circle cx="8" cy="42" r="6" fill={fillColor} style={{ transition: "fill 0.3s" }} />
        </svg>

        <div className="text-left">
          <div className="text-white font-mono font-bold text-sm">
            {state.currentTemp.toFixed(0)}°C
          </div>
          <div className="text-white/40 text-xs">
            {state.isBoiling ? "🌡️ Boiling!" : `${state.potVolumeLiters}L pot`}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${fraction * 100}%`, backgroundColor: fillColor }}
        />
      </div>
    </div>
  );
}
