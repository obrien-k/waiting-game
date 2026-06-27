// Chrome-kettle visual for water-boil. Pure SVG + CSS (no image assets) so it
// stays self-contained for both the Tauri webview and the HTML export path.
// Driven by `fraction` (0 cold → 1 boiling), heater wattage, and boiling state.

interface Props {
  fraction: number;
  watts: number;
  isBoiling: boolean;
}

// Cold → hot hue ramp: 200 (blue) → 0 (red).
function waterColors(fraction: number): { top: string; bottom: string } {
  const hue = Math.round(200 - fraction * 200);
  return {
    top: `hsl(${hue}, 90%, 62%)`,
    bottom: `hsl(${hue}, 85%, 44%)`,
  };
}

const BUBBLES = [
  { left: 12, size: 5, delay: 0, dur: 1.6 },
  { left: 30, size: 3, delay: 0.6, dur: 2.0 },
  { left: 44, size: 6, delay: 1.1, dur: 1.4 },
  { left: 58, size: 4, delay: 0.3, dur: 1.8 },
  { left: 72, size: 3, delay: 1.4, dur: 2.1 },
  { left: 86, size: 5, delay: 0.9, dur: 1.5 },
];

export function KettleVisual({ fraction, watts, isBoiling }: Props) {
  const water = waterColors(fraction);
  const fillH = 66 * Math.min(1, Math.max(0, fraction)); // glass inner height = 66
  const waterY = 160 - fillH;

  // Steam appears past ~60% of the way to boil; burner glow scales with wattage.
  const steamOpacity = isBoiling ? 0.9 : Math.max(0, (fraction - 0.55) / 0.45);
  const bubbleOpacity = isBoiling ? 1 : Math.max(0, (fraction - 0.25) / 0.75);
  const glowStrength = Math.min(1, watts / 3000);

  return (
    <div className="relative" style={{ width: 180, height: 196 }}>
      {/* Volumetric steam */}
      <div
        className="absolute inset-x-0 top-0 flex justify-center gap-3 h-14 items-end pointer-events-none"
        style={{ opacity: steamOpacity, transition: "opacity 0.6s ease" }}
      >
        <div className="w-3 h-9 rounded-full bg-[var(--color-steam)] blur-[3px] steam-tendril" style={{ opacity: 0.6 }} />
        <div className="w-4 h-12 rounded-full bg-[var(--color-steam)] blur-[4px] steam-tendril" style={{ opacity: 0.75 }} />
        <div className="w-3 h-8 rounded-full bg-[var(--color-steam)] blur-[3px] steam-tendril" style={{ opacity: 0.5 }} />
      </div>

      {/* Burner bloom */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: 2,
          width: 150,
          height: 40,
          opacity: 0.25 + glowStrength * 0.6,
          background:
            "radial-gradient(ellipse at center, var(--color-hot) 0%, rgba(255,69,0,0.35) 35%, transparent 70%)",
          filter: "blur(4px)",
          transition: "opacity 0.4s ease",
        }}
      />

      <svg width="180" height="196" viewBox="0 0 180 196" className="absolute inset-0">
        <defs>
          <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8fafc" />
            <stop offset="0.16" stopColor="#cfd8e3" />
            <stop offset="0.46" stopColor="#9aa6b4" />
            <stop offset="0.54" stopColor="#c4cdd8" />
            <stop offset="0.82" stopColor="#7c8694" />
            <stop offset="1" stopColor="#aab4c0" />
          </linearGradient>
          <linearGradient id="chromeLid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbfdff" />
            <stop offset="0.5" stopColor="#b6c0cc" />
            <stop offset="1" stopColor="#8a94a2" />
          </linearGradient>
          <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={water.top} />
            <stop offset="1" stopColor={water.bottom} />
          </linearGradient>
          <clipPath id="glassClip">
            <rect x="58" y="94" width="64" height="66" rx="8" />
          </clipPath>
        </defs>

        {/* Handle arcing over the top */}
        <path d="M62 72 C62 36 118 36 118 72" fill="none" stroke="url(#chrome)" strokeWidth="7" strokeLinecap="round" />

        {/* Spout */}
        <path d="M132 104 L156 92 L150 108 L132 116 Z" fill="url(#chrome)" stroke="#7c8694" strokeWidth="1" />

        {/* Body */}
        <rect x="46" y="82" width="88" height="84" rx="18" fill="url(#chrome)" stroke="#6b7480" strokeWidth="1" />

        {/* Rim */}
        <ellipse cx="90" cy="82" rx="44" ry="8" fill="url(#chromeLid)" />
        {/* Lid + knob */}
        <ellipse cx="90" cy="74" rx="33" ry="9" fill="url(#chromeLid)" stroke="#7c8694" strokeWidth="0.75" />
        <rect x="84" y="60" width="12" height="10" rx="3" fill="url(#chromeLid)" />
        <ellipse cx="90" cy="60" rx="7" ry="3.5" fill="#e8edf3" />

        {/* Specular streak down the left of the body */}
        <ellipse cx="64" cy="120" rx="7" ry="30" fill="url(#shine)" opacity="0.7" />

        {/* Glass tank backing */}
        <rect x="58" y="94" width="64" height="66" rx="8" fill="#0b1220" />
        {/* Water */}
        <g clipPath="url(#glassClip)">
          <rect x="58" y={waterY} width="64" height={fillH} fill="url(#water)" style={{ transition: "all 0.3s ease" }} />
          {/* surface line */}
          <rect x="58" y={waterY} width="64" height="2" fill="rgba(255,255,255,0.35)" style={{ transition: "all 0.3s ease" }} />
        </g>
        {/* Glass border + top highlight */}
        <rect x="58" y="94" width="64" height="66" rx="8" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <rect x="62" y="98" width="20" height="54" rx="6" fill="url(#shine)" opacity="0.15" />
      </svg>

      {/* Rising bubbles, clipped to the glass tank region */}
      <div
        className="absolute overflow-hidden pointer-events-none"
        style={{ left: 58, top: 94, width: 64, height: 66, borderRadius: 8, opacity: bubbleOpacity, transition: "opacity 0.4s ease" }}
      >
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="kettle-bubble absolute bottom-0 rounded-full bg-white/70"
            style={{ left: b.left, width: b.size, height: b.size, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}
          />
        ))}
      </div>
    </div>
  );
}
