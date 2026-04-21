import { TemperatureGauge } from "@/components/TemperatureGauge";
import { ProgressBar } from "@/components/ProgressBar";
import { UpgradePanel } from "@/components/UpgradePanel";
import { formatGold } from "@/engine/currency";
import type { PluginComponentProps } from "@/engine/types";
import {
  type WaterBoilState,
  WATER_BOIL_UPGRADES,
  getTimeRemainingSeconds,
  getOwnedUpgradeInstances,
} from "./waterBoilEngine";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds > 86400) return "∞";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function WaterBoilGame({ state: rawState, onUpgradePurchase, onReset }: PluginComponentProps) {
  const state = rawState as WaterBoilState;
  const fraction = (state.currentTemp - 20) / 80;
  const steamOpacity = Math.max(0, (state.currentTemp - 60) / 40);
  const timeLeft = getTimeRemainingSeconds(state);
  const ownedInstances = getOwnedUpgradeInstances(state.ownedUpgradeIds);

  function handleReset() {
    // Signal the shell to reset state
    if (onReset) {
      onReset();
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-white">
      {/* Top section — visual */}
      <div className="flex flex-col items-center justify-center pt-6 pb-4 px-4 gap-4">
        {/* Steam */}
        <div
          className="flex gap-3 h-10 items-end"
          style={{ opacity: steamOpacity, transition: "opacity 0.5s ease" }}
        >
          <div
            className="w-2 h-8 rounded-full bg-[var(--color-steam)] steam-tendril"
            style={{ opacity: 0.7 }}
          />
          <div
            className="w-3 h-10 rounded-full bg-[var(--color-steam)] steam-tendril"
          />
          <div
            className="w-2 h-6 rounded-full bg-[var(--color-steam)] steam-tendril"
            style={{ opacity: 0.7 }}
          />
        </div>

        {/* Pot + gauge row */}
        <div className="flex items-end gap-6">
          <TemperatureGauge tempC={state.currentTemp} height={140} />

          {/* Pot illustration */}
          <div className="flex flex-col items-center">
            <div className="text-6xl">🫕</div>
            <div className="text-xs text-white/40 mt-1">{state.potVolumeLiters}L pot</div>
          </div>

          {/* Heat source indicator */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-2xl">
              {state.heaterWatts >= 3000
                ? "⚡"
                : state.heaterWatts >= 1000
                  ? "🔌"
                  : state.heaterWatts >= 500
                    ? "🔥"
                    : "🕯️"}
            </div>
            <div className="text-xs text-white/40">{state.heaterWatts}W</div>
          </div>
        </div>

        {/* Temperature display */}
        {state.isBoiling ? (
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400 animate-pulse">
              Boiling!
            </div>
            <div className="text-sm text-white/50 mt-1">
              +{formatGold(state.potVolumeLiters * 10)} gold earned
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
            onClick={handleReset}
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
            ◈ {formatGold(state.totalBoils * state.potVolumeLiters * 10)}
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
        />
      </div>
    </div>
  );
}
