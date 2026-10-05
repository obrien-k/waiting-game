# CLAUDE.md — The Waiting Game

## What this is

A Tauri v2 desktop app where players run idle mini-games in floating pop-out windows. The hub window shows a grid of game cards with live previews; each card can be popped out into its own frameless window that ticks independently.

Stack: React + TypeScript + Tailwind (v4, `@theme` block in `globals.css`) + Tauri v2.

---

## Nomenclature (ADR 0003)

One justified alignment — don't drift from it:

| Term | Meaning | Audience |
|---|---|---|
| **The Waiting Game** | the product; article always kept | everyone |
| **Wait** | one mini-game, in player-facing copy ("choose a Wait", "this Wait is popped out") | players |
| **plugin** | the code artifact behind a Wait | devs / workshop authors |
| **Pop out** | the verb for launching a Wait into its floating window | players |
| Garden / Menagerie / Cabinet / Trophy Shelf | collection shelves for `flora` / `fauna` / `relic` / `trophy`; hidden until non-empty | players |
| **artifact** | code/API term for a collectible; never player-facing | devs |

Titles follow the **"Waiting …"** frame: Waiting for Water to Boil, Waiting for Paint to Dry, Waiting for a Plant to Grow, Waiting in Line. New games (and the `_template` placeholder) must fit the frame. The boredom idioms live in card *descriptions*, idiom-led with a mechanical wink. Plugin IDs (`water-boil`, …) are frozen — they key saves, unlock costs, and artifact namespaces. Waiting in Line lives in `src/games/grocery-line/` but keeps the id `amusement-park` from before its re-theme.

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
  waterBoilPlugin, paintDryPlugin, plantGrowPlugin, groceryLinePlugin,
  ...(import.meta.env.DEV
    ? [devInstantPlugin, devPaintPlugin, devPlantPlugin, devSandboxPlugin]
    : []),
];

// hubStore.ts — DEFAULT_INSTALLED_GAME_IDS; hydrate() unions this with saved
// installs so newly-shipped games always appear.
const DEFAULT_INSTALLED_GAME_IDS = import.meta.env.DEV
  ? [...prodIds, "dev-instant", "dev-paint", "dev-plant", "dev-sandbox"]
  : ["water-boil", "paint-dry", "plant-grow", "amusement-park"];
