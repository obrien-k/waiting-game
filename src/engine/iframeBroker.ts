/**
 * Tier-2 postMessage broker (ADR 0002).
 *
 * The sandboxed iframe (opaque origin, no `window.__TAURI__`) cannot touch the
 * filesystem or Tauri IPC. Its only channel to privileged host actions is
 * `window.parent.postMessage`. This module is the trusted decision layer that
 * sits on the parent side: it decodes an untrusted message, checks it against
 * the plugin's granted permissions, and clamps every numeric payload against
 * `PLUGIN_LIMITS` before returning a decision the React shell may execute.
 *
 * It is intentionally pure (no DOM, no Tauri, no side effects) so the entire
 * attack surface — malformed payloads, permission bypass, cross-plugin artifact
 * minting, runaway gold — is exercisable in a unit test. `IframeGameShell` is the
 * thin wiring that authenticates the message source and performs the side effect.
 */

import { PLUGIN_LIMITS } from "./pluginValidation";
import type { BrokerPermissions } from "./pluginTrust";

/** Messages the untrusted iframe may send to the host. */
export type IframeRequest =
  | { type: "plugin:ready" }
  | { type: "plugin:earn-gold"; amount: number }
  | { type: "plugin:mint-artifact"; artifactId: string };

/** The host's decoded intent after validation — what the shell should do. */
export type BrokerDecision =
  | { action: "handshake" }
  | { action: "earn-gold"; amount: number }
  | { action: "mint-artifact"; artifactId: string }
  | { action: "reject"; reason: string };

export interface BrokerContext {
  /** The plugin whose iframe sent the message — bounds artifact namespacing. */
  pluginId: string;
  /** Permissions granted to this plugin (from its manifest). */
  permissions: BrokerPermissions;
}

// A bare artifact id segment: lowercase alphanumerics and dashes. Kept in sync
// with the shell's `${pluginId}:${bareId}` namespacing convention.
const BARE_ARTIFACT_ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Decode arbitrary postMessage data into a known request shape, or `null` if it
 * is not a recognized, well-typed broker message. Everything the iframe sends is
 * hostile until it passes here: we never trust field presence or types.
 */
export function decodeIframeMessage(data: unknown): IframeRequest | null {
  if (typeof data !== "object" || data === null) return null;
  const msg = data as Record<string, unknown>;

  switch (msg.type) {
    case "plugin:ready":
      return { type: "plugin:ready" };

    case "plugin:earn-gold":
      if (typeof msg.amount !== "number") return null;
      return { type: "plugin:earn-gold", amount: msg.amount };

    case "plugin:mint-artifact":
      if (typeof msg.artifactId !== "string") return null;
      return { type: "plugin:mint-artifact", artifactId: msg.artifactId };

    default:
      return null;
  }
}

/**
 * Given a decoded request and the plugin's context, decide what the host may do.
 * Pure: returns a decision, never performs the action. A rejection always
 * carries a reason (surfaced to the iframe as a `host:ack` error) — there are no
 * silent no-ops.
 */
export function brokerDecide(
  req: IframeRequest,
  ctx: BrokerContext
): BrokerDecision {
  switch (req.type) {
    case "plugin:ready":
      return { action: "handshake" };

    case "plugin:earn-gold": {
      if (!ctx.permissions.needsGoldAPI) {
        return { action: "reject", reason: "gold API not granted" };
      }
      // Untrusted: reject non-finite / negative outright; clamp the rest to the
      // same per-tick ceiling the native shells enforce. A plugin cannot mint
      // gold faster than a legitimate completion payout.
      if (!Number.isFinite(req.amount) || req.amount <= 0) {
        return { action: "reject", reason: "invalid gold amount" };
      }
      const amount = Math.min(
        Math.floor(req.amount),
        PLUGIN_LIMITS.goldPerTickMax
      );
      return { action: "earn-gold", amount };
    }

    case "plugin:mint-artifact": {
      if (!ctx.permissions.needsArtifactLedger) {
        return { action: "reject", reason: "artifact ledger not granted" };
      }
      // The iframe sends a BARE id; the host namespaces it. This makes it
      // structurally impossible for a plugin to mint another game's artifact —
      // the namespace is always its own pluginId, never attacker-controlled.
      if (!BARE_ARTIFACT_ID.test(req.artifactId)) {
        return { action: "reject", reason: "invalid artifact id" };
      }
      return {
        action: "mint-artifact",
        artifactId: `${ctx.pluginId}:${req.artifactId}`,
      };
    }

    default:
      // Exhaustive: `req` is `never` here. Kept as a hard denial in case the
      // request union grows without a matching decision branch.
      return { action: "reject", reason: "unknown request" };
  }
}
