# ADR 0002: Two-tier plugin sandbox & trust model

- **Status:** Accepted — implemented 2026-07-05 (`feat/adr-0002-plugin-sandbox`)
- **Date:** 2026-07-02
- **Deciders:** @obrien-k
- **Supersedes:** [ADR 0001](./0001-workshop-plugin-sandbox.md)

## Context

The Waiting Game supports dynamic loading of third-party mini-game plugins at
runtime via `AppData/plugins/*/manifest.json` (see `CLAUDE.md` →
"Steam Workshop / external plugin loading"). ADR 0001 identified two flaws that
block shipping this without addressing them:

1. **No CSP.** `security.csp` in `src-tauri/tauri.conf.json` is `null` — an open
   XSS surface that, in a Tauri app, can reach the IPC bridge.
2. **Full capability inheritance.** Plugins run inside the `game-window`
   capability set (`src-tauri/capabilities/game-window.json`), which grants
   `fs:allow-app-read-recursive` and `fs:allow-app-write-recursive` — full
   read/write access to every game's save data in `AppData`.

ADR 0001 left the decision open across three options (locked-down per-plugin
capabilities, sandboxed iframe, or review-gated trust with no runtime sandbox).
This ADR closes that decision by combining options 2 and 3 into a tiered model,
rather than picking one for all plugins: official/vetted plugins get native
performance, community plugins get sandboxed isolation.

## Decision

We will implement a two-tier trust model for all loaded plugins, branching at
runtime on a signature check or hardcoded allowlist.

### Tier 1: Staff-approved (trusted)

- **Execution:** renders natively as a React component in the Tauri webview.
- **Capabilities:** inherits the full `game-window` capability set — direct
  filesystem access for saves and direct Tauri IPC event emission (e.g.
  `gold-earned`, see `src/engine/eventBus.ts`).
- **Use case:** built-in games and heavily vetted community games.

### Tier 2: Community-sourced (untrusted)

- **Execution:** renders inside an isolated `<iframe sandbox="allow-scripts">`.
- **Capabilities:** zero native Tauri capabilities — the iframe has no access to
  the filesystem or `window.__TAURI__`.
- **IPC broker:** all privileged actions are brokered through a strict
  `window.parent.postMessage` API. The parent shell validates the payload
  (e.g. clamping gold earned against `PLUGIN_LIMITS` in
  `src/engine/pluginValidation.ts`) and executes the Tauri IPC call on the
  iframe's behalf.
- **Asset resolution:** local images/audio are served via a Tauri custom
  protocol (e.g. `asset://localhost/plugins/<id>/`) scoped to the plugin's own
  directory, rather than bundling assets or granting filesystem access.

## Consequences

- Build an `IframeGameShell` component to host Tier 2 plugins and implement the
  `postMessage` broker.
- Extend the `manifest.json` schema (`src/games/_template/manifest.json`) to
  declare required broker permissions (e.g. `needsArtifactLedger`,
  `needsGoldAPI`) so the broker can reject undeclared calls.
