/**
 * Two-tier plugin trust model (ADR 0002).
 *
 * Tier 1 (trusted): renders as a native React component with full `game-window`
 * capability inheritance (filesystem, direct Tauri IPC). Reserved for built-ins
 * and staff-vetted community games.
 *
 * Tier 2 (untrusted): renders inside a sandboxed `<iframe sandbox="allow-scripts">`
 * with zero native capabilities. All privileged actions go through the
 * `postMessage` broker (see `iframeBroker.ts`), which validates and clamps every
 * request before acting on the iframe's behalf.
 *
 * TRUST-TIER ASSIGNMENT MECHANISM
 * ------------------------------
 * Today: a hardcoded allowlist (`TRUSTED_PLUGIN_IDS`). Only plugins compiled into
 * the binary — the built-ins — can be Tier 1, and only if their id is on the
 * allowlist. Anything loaded dynamically at runtime is external and defaults to
 * Tier 2. There is no code path by which an externally-sourced plugin becomes
 * Tier 1: `resolveTrustTier` keys off the discriminated `kind`, and an external
 * descriptor has no native React component to promote.
 *
 * Future (tracked, not implemented here): replace the allowlist with a signature
 * check — a staff-held key signs a vetted bundle's manifest, and a valid
 * signature (plus allowlisted id) promotes an external bundle to Tier 1. The
 * `resolveTrustTier` seam is where that check will slot in; callers do not change.
 */

import type { MiniGamePlugin } from "./types";

export type TrustTier = "trusted" | "untrusted";

/**
 * Broker permissions a Tier-2 plugin may request in its manifest. The broker
 * rejects any brokered action whose backing permission is not granted here, so
 * an undeclared capability is a hard denial rather than a silent allow.
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

/**
 * Allowlist of plugin ids permitted to run as Tier 1 (native). These are the
 * built-ins; membership is the sole gate for native execution today.
 */
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
 * Resolve the trust tier for a registry entry. External plugins are always
 * untrusted. Native plugins are trusted only if allowlisted; a native plugin
 * whose id is not on the allowlist is treated as untrusted (defense in depth —
 * an unexpected native id should not inherit capabilities).
 */
export function resolveTrustTier(plugin: RegisteredPlugin): TrustTier {
  if (isExternalPlugin(plugin)) return "untrusted";
  return TRUSTED_PLUGIN_IDS.has(plugin.id) ? "trusted" : "untrusted";
}
