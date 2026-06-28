import type { AmusementParkState } from "./AmusementParkEngine";

function QueueBar({ fill, color }: { fill: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(fill * 100, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function CardThumbnail({ state: rawState }: { state: unknown }) {
  const state = rawState as AmusementParkState;

  const expectedServiceTime =
    (state.paretoAlpha * state.paretoScale) / (state.paretoAlpha - 1.0);
  const serviceRate = 1.0 / expectedServiceTime;
  const utilization = state.arrivalRate * expectedServiceTime;

  const barColor =
    utilization > 0.9
      ? "#f87171" // red-400
      : utilization > 0.7
        ? "#fb923c" // orange-400
        : "#34d399"; // emerald-400

  const perMin = serviceRate * 60;
  const rateLabel = perMin >= 1 ? `${perMin.toFixed(1)}/min` : `${(serviceRate * 3600).toFixed(0)}/hr`;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-3 w-full">
        {/* Mini ferris wheel icon */}
        <div className="text-2xl shrink-0">🎡</div>

        <div className="flex-1 text-left min-w-0">
          <div className="text-white font-mono font-bold text-sm truncate">
            {Math.floor(state.queueLength).toLocaleString()} in line
          </div>
          <div className="flex items-center gap-1.5 text-white/40 text-xs mt-0.5">
            <span>🎢 {rateLabel}</span>
            <span className="text-white/20">·</span>
            <span>ρ {Math.min(utilization, 9.99).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <QueueBar fill={Math.min(1, utilization)} color={barColor} />
    </div>
  );
}
