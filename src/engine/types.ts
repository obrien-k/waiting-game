import type React from "react";

export interface UpgradeDef {
  id: string;
  label: string;
  description: string;
  cost: number;
  maxLevel: number;
  requires?: string[];
  icon?: string;
  apply: (state: unknown, level: number) => unknown;
}

export interface UpgradeInstance {
  id: string;
  level: number;
}

export interface PluginComponentProps {
  state: unknown;
  onUpgradePurchase: (upgradeId: string) => void;
  onReset?: () => void;
  isPopOut: boolean;
}

export interface TickResult {
  next: unknown;
  goldEarned: number;
}

export interface MiniGamePlugin {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;

  getInitialState(): unknown;
  hydrateState(raw: unknown): unknown;
  tick(state: unknown, deltaMs: number): TickResult;

  Component: React.ComponentType<PluginComponentProps>;
  CardThumbnail?: React.ComponentType<{ state: unknown }>;
  upgrades: UpgradeDef[];

  /** Optional: reset game state to a fresh start (preserves upgrades). */
  reset?: (state: unknown) => unknown;
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
