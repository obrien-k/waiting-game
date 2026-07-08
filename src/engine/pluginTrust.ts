/**
 * Two-tier plugin trust model (ADR 0002).
 *
 * Tier 1 (trusted): native React with full `game-window` capabilities.
 * Built-ins and staff-vetted games only.
 * Tier 2 (untrusted): sandboxed `<iframe sandbox="allow-scripts">`, zero native
 * capabilities; privileged actions go through the postMessage broker
 * (`iframeBroker.ts`).
 *
 * Tier assignment is a hardcoded allowlist (`TRUSTED_PLUGIN_IDS`). Anything
 * loaded at runtime is external and always Tier 2 — an external descriptor has
 * no native component to promote. A future signature check (staff-signed
 * manifests) slots into the `resolveTrustTier` seam without changing callers.
 */

import type { MiniGamePlugin } from "./types";

export type TrustTier = "trusted" | "untrusted";

/**
 * Broker permissions a Tier-2 plugin may request in its manifest. An undeclared
 * capability is a hard denial at the broker, never a silent allow.
 */
export interface BrokerPermissions {
  /** May call the gold API (`earn-gold`) through the broker. */
  needsGoldAPI: boolean;
  /** May mint artifacts (`mint-artifact`) through the broker. */
  needsArtifactLedger: boolean;
}

export const NO_PERMISSIONS: BrokerPermissions = {
  needsGoldAPI: false,
  needsArtifactLedger: false,
};

/**
 * A dynamically-loaded, untrusted plugin. Unlike `MiniGamePlugin` it carries no
 * executable JS in the host context — only a description of where its sandboxed
 * entry point lives and which broker permissions it requested.
 */
export interface ExternalPlugin {
  readonly kind: "external";
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  /**
   * Sandboxed content source. Exactly one:
   * - `entryUrl`: a `plugin://` custom-protocol URL to on-disk plugin HTML.
   * - `srcdoc`: inline HTML (used by the dev fixture; no on-disk file needed).
   */
  readonly entryUrl?: string;
  readonly srcdoc?: string;
  /** Permissions requested in the manifest; the broker enforces these. */
  readonly permissions: BrokerPermissions;
  readonly windowSize?: { width: number; height: number };
  /**
   * External plugins never contribute to the artifact catalog (they have no
   * host-side declaration). Declared explicitly so `RegisteredPlugin` stays
   * structurally compatible with the catalog builder's optional-field type.
   */
  readonly artifactCatalog?: undefined;
}

/** A registry entry is either a native plugin or an external (sandboxed) one. */
export type RegisteredPlugin =
  | ({ readonly kind?: "native" } & MiniGamePlugin)
  | ExternalPlugin;

export function isExternalPlugin(p: RegisteredPlugin): p is ExternalPlugin {
  return (p as ExternalPlugin).kind === "external";
}

/** Sole gate for Tier-1 (native) execution today. */
export const TRUSTED_PLUGIN_IDS: ReadonlySet<string> = new Set([
  "water-boil",
  "paint-dry",
  "plant-grow",
  "amusement-park",
  // dev-only native fixtures — harmless in prod (never registered there)
  "dev-instant",
  "dev-paint",
  "dev-plant",
]);

/**
 * External plugins are always untrusted; native plugins only trusted if
 * allowlisted — an unexpected native id must not inherit capabilities.
 */
export function resolveTrustTier(plugin: RegisteredPlugin): TrustTier {
  if (isExternalPlugin(plugin)) return "untrusted";
  return TRUSTED_PLUGIN_IDS.has(plugin.id) ? "trusted" : "untrusted";
}
