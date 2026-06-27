# ADR 0001: Workshop plugin sandbox & permission model

- **Status:** Proposed (open decision — blocks Workshop launch)
- **Date:** 2026-06-27
- **Deciders:** @obrien-k

## Context

The Waiting Game is designed to load third-party mini-games as plugins, eventually
distributed through Steam Workshop. The plugin format in
`src/games/_template/manifest.json` is already runtime-load compatible: when the
Workshop ships, `gameRegistry.ts` will scan `AppData/plugins/*/manifest.json` and
dynamically import each bundle.

Two facts make this a security-sensitive decision rather than a routine feature:

1. **No CSP.** `security.csp` in `src-tauri/tauri.conf.json` is currently `null`.
   With no Content-Security-Policy, any markup a plugin renders is an open
   XSS surface — and in a Tauri app, XSS can reach the IPC bridge.

2. **Full capability inheritance.** Plugins run inside the `game-window` Tauri
   capability set (`src-tauri/capabilities/game-window.json`), which grants
   filesystem read/write to `AppData` and event IPC. A malicious Workshop plugin
   would therefore get full access to every game's save data and the IPC surface.

Shipping Workshop loading without addressing both would expose every player who
installs community content.

## Decision

**Open — not yet decided.** This ADR records the constraint and the option space so
the decision is made deliberately before any dynamic plugin loading lands, rather
than defaulted into by shipping `gameRegistry.ts` scanning.

No dynamic/external plugin loading may merge until this ADR moves to *Accepted*.

## Options under consideration

1. **Locked-down per-plugin capabilities** — generate a narrow Tauri capability set
   per plugin label, scoped to a plugin-private `AppData/plugins/<id>/` directory,
   with no access to other games' saves or broad IPC.
2. **Sandboxed iframe / isolated origin** — render plugin UI in an isolated context
   with a strict CSP, brokering all privileged actions through a vetted message API
   instead of direct IPC.
3. **Review-gated, no runtime sandbox** — rely on Workshop curation/signing and a
   strict CSP, accepting that approved plugins run trusted. Lower engineering cost,
   higher trust assumption.

## Consequences

- A real CSP must be defined regardless of which option wins (tracked as its own issue).
- The `manifest.json` schema may need permission-declaration fields; changing it has
  to account for the runtime-loading path documented in `CLAUDE.md`.
- Until *Accepted*, Workshop loading stays behind the static `BUILTIN_PLUGINS` import.

## References

- `CLAUDE.md` → "Steam Workshop / external plugin loading", "Tauri capabilities"
- `src-tauri/capabilities/game-window.json`
- `src-tauri/tauri.conf.json` (`security.csp`)
