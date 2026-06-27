# Changelog

All notable changes to The Waiting Game are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Hard-mode variant floor raised from 1 hour to **2 days** (`baseDurationSeconds ≥ 172,800`); 2–3 days is the intended range. No shipping variant was affected (none defined yet).

### Planned

Tracked as GitHub issues — see the [Steam/Workshop readiness milestone](https://github.com/obrien-k/waiting-game/issues):

- Real Content-Security-Policy (replace `security.csp = null`) before any external/Workshop content loads.
- Workshop plugin sandbox / permission model — see [ADR 0001](docs/adr/0001-workshop-plugin-sandbox.md).
- `steam` Cargo feature, optional `steamworks` dependency, and `src-tauri/src/steam/` skeleton.
- `tauri-plugin-single-instance` for Steam relaunch / overlay.
- Asset-location convention (`src/assets/` vs `src-tauri/resources/`).

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

[Unreleased]: https://github.com/obrien-k/waiting-game/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/obrien-k/waiting-game/releases/tag/v0.2.0
