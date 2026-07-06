/**
 * Manifest parsing → `ExternalPlugin` (ADR 0002).
 *
 * A workshop bundle ships a `manifest.json`. This module validates that untrusted
 * JSON and converts it into an `ExternalPlugin` descriptor with a normalized,
 * explicitly-granted permission set. The future dynamic loader (issue #3) will
 * call `parseManifest` on each plugin's `manifest.json` under `AppData/plugins`;
 * nothing else in the host needs to know the on-disk format.
 */

import type { PluginManifest } from "./types";
import type { BrokerPermissions, ExternalPlugin } from "./pluginTrust";
import { pluginAssetUrl } from "./pluginProtocol";

export type ManifestParse =
  | { ok: true; plugin: ExternalPlugin }
  | { ok: false; errors: string[] };

const ID = /^[a-z0-9][a-z0-9-]*$/;

/** Normalize the manifest's optional permissions into a fully-specified set. */
export function grantedPermissions(m: PluginManifest): BrokerPermissions {
  return {
    needsGoldAPI: m.permissions?.needsGoldAPI === true,
    needsArtifactLedger: m.permissions?.needsArtifactLedger === true,
  };
}

/**
 * Validate a parsed manifest and build an `ExternalPlugin`. External bundles are
 * ALWAYS Tier 2 here: even a manifest requesting `trust: "trusted"` yields an
 * untrusted, sandboxed descriptor — native promotion is the host allowlist's
 * decision (`resolveTrustTier`), never the bundle's.
 */
export function parseManifest(raw: unknown): ManifestParse {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["manifest is not an object"] };
  }
  const m = raw as Partial<PluginManifest>;

  for (const field of ["id", "name", "version", "entry"] as const) {
    if (typeof m[field] !== "string" || (m[field] as string).length === 0) {
      errors.push(`missing or invalid "${field}"`);
    }
  }
  if (typeof m.id === "string" && !ID.test(m.id)) {
    errors.push(`"id" must be kebab-case: ${m.id}`);
  }
  // The entry must be a relative path within the bundle — never absolute, never
  // a traversal, never a URL. The protocol layer re-checks this on the Rust
  // side, but rejecting early gives a clearer error.
  if (typeof m.entry === "string") {
    if (m.entry.startsWith("/") || m.entry.includes("..") || /^[a-z]+:/i.test(m.entry)) {
      errors.push(`"entry" must be a relative in-bundle path: ${m.entry}`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const manifest = m as PluginManifest;
  const plugin: ExternalPlugin = {
    kind: "external",
    id: manifest.id,
    name: manifest.name,
    description: manifest.description ?? "",
    version: manifest.version,
    entryUrl: pluginAssetUrl(manifest.id, manifest.entry),
    permissions: grantedPermissions(manifest),
    windowSize: manifest.windowSize,
  };
  return { ok: true, plugin };
}
