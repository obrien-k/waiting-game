# CLAUDE.md — The Waiting Game

## What this is

A Tauri v2 desktop app where players run idle mini-games in floating pop-out windows. The hub window shows a grid of game cards with live previews; each card can be popped out into its own frameless window that ticks independently.

Stack: React + TypeScript + Tailwind (v4, `@theme` block in `globals.css`) + Tauri v2.

---

## Architecture

### Window model

| Window label | Renders | Entry point |
|---|---|---|
| `main` | `HubApp` | `src/hub/` |
| `game-<id>` | `GameWindowApp → GameWindowShell` | `src/game-window/` |

`main.tsx` bootstraps both: it reads `getCurrentWindow().label` at startup and lazy-imports the right root component.

### Plugin system

Every mini-game is a `MiniGamePlugin` (see `src/engine/types.ts`). Register plugins in `src/store/gameRegistry.ts` and add their IDs to `installedGameIds` in `src/store/hubStore.ts`.

**Required interface:**
```ts
interface MiniGamePlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  getInitialState(): unknown;
  hydrateState(raw: unknown): unknown;   // must call calculateOfflineProgress here
  tick(state: unknown, deltaMs: number): { next: unknown; goldEarned: number };
  reset?(state: unknown): unknown;
  Component: React.ComponentType<PluginComponentProps>;
  CardThumbnail?: React.ComponentType<{ state: unknown }>;
  upgrades: UpgradeDef[];
}
```

See `src/games/water-boil/` for the reference implementation. The engine file (`waterBoilEngine.ts`) is pure functions with no React; the component file imports from it.

### Ticker

`src/engine/ticker.ts` uses **`setInterval` at 250 ms**, not `requestAnimationFrame`. RAF pauses when the window loses focus; setInterval does not. Always use `GameTicker` from the shell — don't roll your own loop.

### Cross-window communication

Two channels, two purposes:

| Channel | Mechanism | Frequency | Purpose |
|---|---|---|---|
| `waiting-game-ticks` | `BroadcastChannel` | Every tick (250 ms) | Hub card live previews |
| `waiting-game-gold` | `BroadcastChannel` | On change | Gold balance sync |
| `gold-earned` | Tauri event (`emit/listen`) | On boil | Crediting gold to hub |
| `offline-message` | Tauri event | On hydration | "You earned X while away" banner |

`BroadcastChannel` is same-origin only and works without Tauri permissions. Tauri events cross the Tauri IPC boundary and require capability entries.

### Save system

`src/engine/saveLoad.ts` writes to `AppData`:
- Per-game state: `saves/<gameId>.json`
- Hub gold/meta: `hub.json`

Auto-save runs every 30 s in `GameWindowShell`. Save also fires on window close via `tauri://close-requested`. The `hydrateState` hook is where offline progress is calculated — always call `calculateOfflineProgress(base, Date.now())` there.

### Upgrade system

Upgrades are stored as `ownedUpgradeIds: string[]` on game state (not a separate store). The `apply` function on each `UpgradeDef` mutates state directly — it must spread and return the full state object.

---

## Key gotchas

### Window closing

Use `destroy()` not `close()` when dismissing a game window. Calling `close()` fires `tauri://close-requested`, which the shell listens to — that listener also calls `close()`, creating a double-save loop. `destroy()` closes immediately without re-firing the event.

The `tauri://close-requested` listener is for OS-level close signals only (Cmd+W, force-quit). Both paths (`handleClose` button and the OS listener) must emit `emitWindowClosed(plugin.id)` before destroying, so the hub store can flip `openWindowIds` back to `false` and re-enable the "Pop out" button.

### Window dragging

**Do NOT use `data-tauri-drag-region` on a div that also contains buttons.** Tauri's drag handler intercepts mousedown on the entire subtree, preventing button clicks from firing.

Instead, call `getCurrentWindow().startDragging()` in an `onMouseDown` handler on the title text element only:

