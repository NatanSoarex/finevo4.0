import { useEffect, useRef, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, X } from "lucide-react";

export interface PortfolioHistoryPoint {
  date: string;
  close: number;
  aplicado: number;
  ganho: number;
}

export const periods = [
  { id: 30, label: "1M" },
  { id: 90, label: "3M" },
  { id: 180, label: "6M" },
  { id: 365, label: "1A" },
  { id: 1825, label: "MÁX" },
];

export default function PortfolioEvolution({
  history,
  period,
  onChangePeriod,
  isLoading,
  isWalletEmpty,
}: {
  history: PortfolioHistoryPoint[];
  period: number;
  onChangePeriod: (p: number) => void;
  isLoading: boolean;
  isWalletEmpty: boolean;
}) {
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

  if (isWalletEmpty) {
    return (
      <section className="relative rounded-3xl bg-gradient-to-br from-white via-white to-stone-50 border border-stone-200 p-5 shadow-sm overflow-hidden animate-fade-in">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full blur-3xl bg-stone-100" />
        <div className="relative">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-xs text-stone-500 flex items-center gap-1">
                <BarChart3 size={11} className="text-stone-400" /> Evolução do patrimônio
              </p>
              <p className="text-2xl font-bold text-stone-400 mt-1 tracking-tight font-sans">
                R$ 0,00
              </p>
              <p className="text-xs font-medium text-stone-400 mt-0.5">
                Nenhum investimento registrado
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-400 border border-stone-200">
              0,00%
            </span>
          </div>

          <div className="mt-5 flex gap-2">
            <div className="flex flex-col justify-between text-[10px] text-stone-300 font-medium pr-1" style={{ height: 160 }}>
              <span>R$ 0,00</span>
              <span>R$ 0,00</span>
              <span>R$ 0,00</span>
            </div>

            <div className="relative flex-1" style={{ height: 160 }}>
              <svg viewBox="0 0 400 160" preserveAspectRatio="none" className="w-full h-[160px] overflow-visible">
                {/* Flat reference line */}
                <line x1={0} y1={80} x2={400} y2={80} stroke="#e7e5e4" strokeWidth={1.5} strokeDasharray="3 4" />
                <circle cx={400} cy={80} r={4} fill="white" stroke="#d6d3d1" strokeWidth={2} />
              </svg>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-stone-50 border border-stone-150 p-3 text-center">
            <p className="text-xs font-medium text-stone-600">
              Sua carteira está vazia
            </p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Adicione ativos para acompanhar a evolução patrimonial.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (history.length < 2) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-white via-white to-emerald-50/30 border border-stone-200 p-5 shadow-sm animate-fade-in">
        <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
          <BarChart3 size={14} className="text-[#10b981]" /> Evolução do patrimônio
        </h3>
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-stone-400 mt-3">Carregando histórico...</p>
          </div>
        </div>
      </section>
    );
  }

  const values = history.map((h) => h.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const maxIdx = values.indexOf(max);
  const minIdx = values.indexOf(min);

  const firstPoint = history[0];
  const lastPoint = history[history.length - 1];
  const absChange = lastPoint.close - firstPoint.close;
  const pct = firstPoint.close > 0 ? (absChange / firstPoint.close) * 100 : 0;
  const positive = absChange >= 0;

  const lineColor = positive ? "#10b981" : "#f43f5e";
  const lineColorDark = positive ? "#059669" : "#e11d48";

  // Dimensões do gráfico
  const chartW = 400;
  const chartH = 160;
  const paddingX = 8;
  const innerW = chartW - paddingX * 2;

  // Escala Y com folga para caber etiquetas e manter aspecto bonito
  const padY = (max - min) * 0.12 || max * 0.05;
  const yMin = Math.max(0, min - padY);
  const yMax = max + padY;
  const range = yMax - yMin || 1;

  const points = values.map((v, i) => {
    const x = paddingX + (i / (values.length - 1)) * innerW;
    const y = chartH - ((v - yMin) / range) * chartH;
    return [x, y] as [number, number];
  });

  // Caminho suavizado (Bézier cúbico)
  let linePath = "";
  if (points.length >= 2) {
    linePath = `M${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const tension = 0.2;
      const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
      const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
      const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
      const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
      linePath += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
  }

  const areaPath = points.length >= 2
    ? `${linePath} L${points[points.length - 1][0]},${chartH} L${points[0][0]},${chartH} Z`
    : "";

  const hoverPoint = hoverIdx !== null && hoverIdx < points.length ? points[hoverIdx] : null;
  const hoverData = hoverIdx !== null && hoverIdx < history.length ? history[hoverIdx] : null;

  const hoverProfit = hoverData ? hoverData.close - hoverData.aplicado : 0;
  const hoverPct = hoverData && hoverData.aplicado > 0 ? (hoverProfit / hoverData.aplicado) * 100 : 0;

  // Grid e legendas Y (3 subdivisões)
  const ySteps = 3;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    return yMax - (range * i) / ySteps;
  });

  const formatBR = (v: number) => {
    if (v >= 1000000) {
      return `R$ ${(v / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
    }
    if (v >= 1000) {
      const rangeVal = max - min;
      if (rangeVal < 5000) {
        return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
      }
      return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
    }
    return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  };

  return (
    <section className="relative rounded-3xl bg-gradient-to-br from-white via-white to-emerald-50/40 border border-stone-200 p-5 shadow-[0_4px_24px_-6px_rgba(16,185,129,0.12)] overflow-hidden animate-fade-in">
      {/* Decorative Blob */}
      <div className={`absolute -top-20 -right-20 w-48 h-48 rounded-full blur-3xl ${positive ? "bg-emerald-200/30" : "bg-rose-200/30"}`} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-xs text-stone-500 flex items-center gap-1">
              <BarChart3 size={11} className="text-[#10b981]" /> Evolução do patrimônio
            </p>
            <p className="text-2xl font-bold text-stone-900 mt-1 tracking-tight font-sans">
              R$ {lastPoint.close.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className={`text-xs font-medium mt-0.5 ${positive ? "text-emerald-600" : "text-rose-600"}`}>
              {positive ? "+" : ""}R$ {absChange.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} no período
            </p>
          </div>
          <span className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${positive ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
            {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {positive ? "+" : ""}{pct.toFixed(2)}%
          </span>
         </div>

        {/* Period selection */}
        <div className="flex gap-1.5 mt-4">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => onChangePeriod(p.id)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                period === p.id
                  ? "bg-stone-900 text-white shadow-sm"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Chart with Y-axis */}
        <div className="mt-5 flex gap-2">
          {/* Y-axis labels */}
          <div className="flex flex-col justify-between text-[10px] text-stone-400 font-medium pr-1" style={{ height: chartH }}>
            {yLabels.map((v, i) => (
              <span key={i} className="text-right">{formatBR(v)}</span>
            ))}
          </div>

          {/* Chart area */}
          <div
            ref={containerRef}
            className="relative flex-1 touch-pan-y select-none animate-fade-in"
            style={{ height: chartH + 32 }}
            onMouseLeave={() => setHoverIdx(null)}
            onMouseMove={(e) => {
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = e.clientX - rect.left;
              const idx = Math.round((x / rect.width) * (values.length - 1));
              setHoverIdx(Math.max(0, Math.min(values.length - 1, idx)));
            }}
            onTouchStart={(e) => {
              isTouchingRef.current = true;
              isScrollingRef.current = false;
              const touch = e.touches[0];
              touchStartRef.current = { x: touch.clientX, y: touch.clientY };
              // Nao ativa o hoverIdx aqui para evitar popups visuais ao apenas rolar a pagina
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
                return; // Deixa o scroll acontecer naturalmente, sem preventDefault
              }
              
              // Se for um movimento predominantemente horizontal, previne rolagem e navega pelo gráfico
              e.preventDefault();
              
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = touch.clientX - rect.left;
              const idx = Math.round((x / rect.width) * (values.length - 1));
              setHoverIdx(Math.max(0, Math.min(values.length - 1, idx)));
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
                {/* Gradiente da área com múltiplos stops */}
                <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                  <stop offset="40%" stopColor={lineColor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
                {/* Gradiente da linha */}
                <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={lineColor} />
                  <stop offset="100%" stopColor={lineColorDark} />
                </linearGradient>
                {/* Glow ao redor da linha */}
                <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid horizontal sutil */}
              {Array.from({ length: ySteps + 1 }).map((_, i) => {
                const y = (chartH / ySteps) * i;
                return (
                  <line
                    key={i}
                    x1={0}
                    y1={y}
                    x2={chartW}
                    y2={y}
                    stroke="#e7e5e4"
                    strokeWidth={0.5}
                    strokeDasharray={i === ySteps ? "" : "2 4"}
                  />
                );
              })}

              {/* Área preenchida */}
              <path d={areaPath} fill="url(#area-grad)" className="animate-fade-in" />

              {/* Linha principal com glow */}
              <path
                d={linePath}
                fill="none"
                stroke="url(#line-grad)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#line-glow)"
              />

              {/* Ponto atual sempre destacado */}
              {!hoverPoint && (
                <g>
                   <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={5} fill={lineColor} opacity={0.3} className="animate-pulse" />
                  <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={4} fill="white" stroke={lineColor} strokeWidth={2.5} />
                </g>
              )}

              {/* Linha vertical + ponto do hover */}
              {hoverPoint && (
                <>
                  <line
                    x1={hoverPoint[0]}
                    y1={0}
                    x2={hoverPoint[0]}
                    y2={chartH}
                    stroke={lineColor}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.5}
                  />
                  <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r={8} fill={lineColor} opacity={0.2} />
                  <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r={5} fill="white" stroke={lineColor} strokeWidth={2.5} />
                </>
              )}
            </svg>

            {/* Tooltip premium */}
            {hoverData && hoverIdx !== null && (
              <div
                className="absolute z-20 bg-white rounded-2xl shadow-[0_8px_30px_-4px_rgba(28,25,23,0.18)] border border-stone-100 p-3 pointer-events-none animate-fade-in min-w-[140px]"
                style={{
                  left: `${(hoverIdx / (values.length - 1)) * 100}%`,
                  top: -4,
                  transform: hoverIdx > values.length * 0.6 ? "translateX(-100%) translateX(-12px)" : "translateX(12px)",
                }}
              >
                <p className="text-[10px] text-stone-500 font-medium">
                  {new Date(hoverData.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
                <p className="text-base font-bold text-stone-900 mt-0.5 font-sans">
                  R$ {hoverData.close.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <div className={`flex items-center gap-1 mt-1 text-[10px] font-semibold ${hoverProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {hoverProfit >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  <span>{hoverProfit >= 0 ? "+" : ""}R$ {hoverProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  <span className="text-stone-400">({hoverPct >= 0 ? "+" : ""}{hoverPct.toFixed(2)}%)</span>
                </div>
              </div>
            )}

            {/* X-axis - 4 datas */}
            <div className="flex justify-between text-[10px] text-stone-400 font-medium mt-2 px-1">
              {(() => {
                const total = history.length;
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
                    {new Date(history[idx].date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Min/Max summary */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5">
            <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
              <TrendingUp size={10} /> Máxima
            </p>
            <p className="text-sm font-bold text-stone-900 mt-0.5 font-sans">
              R$ {max.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-stone-500">
              {new Date(history[maxIdx].date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </p>
          </div>
          <div className="rounded-xl bg-stone-50 border border-stone-200 p-2.5">
            <p className="text-[10px] text-stone-600 font-semibold flex items-center gap-1">
              <TrendingDown size={10} /> Mínima
            </p>
            <p className="text-sm font-bold text-stone-900 mt-0.5 font-sans">
              R$ {min.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-stone-500">
              {new Date(history[minIdx].date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-stone-400 text-center mt-3">
          👆 Deslize ou passe o cursor para explorar a evolução dia a dia
        </p>
      </div>
    </section>
  );
}
