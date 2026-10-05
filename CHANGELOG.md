# Changelog

All notable changes to The Waiting Game are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Waiting in Line is now a grocery checkout** (was an amusement park). Same M/G/1 queue, less to manage: three lanes on the "what" axis (Regular / Express / Self-Checkout) and two permanent "how" upgrades (Bagger, Weekly Ad). Payouts cut roughly 30× (Regular ≈ 120 gold/hr, max ≈ 400/hr) — it's a Wait, not a money printer. Heat index, the Shade Canopy, and ride-themed copy are gone; the UI shows one "how busy" bar and a plain-language status line instead of ρ and rate chips. Code moved to `src/games/grocery-line/`; the plugin id stays `amusement-park` (frozen per ADR 0003). Rust command renamed `calculate_grocery_line_offline` and drops the `heat_index` param.

### Fixed

- **Waiting in Line upgrades no longer compound.** Queue parameters are derived from the active lane + owned upgrade levels on every read instead of being stored and multiplied by `apply`, so re-selecting an upgrade can't re-apply it. The active lane now shows as ✓ Active in the upgrade panel.

### Migration

- Amusement-park saves keep their queue length and served/abandoned counts, but ride and ride-upgrade purchases don't carry over; everyone restarts on the Regular Lane.

### Planned

Tracked as GitHub issues — see the [Steam/Workshop readiness milestone](https://github.com/obrien-k/waiting-game/issues):

- Dynamic `AppData/plugins` loader (remaining half of #3) — scan bundles and register them via `parseManifest`; the sandbox, broker, and `plugin://` protocol are already in place.
- `steam` Cargo feature, optional `steamworks` dependency, and `src-tauri/src/steam/` skeleton.
- `tauri-plugin-single-instance` for Steam relaunch / overlay.
- Asset-location convention (`src/assets/` vs `src-tauri/resources/`).
- Derive the UI version footer (`HubApp.tsx`) from the package manifest so it stops drifting on each release.

## [0.3.0] - 2026-07-05

### Added

- **Wait in Line for an Amusement Park** mini-game (#9) — fourth built-in. Unlike the completion-based games, it's a live queueing simulation (M/G/1-style): guests arrive, rides serve them from the queue, and gold is earned per guest served rather than per completion. "What" axis picks the ride (carousel / coaster / waterslide); throughput scales with the "how" upgrades. (Has an open hydration bug — see #10.)
- **Artifact ecosystem — the Garden** (Phase 1, plant-grow only). Completing a plant now mints a collectible flora artifact; the hub grows a **Garden** panel showing each species with a live `×count`, and not-yet-grown species as dimmed silhouettes. Hoard model — counts aggregate in a Rust `ArtifactLedger` so `hub.json` stays small. Rides the existing crystal-crediting path (game emits `artifact-earned` → hub-only listener credits → all windows mirror), so no `plugin.tick` signature change. Extensible: a game joins by declaring an `artifactCatalog` and returning `artifactId` from `tick` — no hub/Rust changes needed for the next category (fauna→Aquarium, …).
- **Game unlocking** — cards are gated behind a gold cost (`UNLOCK_COSTS`: plant-grow 1,000 · paint-dry 5,000 · amusement-park 15,000; water-boil free) and unlocked via a Rust `unlock_game` command that debits gold atomically.
- **Repeatable upgrades with cost scaling** — upgrades can now level up beyond one purchase, priced `cost × scaling^level`. Ownership is a flat id list; a level is derived by counting duplicates (`getOwnedInstances`), keeping saves format-stable.
- **Two-tier plugin sandbox — implementation of [ADR 0002](docs/adr/0002-two-tier-plugin-sandbox.md)** (#3). Every registry entry is now a native `MiniGamePlugin` (Tier 1, allowlisted built-ins, full capabilities) or an `ExternalPlugin` (Tier 2, always sandboxed). Tier 2 renders in `<iframe sandbox="allow-scripts">` — no `window.__TAURI__`, no filesystem — and reaches privileged actions only through a `postMessage` broker (`src/engine/iframeBroker.ts`) that authenticates by message **source identity** (never the spoofable `"null"` origin), denies undeclared permissions, floors+clamps gold to `goldPerTickMax`, and namespaces minted artifacts under the plugin's own id. Assets are served by a new `plugin://` Tauri protocol (`src-tauri/src/plugin_protocol.rs`) scoped per-plugin with `..`/symlink escape blocked. Manifest schema gains `trust` + `permissions` (`needsGoldAPI`, `needsArtifactLedger`). Trust-tier assignment is a hardcoded allowlist today (signature check is the documented future path). A DEV-only `dev-sandbox` fixture exercises the Tier-2 path. The dynamic `AppData/plugins` loader remains deferred (parser + protocol are ready for it).

### Changed

- **[ADR 0002](docs/adr/0002-two-tier-plugin-sandbox.md) accepted _and implemented_** — two-tier plugin trust model (staff-approved native vs community sandboxed iframe with a `postMessage` broker). Supersedes ADR 0001.

### Fixed

- **Gold no longer truncates on live completions.** The per-tick gold ceiling (`goldPerTickMax`) was 50 — below legitimate completion payouts — so watching a rose complete credited 50 instead of 75, and an oak 50 instead of 500, while the offline path paid full. Raised to the completion ceiling (500) so online matches offline; a regression test pins `goldPerTickMax ≥ goldPerCompletion.max`.
- **Amusement Park: NaN queue counter / inert game** (#10, partial). `hydrateState` now runs saved state through `clampState`, healing a non-finite `queueLength` (a corrupt `null` save) back to a sane value, and `tick` re-clamps so one bad value can't propagate. (Residual: `totalServed`/`abandoned` aren't yet clamped — tracked on #10.)
- **Async plugin hydration + crash containment** (#11) — `hydrateState` is awaited so state can't become a `Promise`, and a plugin that throws is contained rather than blanking its window.
- **Real Content-Security-Policy** (#2). `security.csp` is no longer `null`: a strict production policy (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `plugin:` only for `img`/`media`/`frame`) plus a Vite-friendly `security.devCsp`. Closes the open XSS→IPC surface ADR 0001/0002 flagged.

## [0.2.3] - 2026-06-27

### Changed

- **Water-boil visual overhaul ("chrome-job")** — replaced the flat emoji pot + plain thermometer with a layered SVG chrome kettle: metallic body with specular highlight and rim light, a glass water tank that fills and shifts hue cold→hot, bubbles that rise faster as it nears boil, a wattage-driven burner bloom, and volumetric blurred steam. Pure SVG + CSS, no image assets. Hub card thumbnail gets a matching mini chrome kettle.

### Removed

- `TemperatureGauge` component — superseded by the kettle's glass tank; it had no other callers.

## [0.2.2] - 2026-06-27

### Added

- **Watching a Plant Grow** mini-game (#7) — third built-in, on the two-axis model. "What" axis: ryegrass / sunflower / rose bush species; "how" axis: windowsill / daily watering / fertilizer / greenhouse. Hard-mode Oak Sapling (2-day grow → 💎), gated behind the greenhouse. The plant scales up and steps through seed → sprout → species growth stages as it matures.
- `[DEV] Fast Grow` dev-only plugin — ~1s growth for watching hub previews and gold sync tick live.

## [0.2.1] - 2026-06-27

### Added

- **Watching Paint Dry** mini-game (#8) — second built-in, built on the two-axis model. "What" axis: emulsion / matte / gloss paint types; "how" axis: still air / box fan / dehumidifier / heat lamp drying conditions. Hard-mode Marine Enamel (2-day cure → 💎), gated behind the heat lamp.
- `[DEV] Fast Paint` dev-only plugin — cranks the drying multiplier so coats finish in ~1s, for watching hub previews and gold sync tick live.
- Hub now unions saved installs with current built-ins on hydration, so games shipped after a save was written still appear.

### Changed

- Hard-mode variant floor raised from 1 hour to **2 days** (`baseDurationSeconds ≥ 172,800`); 2–3 days is the intended range. No shipping variant was affected.

## [0.2.0] - 2026-06-27

### Added

- Two-axis upgrade model: a "what" tree (selects the active `GameVariant`) and a "how" tree (multiplies speed).
- Crystal (💎) prestige currency, earned one-per-completion from hard-mode variants.
- Hard-mode variants (≥1h duration, near-cap gold, crystal reward) with purple treatment and 💎 badge.
- Big-screen mode for game windows.
- `src/games/_template/` scaffold and README for authoring new mini-games.
- Plugin validation (`assertPlugin`) running at module load.
- `.gitattributes` with `eol=lf` and Git LFS patterns for binary assets (`.png .jpg .wav .ogg .mp3`).
- Steam build-artifact gitignore rules and `STEAM_SDK_LOCATION` env-var convention.

### Changed

- Version synced to `0.2.0` across `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `Cargo.lock`.

### Fixed

- `npm run build` type-check: added `src/vite-env.d.ts` so `import.meta.env` (the dev-mode game gate) type-checks. The build had been red since the dev-gate was introduced.

## [0.1.0]

### Added

- Initial implementation: Tauri v2 hub window with pop-out floating game windows, the `water-boil` reference mini-game, the `MiniGamePlugin` system, 250 ms `setInterval` ticker, cross-window broadcast/event channels, and the AppData save/load system with offline-progress calculation.

[Unreleased]: https://github.com/obrien-k/waiting-game/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/obrien-k/waiting-game/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/obrien-k/waiting-game/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/obrien-k/waiting-game/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/obrien-k/waiting-game/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/obrien-k/waiting-game/releases/tag/v0.2.0