```tsx
async function handleTitleDragStart(e: MouseEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  await getCurrentWindow().startDragging();
}

<span onMouseDown={handleTitleDragStart} className="cursor-move flex-1 ...">
  {plugin.name}
</span>
```

Requires `core:window:allow-start-dragging` in `src-tauri/capabilities/game-window.json`.

### Tauri capabilities

Game windows use `src-tauri/capabilities/game-window.json` (matches `game-*` labels). If a Tauri API call silently does nothing in a game window, check that the required permission is listed there.

### Dev mode gate

The `[DEV] Fast Boil` game is only registered in development. The pattern:

```ts
// gameRegistry.ts
const BUILTIN_PLUGINS = [
  waterBoilPlugin,
  ...(import.meta.env.DEV ? [devInstantPlugin] : []),
];

// hubStore.ts
installedGameIds: import.meta.env.DEV
  ? ["water-boil", "dev-instant"]
  : ["water-boil"],
```

Both files must be updated together — the registry controls routing, the hub store controls which cards appear.

### Two-axis upgrade model

Every game has two independent upgrade trees. This is load-bearing — don't flatten them into a single list.

| Axis | What it does | State field modified |
|---|---|---|
| **What** | Selects which `GameVariant` is active | `activeVariantId` |
| **How** | Multiplies the speed | `conditionMultiplier` |

`ratePerSecond = (1 / variant.baseDurationSeconds) × conditionMultiplier`

The "what" tree also resets `progress: 0` on switch (changing what you're waiting for starts over). The "how" tree never resets progress.

### Crystal currency

Crystals (`💎`) are a prestige currency earned only by completing hard-mode variants (`isHardMode: true`). Always exactly 1 per completion — never configurable, never more than 1. Enforced in both shells via `Math.min(crystalsEarned, 1)` before emitting. Crystals are never spent; they are a lifetime count in `hubStore.crystals`.

`CrystalDisplay` in the hub header is hidden until count > 0 (rare and notable).

### Hard mode variants

A `GameVariant` with `isHardMode: true`:
- Requires `baseDurationSeconds ≥ 3,600` (1 hour) — validated at startup
- Has `goldPerCompletion` near the 500 cap
- Awards 1 crystal on completion
- Renders with purple colour treatment and a 💎 badge in the UI
- Must be gated behind "how" upgrade prerequisites so players can't immediately access it

### Plugin validation

`assertPlugin(plugin)` runs at module load in `index.ts`. Throws in dev, warns in prod. Caps are in `src/engine/pluginValidation.ts` — change them there, not in individual games.

### Steam Workshop / external plugin loading

The manifest format in `src/games/_template/manifest.json` is already compatible with runtime loading. When the workshop ships, `gameRegistry.ts` will scan `AppData/plugins/*/manifest.json` and dynamically import each bundle instead of statically importing them. No other files need to change. Don't alter the manifest schema without considering this path.

### Adding a new game

Use `src/games/_template/` — copy the folder, edit the `THEME` block in `engine.ts`, customize upgrades, and register in two files. Full instructions in `src/games/_template/README.md`.

The short version: create `src/games/<slug>/` with at minimum:
   - `<slug>Engine.ts` — pure tick/state logic, exports `getInitialState`, `hydrateState`, `tick`, `calculateOfflineProgress`
   - `<slug>Game.tsx` — React component, receives `PluginComponentProps`
   - `index.ts` — assembles the `MiniGamePlugin` object

2. Register in `src/store/gameRegistry.ts` (add to `BUILTIN_PLUGINS`)

3. Add the ID to `installedGameIds` in `src/store/hubStore.ts`

No Rust changes needed for new games.

---

## Styling

Tailwind v4 with a custom `@theme` block in `src/styles/globals.css`. Use the CSS variables directly (`var(--color-surface)`, `var(--color-gold)`, etc.) rather than hardcoding hex values. Fonts: `--font-display` for UI text, `--font-mono` for numbers.
