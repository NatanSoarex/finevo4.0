type Props = {
  value: number;
  className?: string;
  trackClassName?: string;
  label?: string;
  animated?: boolean;
};

export default function Progress({ value, className = "", trackClassName = "", label, animated = true }: Props) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1.5 text-[11px] text-stone-500">
          <span>{label}</span>
          <span className="text-stone-700 font-medium">{Math.round(v)}%</span>
        </div>
      )}
      <div className={`relative h-2 rounded-full bg-stone-100 overflow-hidden ${trackClassName}`}>
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 ${animated ? "animate-progress" : ""}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
