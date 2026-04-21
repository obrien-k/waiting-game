interface Props {
  value: number;   // 0–1
  label?: string;
  color?: string;
  height?: string;
}

export function ProgressBar({ value, label, color = "bg-amber-400", height = "h-3" }: Props) {
  const pct = Math.min(1, Math.max(0, value)) * 100;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-white/50 mb-1">
          <span>{label}</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
      )}
      <div className={`w-full ${height} bg-white/10 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
