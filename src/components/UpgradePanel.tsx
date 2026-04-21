import { formatGold } from "@/engine/currency";
import { useHubStore } from "@/store/hubStore";
import { canPurchaseUpgrade } from "@/engine/upgradeSystem";
import type { UpgradeDef, UpgradeInstance } from "@/engine/types";

interface Props {
  upgrades: UpgradeDef[];
  owned: UpgradeInstance[];
  onPurchase: (id: string) => void;
}

export function UpgradePanel({ upgrades, owned, onPurchase }: Props) {
  const goldBalance = useHubStore((s) => s.gold.balance);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 px-1">
        Upgrades
      </h3>
      {upgrades.map((def) => {
        const instance = owned.find((u) => u.id === def.id);
        const level = instance?.level ?? 0;
        const maxed = level >= def.maxLevel;
        const affordable = canPurchaseUpgrade(upgrades, owned, def.id, goldBalance);

        return (
          <button
            key={def.id}
            onClick={() => !maxed && onPurchase(def.id)}
            disabled={maxed || !affordable}
            className={`
              flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all text-left
              ${maxed
                ? "border-green-500/30 bg-green-500/10 text-green-300/60 cursor-default"
                : affordable
                  ? "border-amber-500/40 bg-amber-500/10 text-white hover:bg-amber-500/20 hover:border-amber-500/60"
                  : "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
              }
            `}
          >
            <div>
              <div className="font-medium">{def.label}</div>
              <div className="text-xs opacity-60">{def.description}</div>
            </div>
            <div className="ml-3 shrink-0 text-xs font-mono">
              {maxed ? (
                <span className="text-green-400">✓ Owned</span>
              ) : (
                <span className={affordable ? "text-[var(--color-gold)]" : "text-white/30"}>
                  ◈ {formatGold(def.cost)}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
