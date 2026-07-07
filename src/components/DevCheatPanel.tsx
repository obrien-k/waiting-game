import { useState } from "react";
import type { MiniGamePlugin } from "@/engine/types";
import { emitGoldEarned, emitCrystalEarned, emitArtifactEarned } from "@/engine/eventBus";

interface Props {
  plugin: MiniGamePlugin;
  getState: () => unknown;
  applyState: (next: unknown) => void;
}

// Epoch-ms heuristic for the time-warp: any top-level number that reads as a
// date after 2020 is treated as a timestamp and rewound.
const EPOCH_2020 = 1_577_836_800_000;

function rewindTimestamps(state: unknown, byMs: number): unknown {
  if (typeof state !== "object" || state === null) return state;
  const out: Record<string, unknown> = { ...(state as Record<string, unknown>) };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "number" && v > EPOCH_2020) out[k] = v - byMs;
  }
  return out;
}

/**
 * Dev-only cheat panel (never rendered in prod builds). "Warp" rewinds the
 * state's timestamps and re-runs the plugin's real `hydrateState`, so offline
 * progress, offline banners, and gold credits all exercise the production
 * path instead of a synthetic shortcut.
 */
export function DevCheatPanel({ plugin, getState, applyState }: Props) {
  const [open, setOpen] = useState(false);
  const [editorText, setEditorText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!import.meta.env.DEV) return null;

  async function warp(hours: number) {
    setError(null);
    const rewound = rewindTimestamps(getState(), hours * 3_600_000);
    applyState(await Promise.resolve(plugin.hydrateState(rewound)));
  }

  function openEditor() {
    setEditorText(JSON.stringify(getState(), null, 2));
    setError(null);
  }

  async function applyEditor() {
    if (editorText === null) return;
    try {
      const parsed = JSON.parse(editorText);
      // Route through hydrateState so engine sanitization still applies.
      applyState(await Promise.resolve(plugin.hydrateState(parsed)));
      setEditorText(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const btn =
    "px-2 py-0.5 rounded text-xs border border-fuchsia-500/30 text-fuchsia-300/80 hover:text-fuchsia-200 hover:border-fuchsia-500/60 transition-colors";

  return (
    <div className="border-t border-fuchsia-500/20 bg-fuchsia-950/20 text-xs select-none">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-1 text-left text-fuchsia-400/60 hover:text-fuchsia-300 transition-colors"
      >
        🧪 Cheats {open ? "▾" : "▸"}
      </button>

      {open && (
        <div className="px-3 pb-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-fuchsia-400/50">Gold</span>
            <button className={btn} onClick={() => emitGoldEarned(plugin.id, 1_000)}>+1k</button>
            <button className={btn} onClick={() => emitGoldEarned(plugin.id, 100_000)}>+100k</button>
            <span className="ml-2 text-fuchsia-400/50">Crystal</span>
            <button className={btn} onClick={() => emitCrystalEarned(plugin.id)}>+1 💎</button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-fuchsia-400/50">Warp</span>
            <button className={btn} onClick={() => warp(1)}>+1 h</button>
            <button className={btn} onClick={() => warp(8)}>+8 h</button>
            <button className={btn} onClick={() => warp(48)}>+2 d</button>
            <button className={btn} onClick={() => warp(120)}>+5 d</button>
          </div>

          {plugin.artifactCatalog && plugin.artifactCatalog.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-fuchsia-400/50">Mint</span>
              {plugin.artifactCatalog.map((entry) => (
                <button
                  key={entry.id}
                  className={btn}
                  title={entry.name}
                  onClick={() => emitArtifactEarned(plugin.id, entry.id, 1)}
                >
                  {entry.emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1">
            {editorText === null ? (
              <button className={`${btn} self-start`} onClick={openEditor}>
                Edit state JSON…
              </button>
            ) : (
              <>
                <textarea
                  value={editorText}
                  onChange={(e) => setEditorText(e.target.value)}
                  spellCheck={false}
                  className="h-40 w-full resize-y rounded border border-fuchsia-500/30 bg-black/40 p-2 font-mono text-[11px] text-fuchsia-100/90"
                />
                <div className="flex gap-1.5">
                  <button className={btn} onClick={applyEditor}>Apply</button>
                  <button className={btn} onClick={() => { setEditorText(null); setError(null); }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
            {error && <span className="text-red-400/80">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
