import type { UpgradeDef, UpgradeInstance } from "./types";

export function getUpgradeLevel(
  upgrades: UpgradeInstance[],
  id: string
): number {
  return upgrades.find((u) => u.id === id)?.level ?? 0;
}

export function isUpgradeOwned(upgrades: UpgradeInstance[], id: string): boolean {
  return getUpgradeLevel(upgrades, id) > 0;
}

/**
 * Derives owned upgrade instances (id + level) from the persisted flat id
 * list. Levels aren't stored separately — a repeatable upgrade's level is
 * however many times its id appears in `ownedIds` (see `purchaseUpgrade`).
 */
export function getOwnedInstances(ownedIds: string[]): UpgradeInstance[] {
  const levels = new Map<string, number>();
  for (const id of ownedIds) levels.set(id, (levels.get(id) ?? 0) + 1);
  return Array.from(levels.entries()).map(([id, level]) => ({ id, level }));
}

/** Cost to purchase the given upgrade's next level (0-indexed): cost × scaling^level. */
export function getUpgradeCost(def: UpgradeDef, level: number): number {
  return Math.round(def.cost * (def.costScaling ?? 1) ** level);
}

export function canPurchaseUpgrade(
  defs: UpgradeDef[],
  owned: UpgradeInstance[],
  id: string,
  goldBalance: number
): boolean {
  const def = defs.find((d) => d.id === id);
  if (!def) return false;

  const currentLevel = getUpgradeLevel(owned, id);
  if (currentLevel >= def.maxLevel) return false;

  if (def.requires) {
    for (const reqId of def.requires) {
      if (!isUpgradeOwned(owned, reqId)) return false;
    }
  }

  return goldBalance >= getUpgradeCost(def, currentLevel);
}

/** Records a purchase by appending another copy of `id` to the flat owned-id list. */
export function purchaseUpgrade(ownedIds: string[], id: string): string[] {
  return [...ownedIds, id];
}

export function applyUpgrades<T>(
  defs: UpgradeDef[],
  owned: UpgradeInstance[],
  baseState: T
): T {
  return owned.reduce((state, instance) => {
    const def = defs.find((d) => d.id === instance.id);
    if (!def) return state;
    return def.apply(state, instance.level) as T;
  }, baseState);
}
