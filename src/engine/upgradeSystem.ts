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

  return goldBalance >= def.cost;
}

export function purchaseUpgrade(
  owned: UpgradeInstance[],
  id: string
): UpgradeInstance[] {
  const existing = owned.find((u) => u.id === id);
  if (existing) {
    return owned.map((u) => (u.id === id ? { ...u, level: u.level + 1 } : u));
  }
  return [...owned, { id, level: 1 }];
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
