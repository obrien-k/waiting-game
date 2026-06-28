import { ProgressBar } from "@/components/ProgressBar";
import { UpgradePanel } from "@/components/UpgradePanel";
import { formatGold } from "@/engine/currency";
import type { PluginComponentProps } from "@/engine/types";
import {
  type AmusementParkState,
  AMUSEMENT_PARK_UPGRADES,
  getOwnedUpgradeInstances,
} from "./AmusementParkEngine";

function formatRate(guestsPerSec: number): string {
  const perMin = guestsPerSec * 60;
  if (perMin >= 1) return `${perMin.toFixed(1)}/min`;
  return `${(guestsPerSec * 3600).toFixed(0)}/hr`;
}

function heatLabel(heat: number): { text: string; emoji: string; color: string } {
  if (heat >= 0.8) return { text: "Scorching", emoji: "🔥", color: "text-red-400" };
  if (heat >= 0.5) return { text: "Hot", emoji: "☀️", color: "text-orange-400" };
  if (heat >= 0.2) return { text: "Warm", emoji: "🌤️", color: "text-yellow-400" };
  return { text: "Cool", emoji: "🌙", color: "text-blue-400" };
}

export function AmusementParkGame({
  state: rawState,
  onUpgradePurchase,
  onSelectUpgrade,
}: PluginComponentProps) {
  const state = rawState as AmusementParkState;
  const ownedInstances = getOwnedUpgradeInstances(state.ownedUpgradeIds);
  const heat = heatLabel(state.heatIndex);

  // Compute utilization (ρ = λ * E[S])
  const expectedServiceTime =
    (state.paretoAlpha * state.paretoScale) / (state.paretoAlpha - 1.0);
  const utilization = state.arrivalRate * expectedServiceTime;
  const serviceRate = 1.0 / expectedServiceTime;

  // Queue pressure visual (capped at 1.0 for the bar)
  const queuePressure = Math.min(1, utilization);

  return (
    <div className="flex flex-col h-full overflow-hidden text-white">
      {/* Queue visualization */}
      <div className="flex flex-col items-center justify-center pt-4 pb-3 px-4 gap-3">
        {/* Queue counter */}
        <div className="text-center">
          <div className="text-5xl font-bold font-mono tabular-nums">
            {Math.floor(state.queueLength)}
          </div>
          <div className="text-xs text-white/40 mt-1">guests in line</div>
        </div>

        {/* Queue pressure bar */}
        <div className="w-full px-2">
          <ProgressBar
            value={queuePressure}
            label="Queue Pressure (ρ)"
            color={
              utilization > 0.9
                ? "bg-red-500"
                : utilization > 0.7
                  ? "bg-orange-400"
                  : "bg-emerald-400"
            }
            height="h-2"
          />
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-2 text-xs font-mono flex-wrap justify-center">
          <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60">
            👥 {formatRate(state.arrivalRate)} arriving
          </span>
          <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60">
            🎢 {formatRate(serviceRate)} served
          </span>
          <span className={`px-2 py-1 rounded-md bg-white/5 border border-white/10 ${heat.color}`}>
            {heat.emoji} {heat.text}
          </span>
        </div>

        {utilization > 1 && (
          <div className="text-xs text-red-400 animate-pulse">
            ⚠ Queue is growing faster than the ride can serve!
          </div>
        )}
      </div>

      <div className="mx-4 h-px bg-white/10" />

      {/* Stats row */}
      <div className="flex justify-around px-4 py-3 text-xs text-white/40">
        <div className="text-center">
          <div className="text-white/70 font-mono font-semibold">
            {Math.floor(state.totalServed).toLocaleString()}
          </div>
          <div>total served</div>
        </div>
        <div className="text-center">
          <div className="text-white/70 font-mono font-semibold">
            {Math.floor(state.abandoned).toLocaleString()}
          </div>
          <div>abandoned</div>
        </div>
        <div className="text-center">
          <div className="text-[var(--color-gold)] font-mono font-semibold">
            ◈ {formatGold(state.totalServed * state.goldPerGuest)}
          </div>
          <div>lifetime gold</div>
        </div>
      </div>

      <div className="mx-4 h-px bg-white/10" />

      {/* Upgrades */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <UpgradePanel
          upgrades={AMUSEMENT_PARK_UPGRADES}
          owned={ownedInstances}
          onPurchase={onUpgradePurchase}
          onSelect={onSelectUpgrade}
        />
      </div>
    </div>
  );
}
