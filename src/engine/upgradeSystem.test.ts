import { describe, it, expect } from "vitest";
import {
  getOwnedInstances,
  getUpgradeLevel,
  getUpgradeCost,
  canPurchaseUpgrade,
  purchaseUpgrade,
} from "./upgradeSystem";
import type { UpgradeDef } from "./types";

describe("getOwnedInstances", () => {
  it("derives level from how many times an id appears in the flat list", () => {
    const instances = getOwnedInstances(["extra-carts", "shade-canopy", "extra-carts", "extra-carts"]);
    expect(getUpgradeLevel(instances, "extra-carts")).toBe(3);
    expect(getUpgradeLevel(instances, "shade-canopy")).toBe(1);
    expect(getUpgradeLevel(instances, "unowned")).toBe(0);
  });
});

describe("getUpgradeCost", () => {
  const flat: UpgradeDef = {
    id: "flat",
    label: "Flat",
    description: "",
    cost: 100,
    maxLevel: 1,
    apply: (s) => s,
  };
  const scaling: UpgradeDef = {
    id: "scaling",
    label: "Scaling",
    description: "",
    cost: 150,
    costScaling: 1.6,
    maxLevel: 5,
    apply: (s) => s,
  };

  it("stays flat with no costScaling", () => {
    expect(getUpgradeCost(flat, 0)).toBe(100);
    expect(getUpgradeCost(flat, 3)).toBe(100);
  });

  it("compounds cost by costScaling^level", () => {
    expect(getUpgradeCost(scaling, 0)).toBe(150);
    expect(getUpgradeCost(scaling, 1)).toBe(240);
    expect(getUpgradeCost(scaling, 4)).toBe(983);
  });
});

describe("canPurchaseUpgrade + purchaseUpgrade round-trip", () => {
  const repeatable: UpgradeDef = {
    id: "extra-carts",
    label: "Extra Carts",
    description: "",
    cost: 150,
    costScaling: 1.6,
    maxLevel: 3,
    apply: (s) => s,
  };
  const defs = [repeatable];

  it("blocks purchase once maxLevel is reached", () => {
    let ownedIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const owned = getOwnedInstances(ownedIds);
      expect(canPurchaseUpgrade(defs, owned, "extra-carts", 1_000_000)).toBe(true);
      ownedIds = purchaseUpgrade(ownedIds, "extra-carts");
    }
    const maxed = getOwnedInstances(ownedIds);
    expect(getUpgradeLevel(maxed, "extra-carts")).toBe(3);
    expect(canPurchaseUpgrade(defs, maxed, "extra-carts", 1_000_000)).toBe(false);
  });

  it("blocks purchase when gold balance can't cover the next level's scaled cost", () => {
    const ownedIds = purchaseUpgrade([], "extra-carts"); // level 1 owned
    const owned = getOwnedInstances(ownedIds);
    const nextCost = getUpgradeCost(repeatable, 1); // 240
    expect(canPurchaseUpgrade(defs, owned, "extra-carts", nextCost - 1)).toBe(false);
    expect(canPurchaseUpgrade(defs, owned, "extra-carts", nextCost)).toBe(true);
  });
});
