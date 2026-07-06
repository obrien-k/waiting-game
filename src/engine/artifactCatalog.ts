import type { ArtifactCatalogEntry, ArtifactCategory } from "./types";

// Only the `artifactCatalog` field is needed here — typed structurally so both
// native plugins and Tier-2 external descriptors (which have no catalog) pass
// through. External plugins contribute nothing until artifact support is added
// to the broker.
type CatalogSource = { artifactCatalog?: ArtifactCatalogEntry[] };

// Merge every plugin's declared artifact catalog into one flat list. The hub
// renders collections by filtering this on `category`. New/community games join
// the ecosystem purely by declaring `artifactCatalog` — no hub changes needed.
export function buildArtifactCatalog(
  plugins: CatalogSource[]
): ArtifactCatalogEntry[] {
  return plugins.flatMap((p) => p.artifactCatalog ?? []);
}

export function catalogByCategory(
  plugins: CatalogSource[],
  category: ArtifactCategory
): ArtifactCatalogEntry[] {
  return buildArtifactCatalog(plugins).filter((e) => e.category === category);
}