- Define a real `security.csp` in `src-tauri/tauri.conf.json` that is strict
  enough to constrain Tier 2 iframes (closes issue #2).
- Decide and document the trust-tier assignment mechanism (signature check vs.
  allowlist) before any dynamic loading merges — tracked as a follow-up.
- ADR 0001 is superseded; its "no dynamic/external plugin loading may merge
  until Accepted" gate is now satisfied by this decision.

## Implementation (2026-07-05)

Landed as a full vertical slice on `feat/adr-0002-plugin-sandbox`.

### Trust-tier assignment mechanism (the follow-up this ADR deferred)

**Decision: a hardcoded allowlist, today.** `src/engine/pluginTrust.ts` holds
`TRUSTED_PLUGIN_IDS` (the compiled-in built-ins). `resolveTrustTier` returns
`trusted` only for a native plugin whose id is on that list; **every**
dynamically-loaded plugin is an `ExternalPlugin` and is always `untrusted`.
There is no code path that promotes external content to Tier 1 — the registry
entry types are discriminated (`kind: "external"` vs native), and an external
descriptor carries no React component to run natively.

**Future:** replace the allowlist with a signature check — a staff key signs a
vetted bundle's manifest; a valid signature plus an allowlisted id promotes it to
Tier 1. `resolveTrustTier` is the single seam where that slots in; no caller
changes. Until then, external = sandboxed, unconditionally.

### What was built

| Concern | Implementation |
|---|---|
| CSP (issue #2) | Strict `security.csp` + a Vite-friendly `security.devCsp` in `tauri.conf.json`. `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`; `plugin:` allowed only for `img`/`media`/`frame`. |
| Tier-1 path | Unchanged — `GameWindowShell` / `InlineGameShell`, full `game-window` capabilities. |
| Tier-2 path | `IframeGameShell` renders `<iframe sandbox="allow-scripts">` (opaque origin, no `window.__TAURI__`). |
| IPC broker | `src/engine/iframeBroker.ts` (pure: decode → permission-gate → clamp) wired by `IframeGameShell`, which authenticates by **`event.source` identity**, never `event.origin` (a sandboxed frame's origin is `"null"`). Reuses the native emit path (`eventBus`). |
| Asset protocol | `plugin://localhost/<id>/<path>` served by `src-tauri/src/plugin_protocol.rs`, scoped per-plugin with lexical `..` rejection + a canonicalize symlink guard, and its own near-total content CSP. |
| Manifest schema | `PluginManifest` gains `trust` and `permissions` (`needsGoldAPI`, `needsArtifactLedger`); `src/engine/manifest.ts` parses/validates untrusted manifests into `ExternalPlugin`. |

### Capability audit (`src-tauri/capabilities/game-window.json`)

For the record, since ADR 0001 flagged capability inheritance as a blocker and
this ADR resolves it differently than ADR 0001 proposed. The `game-window`
capability (matches all `game-*` windows) grants:

| Permission | Scope | Notes |
|---|---|---|
| `core:default` | Baseline safe set | — |
| `core:window:allow-set-always-on-top` / `-close` / `-destroy` / `-start-dragging` | This window | Pop-out chrome (pin, close, drag). |
| `core:event:allow-emit` / `-listen` | App-wide event bus | How shells credit gold/crystals/artifacts to the hub. |
| `fs:allow-app-read-recursive` | **All of `AppData`** | Read every game's save + `hub.json`. |
| `fs:allow-app-write-recursive` | **All of `AppData`** | Write every game's save + `hub.json`. |
| `fs:allow-app-meta-recursive` | **All of `AppData`** | Metadata/stat. |

The `fs:*-recursive` and `event:allow-emit` grants are broad — a plugin running
in this webview could read/overwrite any game's save and emit any event.

**This is accepted, by design, and left unchanged.** These capabilities are only
ever inherited by **Tier-1 (trusted, allowlisted built-in)** plugins, which run
natively in the webview. Tier 1 *is* full trust — the built-ins already share
`hub.json` and each other's save directory as normal operation.

ADR 0001 proposed narrowing this into a restricted per-plugin capability set
(its option 1). This ADR **rejects that path**: Tier-2 (untrusted) plugins never
inherit the `game-window` set at all — they run in a sandboxed, opaque-origin
iframe with no `window.__TAURI__`, so no Tauri capability (broad or narrow) is
reachable from them. Restricting the capability set would harden a surface that
untrusted code cannot touch, while adding friction for the trusted natives that
legitimately need it. The isolation boundary is the iframe, not the capability
file.

### Enforcement, top to bottom (Tier 2)

1. **Source identity** — only messages from the plugin's own `iframe.contentWindow` are considered.
2. **Shape** — `decodeIframeMessage` rejects anything not a known, well-typed request.
3. **Permission** — the broker denies any action whose manifest permission is absent.
4. **Clamp/namespace** — gold is floored and capped at `PLUGIN_LIMITS.goldPerTickMax`; artifact ids are namespaced under the plugin's own id, so a plugin cannot mint another game's artifact.

Covered by tests: `iframeBroker.test.ts`, `IframeGameShell.test.tsx` (incl. spoofed-source rejection), `manifest.test.ts`, and `plugin_protocol.rs` `#[cfg(test)]` (traversal/encoded-traversal/symlink/id-validation).

### Deferred (not in this slice)

- **Dynamic loader (issue #3):** scanning `AppData/plugins` and calling `parseManifest` per bundle is not wired; `parseManifest` and the `plugin://` protocol are ready for it. A DEV-only `srcdoc` fixture (`dev-sandbox`) exercises the Tier-2 path in the meantime.
- **Brokered save/load for Tier-2 state.** Only the two ADR-named permissions (gold, artifacts) are brokered; sandboxed plugins have no persistence yet.
- **Signature-based Tier-1 promotion** (see mechanism above).

## References

- [ADR 0001](./0001-workshop-plugin-sandbox.md)
- `CLAUDE.md` → "Steam Workshop / external plugin loading", "Tauri capabilities"
- `src-tauri/capabilities/game-window.json`
- `src-tauri/tauri.conf.json` (`security.csp`)
- `src/engine/pluginValidation.ts` (`PLUGIN_LIMITS`)
- `src/engine/eventBus.ts` (`gold-earned`)
