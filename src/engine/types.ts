import type React from "react";

export interface UpgradeDef {
  id: string;
  label: string;
  description: string;
  cost: number;
  maxLevel: number;
  requires?: string[];
  icon?: string;
  /**
   * Marks a radio-selectable set (e.g. "what"/"how", "pot"/"heater"). Within a
   * group, exactly one upgrade is active. Once owned, members can be freely
   * re-selected — buying unlocks, selecting switches. Ungrouped upgrades are
   * permanent one-time purchases.
   */
  group?: string;
  /** Human-readable header for `group`, shown by UpgradePanel (e.g. "Heat Source"). */
  groupLabel?: string;
  /** Per-level cost multiplier for repeatable upgrades (maxLevel > 1): cost × scaling^level. Default 1 (flat). */
  costScaling?: number;
  apply: (state: unknown, level: number) => unknown;
}

export interface UpgradeInstance {
  id: string;
  level: number;
}

export interface PluginComponentProps {
  state: unknown;
  onUpgradePurchase: (upgradeId: string) => void;
  /** Re-select an already-owned grouped upgrade (no cost, no ownership change). */
  onSelectUpgrade?: (upgradeId: string) => void;
  onReset?: () => void;
  isPopOut: boolean;
}

/**
 * A selectable mode within a game (the "what" axis of the two-axis upgrade system).
 * Hard-mode variants award exactly 1 crystal on completion — never more.
 */
export interface GameVariant {
  id: string;
  label: string;
  emoji?: string;
  baseDurationSeconds: number;
  goldPerCompletion: number;
  /** If true: awards 1 crystal on completion, must meet hard-mode duration minimums. */
  isHardMode: boolean;
}

export interface TickResult {
  next: unknown;
  goldEarned: number;
  /** Always 0 or 1. Shells clamp this — engines must not return > 1. */
  crystalsEarned: number;
  /**
   * Bare artifact id minted this tick (e.g. the completed variant's id), set on
   * a completion. Shells namespace it to `${plugin.id}:${artifactId}` before
   * crediting. Absent when nothing was minted — additive, so engines that never
   * set it are unaffected.
   */
  artifactId?: string;
}

export interface MiniGamePlugin {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;

  getInitialState(): unknown;
  hydrateState(raw: unknown): unknown | Promise<unknown>;
  tick(state: unknown, deltaMs: number): TickResult;

  Component: React.ComponentType<PluginComponentProps>;
  CardThumbnail?: React.ComponentType<{ state: unknown }>;
  upgrades: UpgradeDef[];
  /** Declares available modes. First entry is the default. */
  variants?: GameVariant[];

  /**
   * Collectible artifacts this game can mint (the ecosystem/Garden system). The
   * hub merges every plugin's catalog to render collections by category. Keys
   * are `${plugin.id}:${bareArtifactId}`. Optional — a game opts in by declaring
   * it and returning `artifactId` from `tick`.
   */
  artifactCatalog?: ArtifactCatalogEntry[];

  /** Optional: reset game state to a fresh start (preserves upgrades). */
  reset?: (state: unknown) => unknown;
}

export type ArtifactCategory = "flora" | "fauna" | "relic" | "trophy";

/** Static display metadata for one artifact type. Buffs (Phase 2) attach here. */
export interface ArtifactCatalogEntry {
  /** Fully-qualified: `${plugin.id}:${bareArtifactId}`, e.g. "plant-grow:oak". */
  id: string;
  gameId: string;
  category: ArtifactCategory;
  name: string;
  emoji: string;
  description: string;
}

/** One aggregated artifact type in the hub ledger (mirrors the Rust struct). */
export interface ArtifactEntry {
  count: number;
  firstAcquiredAt: number;
  lastAcquiredAt: number;
}

export interface ArtifactLedger {
  /** Keyed by fully-qualified artifact type id. */
  entries: Record<string, ArtifactEntry>;
}

export interface CrystalLedger {
  /** Lifetime count. Crystals are never spent — they are a prestige record. */
  count: number;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  minEngineVersion: string;
  entry: string;
  icon?: string;
  windowSize?: { width: number; height: number };
  tags?: string[];
}

export interface GoldLedger {
  balance: number;
  lifetimeEarned: number;
}

export interface GameTickBroadcast {
  gameId: string;
  state: unknown;
  timestamp: number;
}
