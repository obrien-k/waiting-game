# Steam / Workshop readiness

Status as of 2026-07-07 (v0.3.1 line). Steam Workshop support is a release
criterion; this is the concrete gap list. Existing issues #3–#6 remain the
tracking artifacts — this doc sequences them and adds what the audit found.

## Already in place

- **Security story (ADR 0002, shipped):** dynamically loaded plugins are
  Tier 2 — sandboxed iframe, zero native capabilities, permission-gated
  postMessage broker, per-plugin-scoped `plugin://` asset protocol with
  traversal/symlink hardening, locked-down CSP. This was the hard
  prerequisite; Workshop content can be hostile and the runtime already
  assumes it is.
- **Manifest format (stable):** `src/games/_template/manifest.json` — id,
  entry, declared broker permissions. `parseManifest` validates untrusted
  JSON and always yields an untrusted descriptor.
- **Registry seam:** `gameRegistry.ts` is built to append `ExternalPlugin`s
  to `BUILTIN_PLUGINS`; hub cards and both shells already branch on trust
  tier.

## Gaps, in build order

### 1. Runtime plugin loader — the rest of issue #3
Scan `AppData/plugins/*/manifest.json` at startup (Rust command returning
parsed manifest strings; JS calls `parseManifest` per entry), append the
resulting `ExternalPlugin`s, tolerate malformed bundles (skip + log, never
crash the hub). This is pure plumbing — every hard decision is already made.
When Steam lands, the same loader also scans the Workshop content directory
(`steamapps/workshop/content/<appid>/<publishedfileid>/`).

### 2. Steamworks integration — issue #4
`steam` Cargo feature gating an optional `steamworks` crate dependency;
`src-tauri/src/steam/mod.rs` skeleton (init/shutdown, `steam_appid.txt` for
dev). Workshop subscription enumeration via ISteamUGC feeds directory paths
to the loader from step 1. Non-Steam builds (itch.io) compile without the
feature — one binary tree, two storefronts.

### 3. Single instance — issue #5
`tauri-plugin-single-instance`, so Steam relaunch/overlay routes to the
running app instead of spawning a second instance (which would race both
ledgers and save files).

### 4. Asset-location convention — issue #6
Recommendation: built-ins keep Vite-bundled assets (`src/assets`); Tier-2
plugins are already confined to `plugin://` within their bundle dir. Decide,
document in the template README, done.

### 5. Manifest `artifacts` block — new, found in the shelf audit
Tier-2 plugins can mint artifacts through the broker, but externals
contribute nothing to the artifact catalog, so their artifacts are
ledger-only and **invisible on the hub shelves**. Add an optional
`artifacts: [{ id, name, emoji, category, description }]` array to the
manifest, parsed into `ArtifactCatalogEntry`s (ids namespaced host-side, same
as minting). Without this, the collection loop is dead for Workshop content.

### 6. Creator & upload story
- Author docs: the `_template` README already covers native plugins; add a
  Tier-2 bundle walkthrough (manifest + `index.html` + `plugin://` assets).
- Upload path: `steamcmd +workshop_build_item` VDF docs (or a small script);
  itch.io equivalent is a zip of the bundle dir.

## Known risks

- **Steam overlay in webviews:** the overlay does not reliably render over
  wry/WebView2/WKWebView surfaces. Ship with overlay expectations documented;
  do not gate the release on overlay support.
- **Workshop content policy:** sandboxing covers the technical risk, but a
  takedown/moderation stance (report path, staff allowlist for Tier-1
  promotion) should exist before opening subscriptions.

## Sequencing

Steps 1, 4, and 5 are shippable now and independent of a Steam partner
account. Steps 2–3 need the app id. Step 5 (manifest artifacts) should land
before the first external plugin exists so the schema never needs a breaking
rev.
