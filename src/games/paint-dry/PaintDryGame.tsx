import { ProgressBar } from "@/components/ProgressBar";
import { UpgradePanel } from "@/components/UpgradePanel";
import { formatGold } from "@/engine/currency";
import { getOwnedInstances } from "@/engine/upgradeSystem";
import type { PluginComponentProps } from "@/engine/types";
import {
  type PaintDryState,
  PAINT_DRY_UPGRADES,
  getActiveVariant,
  getActiveUpgradeIds,
  getTimeRemainingSeconds,
  getDryingStats,
} from "./paintDryEngine";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds > 86400) return "∞";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function PaintDryGame({ state: rawState, onUpgradePurchase, onSelectUpgrade, onReset }: PluginComponentProps) {
  const state = rawState as PaintDryState;
  const variant = getActiveVariant(state);
  const timeLeft = getTimeRemainingSeconds(state);
  const stats = getDryingStats(state);

  // Wet → dry: the swatch fades from saturated to muted as it cures.
  const wetness = state.isComplete ? 0 : 1 - state.progress;
  const swatchOpacity = 0.45 + 0.55 * wetness;

  return (
    <div className="flex flex-col h-full overflow-hidden text-white">
      {variant.isHardMode && (
        <div className="mx-4 mt-4 px-3 py-1.5 rounded-lg bg-purple-900/50 border border-purple-500/40 text-purple-200 text-xs flex items-center gap-2">
          <span>💎</span>
          <span className="font-semibold">Hard Mode</span>
          <span className="text-purple-300/60">— cures with 1 crystal</span>
        </div>
      )}

      <div className="flex flex-col items-center justify-center pt-8 pb-6 px-4 gap-4">
        {/* Paint swatch — drying = drifting from glossy to flat */}
        <div
          className="text-7xl select-none transition-opacity duration-300"
          style={{ opacity: swatchOpacity, filter: `saturate(${0.6 + wetness})` }}
        >
          {variant.emoji ?? "🎨"}
        </div>
        <div className="text-sm text-white/50">
          {variant.label}
          {!state.isComplete && (
            <span className="text-white/30"> · {wetness > 0.5 ? "still wet" : "almost dry"}</span>
          )}
        </div>

        {state.isComplete ? (
          <div className="text-center">
            <div className={`text-2xl font-bold animate-pulse ${variant.isHardMode ? "text-purple-300" : "text-[var(--color-gold)]"}`}>
              Dry!
            </div>
            <div className="text-sm text-white/50 mt-1">
              +{formatGold(variant.goldPerCompletion)} gold
              {variant.isHardMode && <span className="ml-2 text-purple-300">+1 💎</span>}
            </div>
          </div>
        ) : (
          <div className="w-full px-2">
            <ProgressBar
              value={state.progress}
              color={
                variant.isHardMode
                  ? "bg-purple-400"
                  : state.progress > 0.8
                    ? "bg-green-400"
                    : state.progress > 0.4
                      ? "bg-blue-400"
                      : "bg-white/40"
              }
              height="h-2"
            />
            <div className="flex justify-between text-xs text-white/40 mt-1 font-mono">
              <span>{Math.round(state.progress * 100)}%</span>
              <span>⏱ {formatTime(timeLeft)}</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>

      {state.isComplete && (
        <div className="px-4 pb-3">
          <button
            onClick={onReset}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-sm"
          >
            Repaint
          </button>
        </div>
      )}

      <div className="mx-4 h-px bg-white/10" />

      <div className="flex justify-around px-4 py-3 text-xs text-white/40">
        <div className="text-center">
          <div className="text-white/70 font-mono font-semibold">{state.totalCompletions}</div>
          <div>coats dried</div>
        </div>
        {state.hardModeCompletions > 0 && (
          <div className="text-center">
            <div className="text-purple-300 font-mono font-semibold">💎 {state.hardModeCompletions}</div>
            <div>crystals earned</div>
          </div>
        )}
        <div className="text-center">
          <div className="text-[var(--color-gold)] font-mono font-semibold">◈ {formatGold(state.lifetimeGold)}</div>
          <div>lifetime gold</div>
        </div>
      </div>

      <div className="mx-4 h-px bg-white/10" />

      {/* The science — live evaporation readout */}
      {!variant.isHardMode ? (
        <div className="mx-4 my-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 font-mono">
          <div className="text-white/30 uppercase tracking-wider text-[10px] mb-1">Drying physics</div>
          <div className="flex justify-between"><span>air flow</span><span className="text-white/70">{stats.airVelocity.toFixed(1)} m/s</span></div>
          <div className="flex justify-between"><span>humidity</span><span className="text-white/70">{Math.round(stats.relHumidity * 100)}% RH</span></div>
          <div className="flex justify-between"><span>film temp</span><span className="text-white/70">{stats.filmTempC.toFixed(0)}°C</span></div>
          <div className="flex justify-between"><span>evap. flux</span><span className="text-white/70">{stats.fluxGramsPerM2PerHour.toFixed(1)} g/m²·h</span></div>
        </div>
      ) : (
        <div className="mx-4 my-3 px-3 py-2 rounded-lg bg-purple-900/30 border border-purple-500/20 text-xs text-purple-200/60 font-mono">
          Reaction-limited cure — airflow &amp; heat don&apos;t speed oxidative crosslinking.
        </div>
      )}

      <div className="mx-4 h-px bg-white/10" />

      <div className="flex-1 overflow-auto px-4 py-3">
        <UpgradePanel
          upgrades={PAINT_DRY_UPGRADES}
          owned={getOwnedInstances(state.ownedUpgradeIds)}
          onPurchase={onUpgradePurchase}
          onSelect={onSelectUpgrade}
          activeUpgradeIds={getActiveUpgradeIds(state)}
        />
      </div>
    </div>
  );
}
