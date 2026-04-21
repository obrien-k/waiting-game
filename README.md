# The Waiting Game

A collection of idle mini-games for your desktop. Keep them floating on top of your other apps while you work, or play them full-screen in the hub.

Built with [Tauri v2](https://tauri.app), [React 18](https://react.dev), [TypeScript](https://www.typescriptlang.org), and [Tailwind CSS v4](https://tailwindcss.com).

---

## Games

### Waiting for Water to Boil

Physics-accurate kettle simulation. Water heats according to **Q = m × c × ΔT** (c = 4,182 J/kg·°C). Buy bigger pots and stronger heat sources to boil faster and earn more gold.

| Upgrade | Cost | Effect |
|---------|------|--------|
| Small Pot | free | 0.5 L |
| Medium Pot | 50 ◈ | 1.0 L |
| Large Pot | 200 ◈ | 2.0 L |
| Candle | free | 50 W |
| Gas Stove | 100 ◈ | 3,500 W |
| Electric Hob | 500 ◈ | 1,000 W |
| Induction Cooktop | 2,000 ◈ | 3,000 W |

Gold earned per boil = pot volume in litres × 10.

---

## Installing

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Tauri CLI | v2 | installed automatically via `npm install` |

On macOS you'll also need Xcode Command Line Tools:

```
xcode-select --install
```

### Setup

```bash
git clone https://github.com/yourname/waiting-game.git
cd waiting-game
npm install
```

### Development

```bash
npm run tauri dev
```

This starts the Vite dev server and opens the app. Hot-module replacement is active — changes to React components appear instantly without restarting Tauri.

### Production build

```bash
npm run tauri build
```

The packaged app appears in `src-tauri/target/release/bundle/`.

> **macOS note:** If `cargo` is not on your PATH, run `. ~/.cargo/env` first or add `~/.cargo/bin` to your shell profile.

---

## Creating a Mini-Game

Every game — including the built-in ones — is a plugin that implements the `MiniGamePlugin` interface. Custom games ship as a folder containing a `manifest.json` and a JavaScript module.

### 1. The plugin interface

Your game must export a default object conforming to:

```ts
interface MiniGamePlugin {
  readonly id: string;          // unique, kebab-case, e.g. "my-game"
  readonly name: string;        // display name shown in the hub
  readonly description: string;
  readonly version: string;     // semver

  // Return the initial state for a new game (no save file)
  getInitialState(): unknown;

  // Receive raw JSON from a save file, return a valid state
  // Use this to add defaults for fields added in newer versions
  hydrateState(raw: unknown): unknown;

  // Pure function: given state + elapsed ms, return next state + gold earned
  // Must NOT mutate state. Called up to 60 times per second.
  tick(state: unknown, deltaMs: number): { next: unknown; goldEarned: number };

  // The full-screen React component rendered inside the pop-out window
  Component: React.ComponentType<PluginComponentProps>;

  // Optional: compact preview shown on the hub grid card
  CardThumbnail?: React.ComponentType<{ state: unknown }>;

  // Upgrade definitions (empty array if none)
  upgrades: UpgradeDef[];

  // Optional: reset to a fresh round while preserving upgrades
  reset?: (state: unknown) => unknown;
}
```

`PluginComponentProps` passed to your component:

```ts
interface PluginComponentProps {
  state: unknown;                           // current game state
  onUpgradePurchase: (id: string) => void; // call to buy an upgrade
  onReset?: () => void;                    // call to reset the round
  isPopOut: boolean;                       // true when in its own window
}
```

### 2. Upgrade definitions

Each upgrade is a pure function that transforms state:

```ts
interface UpgradeDef {
  id: string;          // unique within your game
  label: string;
  description: string;
  cost: number;        // gold cost
  maxLevel: number;    // 1 for one-shot upgrades, higher for stackable
  requires?: string[]; // IDs of prerequisite upgrades
  apply: (state: unknown, level: number) => unknown;
}
```

The engine handles affordability checks, prerequisite validation, and gold deduction. Your `apply` function just returns the updated state.

### 3. State conventions

Your state must be JSON-serializable (it gets saved to disk). Track which upgrades are owned via an `ownedUpgradeIds: string[]` field — the shell uses this array to apply upgrades when purchases happen:

```ts
interface MyGameState {
  // your fields
  score: number;
  multiplier: number;

  // required by the engine's upgrade system
  ownedUpgradeIds: string[];
  lastSaveAt: number; // Date.now() — used for offline progress
}
```

### 4. The manifest

Create a `manifest.json` alongside your module:

```json
{
  "id": "my-game",
  "name": "My Idle Game",
  "version": "1.0.0",
  "description": "A short description",
  "author": "Your Name",
  "minEngineVersion": "1.0.0",
  "entry": "index.js",
  "windowSize": { "width": 420, "height": 660 },
  "tags": ["chill", "numbers"]
}
```

### 5. Minimal example

```ts
// my-game/index.ts
import type { MiniGamePlugin } from "@/engine/types"; // or copy the types

interface State {
  count: number;
  perSecond: number;
  ownedUpgradeIds: string[];
  lastSaveAt: number;
}

const MyGame: MiniGamePlugin = {
  id: "my-game",
  name: "My Idle Game",
  description: "Numbers go up",
  version: "1.0.0",

  getInitialState(): State {
    return { count: 0, perSecond: 1, ownedUpgradeIds: [], lastSaveAt: Date.now() };
  },

  hydrateState(raw): State {
    const s = raw as Partial<State>;
    return {
      count: s.count ?? 0,
      perSecond: s.perSecond ?? 1,
      ownedUpgradeIds: s.ownedUpgradeIds ?? [],
      lastSaveAt: s.lastSaveAt ?? Date.now(),
    };
  },

  tick(state, deltaMs) {
    const s = state as State;
    const gained = (s.perSecond * deltaMs) / 1000;
    return {
      next: { ...s, count: s.count + gained },
      goldEarned: gained * 0.01, // earn gold proportional to count rate
    };
  },

  upgrades: [
    {
      id: "double-speed",
      label: "Double Speed",
      description: "2× per-second rate",
      cost: 100,
      maxLevel: 5,
      apply: (state, level) => ({
        ...(state as State),
        perSecond: Math.pow(2, level),
      }),
    },
  ],

  Component: ({ state, onUpgradePurchase }) => {
    const s = state as State;
    return (
      <div style={{ padding: 24, color: "white" }}>
        <h2>{s.count.toFixed(0)} things</h2>
        <p>{s.perSecond}/s</p>
        <button onClick={() => onUpgradePurchase("double-speed")}>
          Double Speed (100 ◈)
        </button>
      </div>
    );
  },
};

export default MyGame;
```

### 6. Installing a custom game (coming soon)

User-installable games will be loaded from:

```
~/Library/Application Support/com.kyleobrien.waitinggame/plugins/{game-id}/
```

Click **+ Install Game** on the hub grid, select your game folder, and it will be registered automatically. This feature is planned for v0.2.

---

## Project structure

```
waiting-game/
├── src/
│   ├── engine/          # Core engine: ticker, save/load, events, upgrades, currency
│   ├── store/           # Zustand stores: hub (gold, game list), game registry
│   ├── hub/             # Main hub window: game grid, cards, header
│   ├── game-window/     # Pop-out window shell: title bar, always-on-top toggle
│   ├── games/
│   │   └── water-boil/  # Built-in mini-idler (reference plugin implementation)
│   └── components/      # Shared UI: TemperatureGauge, ProgressBar, UpgradePanel
└── src-tauri/           # Rust/Tauri backend: window management, file system
```

---

## License

[MIT](LICENSE)
