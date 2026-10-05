import { ProgressBar } from "@/components/ProgressBar";
import { UpgradePanel } from "@/components/UpgradePanel";
import { formatGold } from "@/engine/currency";
import { getOwnedInstances } from "@/engine/upgradeSystem";
import type { PluginComponentProps } from "@/engine/types";
import {
  type GroceryLineState,
  GROCERY_LINE_UPGRADES,
  getActiveUpgradeIds,
  getParams,
} from "./groceryLineEngine";

function lineStatus(rho: number): { text: string; color: string; bar: string } {
  if (rho > 1) return { text: "Line is backing up. Shoppers will walk out.", color: "text-red-400", bar: "bg-red-500" };
  if (rho > 0.8) return { text: "Busy, but keeping up.", color: "text-orange-300", bar: "bg-orange-400" };
  return { text: "Line is moving.", color: "text-emerald-300", bar: "bg-emerald-400" };
}

export function GroceryLineGame({
  state: rawState,
  onUpgradePurchase,
  onSelectUpgrade,
}: PluginComponentProps) {
  const state = rawState as GroceryLineState;
  const p = getParams(state);
  const status = lineStatus(p.utilization);

  return (
    <div className="flex flex-col h-full overflow-hidden text-white">
      <div className="flex flex-col items-center pt-4 pb-3 px-4 gap-3">
        <div className="text-center">
          <div className="text-5xl font-bold font-mono tabular-nums">
            {Math.floor(state.queueLength)}
          </div>
          <div className="text-xs text-white/40 mt-1">shoppers in line</div>
        </div>

        <div className="w-full px-2">
          <ProgressBar value={Math.min(1, p.utilization)} label="How busy" color={status.bar} height="h-2" />
        </div>

        <div className={`text-xs ${status.color}`}>{status.text}</div>
      </div>

      <div className="mx-4 h-px bg-white/10" />

      <div className="flex justify-around px-4 py-3 text-xs text-white/40">
        <div className="text-center">
          <div className="text-white/70 font-mono font-semibold">
            {Math.floor(state.totalServed).toLocaleString()}
          </div>
          <div>checked out</div>
        </div>
        <div className="text-center">
          <div className="text-white/70 font-mono font-semibold">
            {Math.floor(state.abandoned).toLocaleString()}
          </div>
          <div>walked out</div>
        </div>
        <div className="text-center">
          <div className="text-[var(--color-gold)] font-mono font-semibold">
            ◈ {formatGold(p.goldPerShopper)}
          </div>
          <div>per shopper</div>
        </div>
      </div>

      <div className="mx-4 h-px bg-white/10" />

      <div className="flex-1 overflow-auto px-4 py-3">
        <UpgradePanel
          upgrades={GROCERY_LINE_UPGRADES}
          owned={getOwnedInstances(state.ownedUpgradeIds ?? [])}
          onPurchase={onUpgradePurchase}
          onSelect={onSelectUpgrade}
          activeUpgradeIds={getActiveUpgradeIds(state)}
        />
      </div>
    </div>
  );
}
