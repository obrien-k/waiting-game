# ADR 0003: Nomenclature & lexicon

- **Status:** Accepted — implemented 2026-07-07
- **Date:** 2026-07-07
- **Deciders:** @obrien-k

## Context

The PoC phase left the naming layer incoherent. The product was consistently
"The Waiting Game", but the four shipped mini-games used three different
grammatical frames — "Waiting for Water to Boil", "Watching a Plant Grow",
"Watching Paint Dry", "Amusement Park Queue" — and player-facing copy, docs,
and code all used "game" for both the product and the things inside it
("a game inside The Waiting Game"). With the repo going public and workshop
authors about to inherit whatever convention exists, the naming needed one
justified alignment before it fossilized.

## Decision

### Product name

**The Waiting Game**, article always kept and title-cased mid-sentence
("download The Waiting Game"). It is the idiom — *playing the waiting game* —
and dropping "The" truncates it. The repo/package slug stays `waiting-game`;
slugs conventionally drop articles.

### Title frame: "Waiting …"

Every mini-game title starts with **Waiting**:

| ID | Title |
|---|---|
| `water-boil` | Waiting for Water to Boil |
| `paint-dry` | Waiting for Paint to Dry |
| `plant-grow` | Waiting for a Plant to Grow |
| `amusement-park` | Waiting in Line |

The frame echoes the product name (the hub is a collection of Waitings),
scales to any future game, and gives workshop authors an obvious convention —
the `_template` placeholder is `"Waiting for ___ to ___"`.

The displaced boredom idioms ("a watched pot never boils", "like watching
paint dry") survive as card **descriptions**: idiom-led flavor with a
mechanical wink (e.g. *"A watched pot never boils. (It does — physics
insists.)"*). Player-facing tone, engineer subtext.

### Three layers, three words

| Layer | Word | Audience |
|---|---|---|
| Product | **The Waiting Game** | everyone |
| Unit inside it | **Wait** | players ("choose a Wait", "this Wait is popped out") |
| Code artifact | **plugin** | developers / workshop authors |

Code identifiers (`installedGameIds`, `gameId`, window labels `game-<id>`)
are unchanged — this is a display-and-docs alignment, not a refactor. Plugin
IDs are frozen: they key save files, unlock costs, and artifact namespaces.

### Hub verbs

"**Pop out**" stays the verb; a running Wait lives in a "pop-out". The
big-screen focus action reads "Watch on the big screen".

### Collections: themed shelves

Each `ArtifactCategory` gets a proper-noun shelf, revealed only when
non-empty (the existing Garden pattern):

| Category | Shelf |
|---|---|
| `flora` | Garden |
| `fauna` | Menagerie |
| `relic` | Cabinet |
| `trophy` | Trophy Shelf |

No umbrella word appears in the UI; docs call the mechanism "collections";
**artifact** remains a code/API term (already baked into the broker and
ledger).

### Unchanged

Currencies stay **Gold 🪙** / **Crystals 💎**. Upgrade axes keep concrete
per-game labels (Pot/Heater, Plant/Growing Conditions); the abstract
"what/how" vocabulary stays dev-facing (CLAUDE.md). Dev fixtures keep the
`[DEV]` prefix.

## Alternatives considered

- **Idiom titles** ("A Watched Pot Never Boils", …): thematically rich but
  deliberately inconsistent frames, and non-idiom future games would have no
  pattern to follow. The idioms were kept as description flavor instead.
- **"Watching …" frame**: consistent but competes with the product name's
  "Waiting" and reads passive.
- **Bare noun phrases** ("Water Boil"): cleanest in tight UI, loses the joke.
- **"game" everywhere** (status quo): zero churn but keeps the product/unit
  ambiguity this ADR exists to remove.
- **Player-facing "Artifacts" panel**: one vocabulary across all layers, but
  museum-sterile next to Waits and Gold; a single tabbed "Collection" pane was
  also rejected as heavier UI than four self-revealing shelves.

## Consequences

- Display names, card descriptions, manifests, and hub copy updated in place;
  saves and IDs untouched.
- CLAUDE.md carries the compact lexicon table so future sessions enforce it.
- README's player section uses the player vocabulary (Waits, shelves, Gold,
  Crystals) and nothing from the code layer.
