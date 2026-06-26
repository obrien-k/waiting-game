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

### Testing gameplay without waiting

In dev mode a **`[DEV] Fast Boil`** card appears in the hub. It uses a 50,000 W heater so the pot reaches 100 °C in roughly 3 seconds. Use it to exercise the full loop end-to-end:

1. Click **⎋ Pop out** on the Dev Fast Boil card
2. Watch the temperature bar rise, hear the gold ding, click **Refill & Restart**
3. Verify the hub card's live preview updates and gold accumulates

This game is gated behind `import.meta.env.DEV` and is completely excluded from production builds.

### Production build

```bash
npm run tauri build
```

The packaged app appears in `src-tauri/target/release/bundle/`.

> **macOS note:** If `cargo` is not on your PATH, run `. ~/.cargo/env` first or add `~/.cargo/bin` to your shell profile.

---

## Creating a Mini-Game

Every game is a plugin implementing the `MiniGamePlugin` interface. Adding one requires changes to two registry files plus the game folder itself — there is no runtime loader yet (planned for v0.2).

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

### 4. Register the game

**`src/store/gameRegistry.ts`** — add to the plugin list:
```ts
import myPlugin from "@/games/my-game";
const BUILTIN_PLUGINS = [waterBoilPlugin, myPlugin];
```

**`src/store/hubStore.ts`** — add the ID so a card appears in the hub:
```ts
installedGameIds: ["water-boil", "my-game"],
```

For dev-only games (testing, experiments) wrap both additions in `import.meta.env.DEV ? [...] : []` / a conditional — see `src/games/dev-instant/` for the pattern.

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
│   │   ├── water-boil/  # "Waiting for Water to Boil" (reference implementation)
│   │   └── dev-instant/ # [DEV] Fast Boil — dev-only test game (excluded from prod)
│   └── components/      # Shared UI: TemperatureGauge, ProgressBar, UpgradePanel
└── src-tauri/
    ├── capabilities/
    │   ├── main-window.json   # Tauri permissions for the hub window
    │   └── game-window.json   # Tauri permissions for game pop-outs (label: "game-*")
    └── src/             # Rust entry point (minimal — no custom commands yet)
```

---

## License

[MIT](LICENSE)
