import { useHubStore } from "@/store/hubStore";
import { useGameRegistry } from "@/store/gameRegistry";
import { catalogByCategory } from "@/engine/artifactCatalog";

// The flora collection (plant-grow's grown plants). Follows CrystalDisplay's
// empty-gate: hidden entirely until the player has grown at least one plant,
// then shows the full species set — owned as bright tiles with a ×count, and
// not-yet-grown species as dimmed silhouettes (a collection to fill in).
export function Garden() {
  const entries = useHubStore((s) => s.artifacts.entries);
  const plugins = useGameRegistry((s) => s.plugins);

  const flora = catalogByCategory(Object.values(plugins), "flora");
  const ownedCount = flora.reduce((n, e) => n + (entries[e.id]?.count ?? 0), 0);
  if (ownedCount === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-[var(--color-surface-raised)] p-4">
      <header className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-white/80">Garden</h2>
        <span className="text-xs text-white/30">
          {flora.filter((e) => entries[e.id]).length} / {flora.length} species
        </span>
      </header>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {flora.map((entry) => {
          const owned = entries[entry.id];
          return (
            <div
              key={entry.id}
              title={
                owned
                  ? `${entry.name} · ×${owned.count} · first grown ${new Date(
                      owned.firstAcquiredAt
                    ).toLocaleDateString()}`
                  : `${entry.name} — not yet grown`
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
