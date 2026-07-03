# ADR 0002: Two-tier plugin sandbox & trust model

- **Status:** Accepted
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

## References

- [ADR 0001](./0001-workshop-plugin-sandbox.md)
- `CLAUDE.md` → "Steam Workshop / external plugin loading", "Tauri capabilities"
- `src-tauri/capabilities/game-window.json`
- `src-tauri/tauri.conf.json` (`security.csp`)
- `src/engine/pluginValidation.ts` (`PLUGIN_LIMITS`)
- `src/engine/eventBus.ts` (`gold-earned`)
