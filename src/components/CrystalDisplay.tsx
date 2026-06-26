import { useHubStore } from "@/store/hubStore";

export function CrystalDisplay() {
  const count = useHubStore((s) => s.crystals.count);
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
      <span className="text-lg">💎</span>
      <span className="font-mono text-purple-200 font-semibold text-sm">{count}</span>
      <span className="text-purple-300/60 text-xs">{count === 1 ? "crystal" : "crystals"}</span>
    </div>
  );
}
