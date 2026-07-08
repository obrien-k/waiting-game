import { useHubStore } from "@/store/hubStore";
import { useGameRegistry } from "@/store/gameRegistry";
import { catalogByCategory } from "@/engine/artifactCatalog";
import type { ArtifactCategory } from "@/engine/types";

// Themed shelf per artifact category (ADR 0003). Each follows the
// CrystalDisplay empty-gate: hidden until the player owns at least one item,
// then shows the full set — owned as bright tiles with a ×count, the rest as
// dimmed silhouettes (a collection to fill in).
const SHELVES: { category: ArtifactCategory; title: string; unit: string }[] = [
  { category: "flora", title: "Garden", unit: "species" },
  { category: "fauna", title: "Menagerie", unit: "creatures" },
  { category: "relic", title: "Cabinet", unit: "relics" },
  { category: "trophy", title: "Trophy Shelf", unit: "trophies" },
];

export function CollectionShelves() {
  return (
    <>
      {SHELVES.map((shelf) => (
        <Shelf key={shelf.category} {...shelf} />
      ))}
    </>
  );
}

function Shelf({
  category,
  title,
  unit,
}: {
  category: ArtifactCategory;
  title: string;
  unit: string;
}) {
  const entries = useHubStore((s) => s.artifacts.entries);
  const plugins = useGameRegistry((s) => s.plugins);

  const catalog = catalogByCategory(Object.values(plugins), category);
  const ownedCount = catalog.reduce((n, e) => n + (entries[e.id]?.count ?? 0), 0);
  if (ownedCount === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-[var(--color-surface-raised)] p-4">
      <header className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-white/80">{title}</h2>
        <span className="text-xs text-white/30">
          {catalog.filter((e) => entries[e.id]).length} / {catalog.length} {unit}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {catalog.map((entry) => {
          const owned = entries[entry.id];
          return (
            <div
              key={entry.id}
              title={
                owned
                  ? `${entry.name} · ×${owned.count} · first acquired ${new Date(
                      owned.firstAcquiredAt
                    ).toLocaleDateString()}`
                  : `${entry.name} — not yet acquired`
              }
              className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
                owned
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-white/5 bg-black/20"
              }`}
            >
              <span className={`text-2xl ${owned ? "" : "opacity-20 grayscale"}`}>
                {entry.emoji}
              </span>
              <span
                className={`truncate text-xs ${owned ? "text-white/70" : "text-white/25"}`}
              >
                {owned ? entry.name : "???"}
              </span>
              {owned && (
                <span className="font-mono text-xs text-emerald-300/80">
                  ×{owned.count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
