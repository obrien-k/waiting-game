import type { WaterBoilState } from "./waterBoilEngine";

function heatIcon(watts: number) {
  if (watts >= 3000) return "⚡";
  if (watts >= 1000) return "🔌";
  if (watts >= 500) return "🔥";
  return "🕯️";
}

export function CardThumbnail({ state: rawState }: { state: unknown }) {
  const state = rawState as WaterBoilState;
  const fraction = Math.min(1, Math.max(0, (state.currentTemp - 20) / 80));
  const hue = Math.round(200 - fraction * 200);
  const fillColor = `hsl(${hue}, 80%, 55%)`;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-center gap-3 w-full">
        {/* Mini thermometer */}
        <svg width="16" height="50" viewBox="0 0 16 50" className="shrink-0">
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

        {/* Temp + combo */}
        <div className="flex-1 text-left">
          <div className="text-white font-mono font-bold text-sm">
            {state.isBoiling ? "Boiling! 🌡️" : `${state.currentTemp.toFixed(0)}°C`}
          </div>
          <div className="flex items-center gap-1.5 text-white/40 text-xs mt-0.5">
            <span>{heatIcon(state.heaterWatts)} {state.heaterWatts}W</span>
            <span className="text-white/20">·</span>
            <span>🫕 {state.potVolumeLiters}L</span>
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
