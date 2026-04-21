interface Props {
  tempC: number;
  minC?: number;
  maxC?: number;
  height?: number;
}

export function TemperatureGauge({ tempC, minC = 20, maxC = 100, height = 160 }: Props) {
  const fraction = Math.min(1, Math.max(0, (tempC - minC) / (maxC - minC)));

  // Interpolate hue: 200 (blue/cold) → 0 (red/hot)
  const hue = Math.round(200 - fraction * 200);
  const fillColor = `hsl(${hue}, 80%, 55%)`;
  const bulbColor = fraction > 0.5 ? `hsl(${hue}, 80%, 50%)` : "#4FC3F7";

  const trackH = height - 28;
  const fillH = Math.round(trackH * fraction);

  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ height }}>
      <span className="text-xs font-mono text-white/60">{tempC.toFixed(1)}°C</span>

      <svg width="28" height={height - 20} viewBox={`0 0 28 ${height - 20}`}>
        {/* Track background */}
        <rect x="10" y="4" width="8" height={trackH} rx="4" fill="rgba(255,255,255,0.1)" />

        {/* Fill */}
        <rect
          x="10"
          y={4 + trackH - fillH}
          width="8"
          height={fillH}
          rx="4"
          fill={fillColor}
          style={{ transition: "all 0.3s ease" }}
        />

        {/* Bulb */}
        <circle
          cx="14"
          cy={height - 28}
          r="10"
          fill={bulbColor}
          style={{ transition: "fill 0.3s ease" }}
        />
        <circle cx="14" cy={height - 28} r="6" fill="rgba(255,255,255,0.2)" />
      </svg>
    </div>
  );
}
