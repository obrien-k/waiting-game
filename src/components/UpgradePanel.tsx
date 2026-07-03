import { formatGold } from "@/engine/currency";
import { useHubStore } from "@/store/hubStore";
import { canPurchaseUpgrade, getUpgradeCost } from "@/engine/upgradeSystem";
import type { UpgradeDef, UpgradeInstance } from "@/engine/types";

interface Props {
  upgrades: UpgradeDef[];
  owned: UpgradeInstance[];
  onPurchase: (id: string) => void;
  /** Re-select an owned grouped upgrade. Required for grouped (radio) upgrades. */
  onSelect?: (id: string) => void;
  /** Ids currently active within their group — rendered as "✓ Active". */
  activeUpgradeIds?: string[];
}

/** Buckets upgrades by `group` (ungrouped upgrades land in a trailing "Upgrades" bucket), preserving first-seen order. */
function groupUpgrades(upgrades: UpgradeDef[]): { label: string; defs: UpgradeDef[] }[] {
  const buckets = new Map<string, { label: string; defs: UpgradeDef[] }>();
  for (const def of upgrades) {
    const key = def.group ?? "__ungrouped__";
    const label = def.group ? def.groupLabel ?? def.group : "Upgrades";
    if (!buckets.has(key)) buckets.set(key, { label, defs: [] });
    buckets.get(key)!.defs.push(def);
  }
  return Array.from(buckets.values());
}

export function UpgradePanel({
  upgrades,
  owned,
  onPurchase,
  onSelect,
  activeUpgradeIds = [],
}: Props) {
  const goldBalance = useHubStore((s) => s.gold.balance);
  const sections = groupUpgrades(upgrades);

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 px-1">
            {section.label}
          </h3>
          {section.defs.map((def) => {
            const instance = owned.find((u) => u.id === def.id);
            const level = instance?.level ?? 0;
            const isOwned = level >= def.maxLevel;
            const affordable = canPurchaseUpgrade(upgrades, owned, def.id, goldBalance);
            const nextCost = getUpgradeCost(def, level);

            // Grouped upgrades are radio-selectable once owned: one is active, the
            // rest are owned-but-inactive and can be re-selected for free.
            const grouped = def.group !== undefined;
            const isActive = activeUpgradeIds.includes(def.id);
            const selectable = grouped && isOwned && !isActive && onSelect;

            function handleClick() {
              if (selectable) onSelect!(def.id);
              else if (!isOwned && affordable) onPurchase(def.id);
            }

            const clickable = selectable || (!isOwned && affordable);

            return (
              <button
                key={def.id}
                onClick={handleClick}
                disabled={!clickable}
                className={`
                  flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all text-left
                  ${isActive
                    ? "border-green-500/50 bg-green-500/15 text-green-200 cursor-default"
                    : selectable
                      ? "border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/40"
                      : isOwned
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
                  {isActive ? (
                    <span className="text-green-400">✓ Active</span>
                  ) : selectable ? (
                    <span className="text-white/60">Select</span>
                  ) : isOwned ? (
                    <span className="text-green-400">✓ Owned</span>
                  ) : (
                    <span className={affordable ? "text-[var(--color-gold)]" : "text-white/30"}>
                      ◈ {formatGold(nextCost)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
