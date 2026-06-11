import { useEffect, useRef, useState } from "react";

type Point = { date: string; close: number };

type Props = {
  data: Point[];
  height?: number;
  color?: string; // hex
  className?: string;
  showAxis?: boolean;
};

/**
 * Gráfico de linha SVG suave (Bezier) com hover/touch interativo.
 * - Mouse: tooltip segue o cursor
 * - Touch: tooltip segue o dedo, some ao soltar
 */
export default function InteractiveChart({
  data,
  height = 140,
  color = "#10b981",
  className = "",
  showAxis = true,
}: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isTouchingRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const clear = () => {
      isTouchingRef.current = false;
      setHoverIdx(null);
    };
    window.addEventListener("touchend", clear);
    window.addEventListener("touchcancel", clear);
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("touchend", clear);
      window.removeEventListener("touchcancel", clear);
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
      window.removeEventListener("blur", clear);
    };
  }, []);

  if (!data || data.length < 2) {
    return (
      <div style={{ height }} className={`flex items-center justify-center ${className}`}>
        <p className="text-xs text-stone-400">Sem dados</p>
      </div>
    );
  }

  const values = data.map((d) => d.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padY = (max - min) * 0.1 || max * 0.05;
  const yMin = Math.max(0, min - padY);
  const yMax = max + padY;
  const range = yMax - yMin || 1;

  const first = values[0];
  const last = values[values.length - 1];
  const pct = first > 0 ? ((last - first) / first) * 100 : 0;
  const positive = last >= first;
  const lineColor = positive ? color : "#f43f5e";

  const chartW = 400;
  const chartH = height;
  const paddingX = 6;
  const innerW = chartW - paddingX * 2;

  const points = values.map((v, i) => {
    const x = paddingX + (i / (values.length - 1)) * innerW;
    const y = chartH - ((v - yMin) / range) * chartH;
    return [x, y] as const;
  });

  // Curva Bezier (Catmull-Rom)
  const smoothPath = (pts: readonly (readonly [number, number])[]) => {
    if (pts.length < 2) return "";
    let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const tension = 0.2;
      const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
      const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
      const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
      const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
      d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    return d;
  };

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L${points[points.length - 1][0]},${chartH} L${points[0][0]},${chartH} Z`;

  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;
  const hoverData = hoverIdx !== null ? data[hoverIdx] : null;
  const hoverDiff = hoverData ? hoverData.close - first : 0;
  const hoverPct = first > 0 ? (hoverDiff / first) * 100 : 0;

  const gradId = `chart-grad-${Math.random().toString(36).slice(2, 7)}`;

  const handleMove = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const idx = Math.round((x / rect.width) * (values.length - 1));
    setHoverIdx(Math.max(0, Math.min(values.length - 1, idx)));
  };

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="relative touch-pan-y select-none"
        style={{ height: chartH + 4 }}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => handleMove(e.clientX)}
        onTouchStart={(e) => {
          isTouchingRef.current = true;
          isScrollingRef.current = false;
          const touch = e.touches[0];
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          // Nao executa handleMove aqui para evitar tooltips abrindo durante scrolls
        }}
        onTouchMove={(e) => {
          if (!isTouchingRef.current || !touchStartRef.current || isScrollingRef.current) return;
          
          const touch = e.touches[0];
          const dx = Math.abs(touch.clientX - touchStartRef.current.x);
          const dy = Math.abs(touch.clientY - touchStartRef.current.y);
          
          // Se o movimento for predominantemente vertical, é um gesto de rolagem de página (scroll up/down)
          if (dy > 6 && dy > dx) {
            isScrollingRef.current = true;
            isTouchingRef.current = false;
            setHoverIdx(null); // Oculta o tooltip imediatamente
            return; // Permite o scroll natural
          }
          
          // Se for horizontal, navega pelo gráfico e bloqueia scroll vertical temporariamente
          e.preventDefault();
          handleMove(touch.clientX);
        }}
        onTouchEnd={() => { 
          isTouchingRef.current = false; 
          isScrollingRef.current = false;
          touchStartRef.current = null;
          setHoverIdx(null); 
        }}
        onTouchCancel={() => { 
          isTouchingRef.current = false; 
          isScrollingRef.current = false;
          touchStartRef.current = null;
          setHoverIdx(null); 
        }}
      >
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          preserveAspectRatio="none"
          className="w-full overflow-visible"
          style={{ height: chartH }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Linhas de grid horizontais sutis */}
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <line
              key={p}
              x1={0}
              y1={chartH * p}
              x2={chartW}
              y2={chartH * p}
              stroke="#e7e5e4"
              strokeWidth={0.5}
              strokeDasharray={p === 1 ? "" : "2 3"}
            />
          ))}

          {/* Área preenchida */}
          <path d={areaPath} fill={`url(#${gradId})`} />

          {/* Linha principal */}
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Ponto final (sempre visível quando sem hover) */}
          {!hoverPoint && (
            <g>
              <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={5} fill={lineColor} opacity={0.25} className="animate-pulse" />
              <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={3.5} fill="white" stroke={lineColor} strokeWidth={2} />
            </g>
          )}

          {/* Hover marker */}
          {hoverPoint && (
            <>
              <line
                x1={hoverPoint[0]}
                y1={0}
                x2={hoverPoint[0]}
                y2={chartH}
                stroke={lineColor}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r={7} fill={lineColor} opacity={0.2} />
              <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r={4} fill="white" stroke={lineColor} strokeWidth={2.5} />
            </>
          )}
        </svg>

        {/* Tooltip flutuante */}
        {hoverData && hoverIdx !== null && (
          <div
            className="absolute z-20 bg-white rounded-xl shadow-[0_8px_24px_-4px_rgba(28,25,23,0.18)] border border-stone-100 px-3 py-2 pointer-events-none animate-fade-in min-w-[120px]"
            style={{
              left: `${(hoverIdx / (values.length - 1)) * 100}%`,
              top: -6,
              transform: hoverIdx > values.length * 0.6 ? "translateX(-100%) translateX(-10px)" : "translateX(10px)",
            }}
          >
            <p className="text-[10px] text-stone-500 font-medium">
              {new Date(hoverData.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            <p className="text-sm font-bold text-stone-900 mt-0.5">
              R$ {hoverData.close.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className={`text-[10px] font-semibold mt-0.5 ${hoverDiff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {hoverDiff >= 0 ? "↗ +" : "↘ "}{hoverPct.toFixed(2)}% no período
            </p>
          </div>
        )}
      </div>

      {/* Eixo X (datas) + variação total */}
      {showAxis && (
        <>
          <div className="flex justify-between text-[10px] text-stone-400 font-medium mt-2">
            {(() => {
              const total = data.length;
              let indices: number[] = [];
              if (total === 1) {
                indices = [0];
              } else if (total === 2) {
                indices = [0, 1];
              } else if (total === 3) {
                indices = [0, 1, 2];
              } else if (total === 4) {
                indices = [0, 1, 2, 3];
              } else if (total > 4) {
                const step = (total - 1) / 3;
                indices = [0, Math.round(step), Math.round(step * 2), total - 1];
              }
              return indices.map((idx) => (
                <span key={idx}>
                  {new Date(data[idx].date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
              ));
            })()}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-stone-500">Variação no período</span>
            <span className={`font-bold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
              {positive ? "+" : ""}{pct.toFixed(2)}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}