```

Both files must be updated together — the registry controls routing, the hub store controls which cards appear.

### Two-axis upgrade model

Every game has two independent upgrade trees. This is load-bearing — don't flatten them into a single list.

| Axis | What it does | State field modified |
|---|---|---|
| **What** | Selects which `GameVariant` is active | `activeVariantId` (or, for water-boil, `potVolumeLiters`) |
| **How** | Sets the speed / conditions | `conditionMultiplier`, or real physical fields |

Rate depends on the game's model:
- **plant-grow** (abstract): `ratePerSecond = (1 / variant.baseDurationSeconds) × conditionMultiplier`
- **paint-dry** (physics): rate is derived from an evaporation model — the "how" upgrades set real conditions (`airVelocity`, `relHumidity`, `filmTempC`), not a multiplier. `baseDurationSeconds` is only a still-air reference + validation bound.
- **water-boil** (physics): rate from Joules; "what" = pot volume, "how" = heater watts. Gold per boil `= volume² × 20` (superlinear so a bigger pot improves gold-rate, not just cycle length).

**Unlock ≠ select.** Buying a grouped upgrade unlocks it; once owned, members of the same `group` (`"what"`/`"how"`, `"pot"`/`"heater"`) are freely re-selectable. Shells expose `onSelectUpgrade`, which re-runs `def.apply` with no gold cost and no ownership change; `UpgradePanel` renders owned members as **Select** / **✓ Active** using `activeUpgradeIds` from the game component. Don't gate selection behind a one-time purchase.

The "what" tree resets `progress: 0` **and** `isComplete: false` on switch (a fresh start). The "how" tree never resets progress. Pot switches in water-boil reset `currentTemp`/`isBoiling` (fresh cold water).

### Crystal currency

Crystals (`💎`) are a prestige currency earned only by completing hard-mode variants (`isHardMode: true`). Always exactly 1 per completion — never configurable, never more than 1. Enforced in both shells via `Math.min(crystalsEarned, 1)` before emitting. Crystals are never spent; they are a lifetime count in `hubStore.crystals`.

`CrystalDisplay` in the hub header is hidden until count > 0 (rare and notable).

### Hard mode variants

A `GameVariant` with `isHardMode: true`:
- Requires `baseDurationSeconds ≥ 172,800` (2 days) — validated at startup
- Has `goldPerCompletion` near the 500 cap
- Awards 1 crystal on completion
- Renders with purple colour treatment and a 💎 badge in the UI
- Must be gated behind "how" upgrade prerequisites so players can't immediately access it
- **Is immune to the speed multiplier / conditions** — hard mode is a fixed real-time grind (`rate = 1 / baseDurationSeconds`), so it always takes its full duration once unlocked. The unlock gate, not the rate, is what makes it "impossible" to reach early. (Without this, e.g. plant's 20× greenhouse turned the 2-day oak into ~2 h.)

### Plugin validation

`assertPlugin(plugin)` runs at module load in `index.ts`. Throws in dev, warns in prod. Caps are in `src/engine/pluginValidation.ts` — change them there, not in individual games.

### Steam Workshop / external plugin loading

The manifest format in `src/games/_template/manifest.json` is already compatible with runtime loading. When the workshop ships, `gameRegistry.ts` will scan the per-plugin `manifest.json` files under `AppData/plugins` (via `parseManifest` in `src/engine/manifest.ts`) and append the resulting `ExternalPlugin`s to `BUILTIN_PLUGINS`. No other files need to change. Don't alter the manifest schema without considering this path.

### Two-tier plugin sandbox (ADR 0002)

Every registry entry is a `RegisteredPlugin` = native `MiniGamePlugin` **or** `ExternalPlugin` (`kind: "external"`). `resolveTrustTier` (`src/engine/pluginTrust.ts`) decides the path; both `GameWindowApp` and the hub big-screen branch on it.

- **Tier 1 (trusted, allowlisted built-ins):** native React in `GameWindowShell` / `InlineGameShell`, full `game-window` capabilities.
- **Tier 2 (untrusted, everything dynamic):** `IframeGameShell` → `<iframe sandbox="allow-scripts">`. No `window.__TAURI__`, no fs. Privileged actions go through the `postMessage` broker.

Load-bearing rules — don't regress these:

- **Authenticate by `event.source`, never `event.origin`.** A sandboxed frame's origin is the string `"null"`. The broker only acts on messages whose `source === iframe.contentWindow`.
- **Broker is pure and lives in `src/engine/iframeBroker.ts`.** `IframeGameShell` is just wiring. All validation/clamping/permission-gating is there, unit-tested — keep it that way so the attack surface stays testable without a DOM.
- **Permissions are deny-by-default.** A Tier-2 action whose manifest permission (`needsGoldAPI` / `needsArtifactLedger`) is absent is a hard rejection, never a silent no-op.
- **Artifact ids are namespaced host-side.** The iframe sends a *bare* id; the broker prefixes `${pluginId}:`. A plugin structurally cannot mint another game's artifact.
- **`plugin://` is the only asset channel for Tier 2.** Served by `src-tauri/src/plugin_protocol.rs`, scoped per-plugin. The path resolver (`resolve_plugin_asset_path`) rejects `..`/encoded-`..`/separators and canonicalizes to block symlink escape. Build URLs with `pluginAssetUrl` (`src/engine/pluginProtocol.ts`) — it handles the macOS/Linux (`plugin://localhost`) vs Windows (`http://plugin.localhost`) split.
- **CSP lives in `tauri.conf.json`** (`security.csp` for prod, `security.devCsp` for Vite). `plugin:` is allowed only for `img`/`media`/`frame`, never `script-src`/`connect-src`. Don't loosen `script-src` past `'self'`.
- The DEV-only `dev-sandbox` fixture is a Tier-2 `srcdoc` plugin that exercises this path (mirrors the other `[DEV]` fixtures; gated out of prod).

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
