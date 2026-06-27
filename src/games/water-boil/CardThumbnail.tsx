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

  // Mini chrome kettle: water fills the glass window from the bottom.
  const winH = 16;
  const fillH = winH * fraction;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-center gap-3 w-full">
        {/* Mini chrome kettle */}
        <svg width="26" height="34" viewBox="0 0 26 34" className="shrink-0">
          <defs>
            <linearGradient id="miniChrome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f1f5f9" />
              <stop offset="0.5" stopColor="#9aa6b4" />
              <stop offset="1" stopColor="#7c8694" />
            </linearGradient>
            <clipPath id="miniGlass">
              <rect x="8" y="13" width="10" height={winH} rx="2" />
            </clipPath>
          </defs>
          {/* handle */}
          <path d="M7 11 C7 4 19 4 19 11" fill="none" stroke="url(#miniChrome)" strokeWidth="2" strokeLinecap="round" />
          {/* body */}
          <rect x="4" y="11" width="18" height="20" rx="4" fill="url(#miniChrome)" />
          {/* lid knob */}
          <ellipse cx="13" cy="11" rx="8" ry="2.5" fill="#cbd5e1" />
          {/* glass window + water */}
          <rect x="8" y="13" width="10" height={winH} rx="2" fill="#0b1220" />
          <g clipPath="url(#miniGlass)">
            <rect x="8" y={13 + winH - fillH} width="10" height={fillH} fill={fillColor} style={{ transition: "all 0.3s" }} />
          </g>
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
