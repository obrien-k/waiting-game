# The Waiting Game

Idle mini-games for your desktop, each one a small act of patience: pop a **Wait** out of the hub into its own floating window, let it run on top of your other apps, and come back to find it finished. The simulations underneath are real — thermodynamics, evaporation physics, queueing theory — so the waiting is honest.

> ### 🎮 Just here to play?
> You don't need anything on this page. Grab the game from:
> - **[itch.io → The Waiting Game](https://korinb.itch.io/waiting-game)**
> - **[GitHub Releases](https://github.com/obrien-k/waiting-game/releases)** (macOS / Windows / Linux installers)
>
> Everything below is for developers building the game or writing plugins for it.

Built with [Tauri v2](https://tauri.app), [React 18](https://react.dev), [TypeScript](https://www.typescriptlang.org), and [Tailwind CSS v4](https://tailwindcss.com).

---

## The Waits

| Wait | The idiom | The model underneath |
|---|---|---|
| **Waiting for Water to Boil** | a watched pot never boils | Real thermodynamics: `Q = m·c·ΔT`, pots and heaters in litres and watts. Gold per boil scales with volume², so bigger pots improve your *rate*, not just the payout. |
| **Waiting for Paint to Dry** | like watching paint dry | An evaporation model — saturation vapour pressure, convective mass transfer, film thickness. Upgrades set *real conditions* (airflow, humidity, heat), not multipliers. |
| **Waiting for a Plant to Grow** | like watching grass grow | Species from ryegrass to a two-day oak. Grown plants join your **Garden**, a collection shelf in the hub. |
| **Waiting in Line** | the other line always moves faster | A stochastic M/G/1 queue (Poisson arrivals, Pareto service times) simulated in Rust — manage rides, heat, and crowds. |

Shared systems: **Gold ◈** buys upgrades along two axes per game (*what* you're waiting for, *how* fast it goes). **Crystals 💎** are a prestige currency — exactly one per hard-mode completion, and hard modes are fixed real-time grinds (the two-day oak takes two days, no matter what you own). Collections (Garden, Menagerie, Cabinet, Trophy Shelf) reveal themselves in the hub as you fill them. Progress continues while the app is closed — every game computes offline progress on load.

---

## Development

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Tauri CLI | v2 | installed automatically via `npm install` |

On macOS you'll also need Xcode Command Line Tools: `xcode-select --install`.

### Run it

```bash
git clone https://github.com/obrien-k/waiting-game.git
cd waiting-game
npm install
npm run tauri dev     # Vite dev server + the app, with HMR
```

### Test it

```bash
npm test                          # vitest (engines, broker, shells)
cd src-tauri && cargo test        # Rust (queue math, plugin protocol scoping)
```

Dev builds add tooling that never ships in production:

- **🧪 Cheat panel** (bottom of every game window and big-screen view): grant gold/crystals, mint artifacts, **time-warp** (rewinds the save's timestamps and re-runs the real `hydrateState`, so you're testing the production offline-progress path), and a raw state-JSON editor.
- **Unlock All** / **Reset Progress** buttons in the hub header.
- `[DEV]` fixture games (expedited variants of each Wait, plus a sandboxed Tier-2 demo).

### Build it

```bash
npm run tauri build   # packaged app in src-tauri/target/release/bundle/
```

> **macOS note:** if `cargo` is not on your PATH, run `. ~/.cargo/env` first.

---

## Writing a Wait (plugin authoring)

Copy **`src/games/_template/`** and follow its [README](src/games/_template/README.md) — it walks through the whole thing. The short version:

1. **Engine file** — pure functions, no React: `getInitialState`, `hydrateState` (must call `calculateOfflineProgress`), `tick`, upgrade definitions.
2. **Component file** — React, receives `PluginComponentProps`.
3. **`index.ts`** — assembles the `MiniGamePlugin`:

```ts
interface MiniGamePlugin {
  id: string;            // frozen forever — keys saves, unlocks, artifacts
  name: string;          // follows the "Waiting …" title frame (ADR 0003)
  description: string;
  version: string;
  getInitialState(): unknown;
  hydrateState(raw: unknown): unknown | Promise<unknown>;
  tick(state: unknown, deltaMs: number): TickResult;   // { next, goldEarned, crystalsEarned, artifactId? }
  Component: React.ComponentType<PluginComponentProps>;
  CardThumbnail?: React.ComponentType<{ state: unknown }>;
  upgrades: UpgradeDef[];
  variants?: GameVariant[];                 // the "what" axis; hard modes award 1 💎
  artifactCatalog?: ArtifactCatalogEntry[]; // collectibles for the hub shelves
  reset?(state: unknown): unknown;
}
```

4. **Register in two files**: add the plugin to `BUILTIN_PLUGINS` in `src/store/gameRegistry.ts` and its id to `DEFAULT_INSTALLED_GAME_IDS` in `src/store/hubStore.ts`.

Rules the engine enforces (`assertPlugin` at load): JSON-serializable state, `ownedUpgradeIds: string[]` on state, tick caps from `src/engine/pluginValidation.ts`, hard-mode variants ≥ 2 days. The tick loop is `setInterval` at 250 ms (not rAF — it must keep ticking in unfocused windows).

### Third-party / workshop plugins

Dynamically loaded plugins are **Tier 2**: they run in a sandboxed iframe with no filesystem and no Tauri access, talking to the host only through a permission-gated postMessage broker; assets are served by a strictly-scoped `plugin://` protocol. The manifest format (`src/games/_template/manifest.json`) is stable. See [ADR 0002](docs/adr/0002-two-tier-plugin-sandbox.md) for the full trust model.

---

## Architecture

Two window types share one codebase — `main.tsx` checks the Tauri window label at startup:

| Window | Renders | Source |
|---|---|---|
| `main` (hub) | game grid, live card previews, collection shelves, big-screen view | `src/hub/` |
| `game-<id>` (pop-outs) | one Wait in a frameless always-on-top window | `src/game-window/` |

Cross-window traffic: `BroadcastChannel` for high-frequency tick previews and gold display sync; Tauri events for crediting (gold/crystals/artifacts) and lifecycle. Gold and crystal ledgers live in Rust (`src-tauri/src/state.rs`) — the single writer across all windows. Saves go to `AppData` (`saves/<gameId>.json` + `hub.json`), auto-saved every 30 s and on window close.

```
waiting-game/
├── src/
│   ├── engine/          # ticker, save/load, event bus, upgrades, validation,
│   │                    # manifest parsing, iframe broker, trust tiers
│   ├── store/           # zustand stores: hub state, game registry
│   ├── hub/             # hub window: grid, cards, collection shelves
│   ├── game-window/     # shells: native pop-out, inline big-screen, Tier-2 iframe
│   ├── games/           # one folder per Wait + _template + [DEV] fixtures
│   └── components/      # shared UI (UpgradePanel, displays, dev cheat panel)
├── src-tauri/
│   ├── capabilities/    # per-window-type Tauri permissions
│   └── src/             # gold/crystal/artifact ledgers, queue simulation,
│                        # plugin:// asset protocol
└── docs/adr/            # architecture decision records
```

More depth: [CLAUDE.md](CLAUDE.md) (working notes and gotchas), [docs/adr/](docs/adr/) (decisions), [CHANGELOG.md](CHANGELOG.md).

---

## License

[MIT](LICENSE)
