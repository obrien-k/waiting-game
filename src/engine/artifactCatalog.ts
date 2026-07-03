import type { ArtifactCatalogEntry, ArtifactCategory, MiniGamePlugin } from "./types";

// Merge every plugin's declared artifact catalog into one flat list. The hub
// renders collections by filtering this on `category`. New/community games join
// the ecosystem purely by declaring `artifactCatalog` — no hub changes needed.
export function buildArtifactCatalog(
  plugins: MiniGamePlugin[]
): ArtifactCatalogEntry[] {
  return plugins.flatMap((p) => p.artifactCatalog ?? []);
}

export function catalogByCategory(
  plugins: MiniGamePlugin[],
  category: ArtifactCategory
): ArtifactCatalogEntry[] {
  return buildArtifactCatalog(plugins).filter((e) => e.category === category);
}
