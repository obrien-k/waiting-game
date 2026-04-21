import { useHubStore } from "@/store/hubStore";
import { formatGold } from "@/engine/currency";

export function GoldDisplay() {
  const balance = useHubStore((s) => s.gold.balance);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
      <span className="text-[var(--color-gold)] text-lg">◈</span>
      <span className="font-mono text-[var(--color-gold)] font-semibold text-sm">
        {formatGold(balance)}
      </span>
      <span className="text-amber-300/60 text-xs">gold</span>
    </div>
  );
}
