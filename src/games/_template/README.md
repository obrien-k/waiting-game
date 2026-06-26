# Making a new game

Copy this folder, rename it, and follow the steps below. You should have a
working game in under 15 minutes.

```
cp -r src/games/_template src/games/my-game
```

---

## The two-axis model

Every game has two independent upgrade trees:

| Axis | Upgrades do | State field |
|---|---|---|
| **What** | Select the variant (thing being waited for) | `activeVariantId` |
| **How** | Multiply speed by a condition factor | `conditionMultiplier` |

Rate at any moment = `(1 / variant.baseDurationSeconds) × conditionMultiplier`

This mirrors the water-boil game: pot size is the "what" (changes mass → changes
reward), heat source is the "how" (changes watts → changes speed).

---

## Step 1 — Define your variants

Edit the `VARIANTS` array in `engine.ts`. Each entry is a selectable mode:

```ts
export const VARIANTS: GameVariant[] = [
  {
    id: "ryegrass",
    label: "Ryegrass",
    emoji: "🌱",
    baseDurationSeconds: 432_000, // 5 days at base speed
    goldPerCompletion: 200,
    isHardMode: false,
  },
  {
    id: "sunflower",
    label: "Sunflower",
    emoji: "🌻",
    baseDurationSeconds: 86_400,  // 24 hours — faster, higher reward
    goldPerCompletion: 500,       // max allowed
    isHardMode: true,             // ← awards 1 💎 crystal on completion
  },
];
```

**Hard mode rules** (enforced by `assertPlugin` at startup):
- `isHardMode: true` requires `baseDurationSeconds ≥ 3,600` (1 hour)
- `goldPerCompletion` is capped at 500 across all variants
- Awards exactly 1 crystal — never configurable, never more

---

## Step 2 — Wire up the "what" upgrades

Each variant needs a corresponding "what" upgrade that sets `activeVariantId`:

```ts
{
  id: "what-ryegrass",
  label: "Ryegrass",
  description: "5-day growth cycle — 200 ◈",
  cost: 0,
  maxLevel: 1,
  apply: (s) => ({ ...(s as TemplateState), activeVariantId: "ryegrass", progress: 0 }),
},
{
  id: "what-sunflower",
  label: "Sunflower 🌻",
  description: "24-hour cycle — 500 ◈ + 💎",
  cost: 300,
  maxLevel: 1,
  requires: ["what-ryegrass", "how-5x"], // gate hard mode behind "how" upgrades
  apply: (s) => ({ ...(s as TemplateState), activeVariantId: "sunflower", progress: 0 }),
},
```

Switching variant resets `progress` to 0 — always include that in the `apply`.

---

## Step 3 — Define your "how" upgrades

These multiply `conditionMultiplier`. Max allowed is 500×.

```ts
{
  id: "how-watering-can",
  label: "Watering Can",
  description: "2× growth — basic irrigation",
  cost: 50,
  maxLevel: 1,
  requires: ["how-base"],
  apply: (s) => ({ ...(s as TemplateState), conditionMultiplier: 2.0 }),
},
```

---

## Step 4 — Register the game

**`src/store/gameRegistry.ts`**
```ts
import myPlugin from "@/games/my-game";
const BUILTIN_PLUGINS = [waterBoilPlugin, myPlugin];
```

**`src/store/hubStore.ts`**
```ts
installedGameIds: ["water-boil", "my-game"],
```

The ID must match `templatePlugin.id` in `index.ts` and `manifest.json`.

---

## Step 5 — Rename things

- `templatePlugin` in `index.ts` → `myGamePlugin`
- `TemplateGame` in `Game.tsx` → `MyGame`
- `TemplateCardThumbnail` in `CardThumbnail.tsx` → `MyCardThumbnail`
- `TemplateState` in `engine.ts` → `MyGameState`
- `TEMPLATE_UPGRADES` → `MY_GAME_UPGRADES`

---

## Validation

`assertPlugin(plugin)` runs at module load time. In dev it throws immediately if
any variant is out of bounds. In production it logs a warning. You will never
ship an exploitable game without it blowing up in dev first.

---

## Offline progress

`calculateOfflineProgress` replays up to 8 hours of missed ticks in 1-minute
chunks when the window reopens. It handles variant switches correctly because the
state is self-contained — the active variant is stored in state, not computed
from upgrades at runtime.

Hard-mode crystals earned offline are emitted the same way as online ones.

---

## Road to Steam Workshop

The `manifest.json` format is already compatible with runtime loading. When the
workshop ships, `gameRegistry.ts` will scan `AppData/plugins/*/manifest.json`
and dynamically import each bundle. Nothing else changes.
