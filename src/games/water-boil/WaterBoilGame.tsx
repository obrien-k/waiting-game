import { ProgressBar } from "@/components/ProgressBar";
import { UpgradePanel } from "@/components/UpgradePanel";
import { KettleVisual } from "./KettleVisual";
import { formatGold } from "@/engine/currency";
import type { PluginComponentProps } from "@/engine/types";
import {
  type WaterBoilState,
  WATER_BOIL_UPGRADES,
  getTimeRemainingSeconds,
  getOwnedUpgradeInstances,
  getActiveUpgradeIds,
  goldPerBoil,
} from "./waterBoilEngine";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds > 86400) return "∞";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function heatIcon(watts: number): string {
  if (watts >= 3000) return "⚡";
  if (watts >= 1000) return "🔌";
  if (watts >= 500) return "🔥";
  return "🕯️";
}

export function WaterBoilGame({ state: rawState, onUpgradePurchase, onSelectUpgrade, onReset }: PluginComponentProps) {
  const state = rawState as WaterBoilState;
  const fraction = (state.currentTemp - 20) / 80;
  const timeLeft = getTimeRemainingSeconds(state);
  const ownedInstances = getOwnedUpgradeInstances(state.ownedUpgradeIds);

  return (
    <div className="flex flex-col h-full overflow-hidden text-white">
      {/* Top section — chrome kettle */}
      <div className="flex flex-col items-center justify-center pt-3 pb-3 px-4 gap-3">
        <KettleVisual fraction={fraction} watts={state.heaterWatts} isBoiling={state.isBoiling} />

        {/* Heat source + pot chips */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60">
            {heatIcon(state.heaterWatts)} {state.heaterWatts}W
          </span>
          <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60">
            🫕 {state.potVolumeLiters}L
          </span>
        </div>

        {state.isBoiling ? (
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400 animate-pulse">Boiling!</div>
            <div className="text-sm text-white/50 mt-1">
              +{formatGold(goldPerBoil(state.potVolumeLiters))} gold earned
            </div>
          </div>
        ) : (
          <div className="w-full px-2">
            <ProgressBar
              value={fraction}
              color={fraction > 0.8 ? "bg-red-400" : fraction > 0.5 ? "bg-orange-400" : "bg-blue-400"}
              height="h-2"
            />
            <div className="flex justify-between text-xs text-white/40 mt-1 font-mono">
              <span>{state.currentTemp.toFixed(1)}°C</span>
              <span>⏱ {formatTime(timeLeft)}</span>
              <span>100°C</span>
            </div>
          </div>
        )}
      </div>

      {/* Boiling action button */}
      {state.isBoiling && (
        <div className="px-4 pb-3">
          <button
            onClick={onReset}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-sm"
          >
            Refill &amp; Restart
          </button>
        </div>
      )}

      <div className="mx-4 h-px bg-white/10" />

      {/* Stats row */}
      <div className="flex justify-around px-4 py-3 text-xs text-white/40">
        <div className="text-center">
          <div className="text-white/70 font-mono font-semibold">{state.totalBoils}</div>
          <div>total boils</div>
        </div>
        <div className="text-center">
          <div className="text-[var(--color-gold)] font-mono font-semibold">
            ◈ {formatGold(state.totalBoils * goldPerBoil(state.potVolumeLiters))}
          </div>
          <div>lifetime gold</div>
        </div>
      </div>

      <div className="mx-4 h-px bg-white/10" />

      {/* Upgrades */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <UpgradePanel
          upgrades={WATER_BOIL_UPGRADES}
          owned={ownedInstances}
          onPurchase={onUpgradePurchase}
          onSelect={onSelectUpgrade}
          activeUpgradeIds={getActiveUpgradeIds(state)}
        />
      </div>
    </div>
  );
}
