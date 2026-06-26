import { ProgressBar } from "@/components/ProgressBar";
import { UpgradePanel } from "@/components/UpgradePanel";
import { formatGold } from "@/engine/currency";
import type { PluginComponentProps } from "@/engine/types";
import {
  type TemplateState,
  TEMPLATE_UPGRADES,
  getActiveVariant,
  getTimeRemainingSeconds,
} from "./engine";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds > 86400) return "∞";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function TemplateGame({ state: rawState, onUpgradePurchase, onReset }: PluginComponentProps) {
  const state = rawState as TemplateState;
  const variant = getActiveVariant(state);
  const timeLeft = getTimeRemainingSeconds(state);

  return (
    <div className="flex flex-col h-full overflow-hidden text-white">
      {/* Hard mode badge */}
      {variant.isHardMode && (
        <div className="mx-4 mt-4 px-3 py-1.5 rounded-lg bg-purple-900/50 border border-purple-500/40 text-purple-200 text-xs flex items-center gap-2">
          <span>💎</span>
          <span className="font-semibold">Hard Mode</span>
          <span className="text-purple-300/60">— completes with 1 crystal</span>
        </div>
      )}

      {/* Main visual */}
      <div className="flex flex-col items-center justify-center pt-8 pb-6 px-4 gap-6">
        <div className="text-7xl select-none">{variant.emoji ?? "⏳"}</div>
        <div className="text-sm text-white/50">{variant.label}</div>

        {state.isComplete ? (
          <div className="text-center">
            <div className={`text-2xl font-bold animate-pulse ${variant.isHardMode ? "text-purple-300" : "text-[var(--color-gold)]"}`}>
              Done!
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
            Again
          </button>
        </div>
      )}

      <div className="mx-4 h-px bg-white/10" />

      {/* Stats */}
      <div className="flex justify-around px-4 py-3 text-xs text-white/40">
        <div className="text-center">
          <div className="text-white/70 font-mono font-semibold">{state.totalCompletions}</div>
          <div>completions</div>
        </div>
        {state.hardModeCompletions > 0 && (
          <div className="text-center">
            <div className="text-purple-300 font-mono font-semibold">💎 {state.hardModeCompletions}</div>
            <div>crystals earned</div>
          </div>
        )}
        <div className="text-center">
          <div className="text-[var(--color-gold)] font-mono font-semibold">
            ◈ {formatGold(state.totalCompletions * (TEMPLATE_UPGRADES[0] ? variant.goldPerCompletion : 0))}
          </div>
          <div>lifetime gold</div>
        </div>
      </div>

      <div className="mx-4 h-px bg-white/10" />

      <div className="flex-1 overflow-auto px-4 py-3">
        <UpgradePanel
          upgrades={TEMPLATE_UPGRADES}
          owned={state.ownedUpgradeIds.map((id) => ({ id, level: 1 }))}
          onPurchase={onUpgradePurchase}
        />
      </div>
    </div>
  );
}
