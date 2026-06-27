# Changelog

All notable changes to The Waiting Game are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

Tracked as GitHub issues — see the [Steam/Workshop readiness milestone](https://github.com/obrien-k/waiting-game/issues):

- Real Content-Security-Policy (replace `security.csp = null`) before any external/Workshop content loads.
- Workshop plugin sandbox / permission model — see [ADR 0001](docs/adr/0001-workshop-plugin-sandbox.md).
- `steam` Cargo feature, optional `steamworks` dependency, and `src-tauri/src/steam/` skeleton.
- `tauri-plugin-single-instance` for Steam relaunch / overlay.
- Asset-location convention (`src/assets/` vs `src-tauri/resources/`).
- Remaining idea-backlog game: Wait in Line for an Amusement Park (#9).

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

[Unreleased]: https://github.com/obrien-k/waiting-game/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/obrien-k/waiting-game/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/obrien-k/waiting-game/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/obrien-k/waiting-game/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/obrien-k/waiting-game/releases/tag/v0.2.0
