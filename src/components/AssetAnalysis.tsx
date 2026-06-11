import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, BarChart3, Activity, Award, Info, ChartCandlestick, ShieldCheck } from "lucide-react";
import {
  getAssetReturns, getVolatility, getMinMax, BENCHMARKS, getBenchmarkReturn,
  DATA_SOURCES, LAST_UPDATE,
  type PeriodReturn,
} from "../services/assetAnalysis";

type Props = {
  ticker: string;
  assetName: string;
};

/**
 * Análise completa do ativo:
 * - Rentabilidade em múltiplos períodos (nominal + real)
 * - Retorno anualizado (CAGR)
 * - Comparação com benchmarks (CDI, Ibov, IPCA)
 * - Volatilidade
 * - Máxima e mínima
 */
export default function AssetAnalysis({ ticker, assetName }: Props) {
  const [returns, setReturns] = useState<PeriodReturn[]>([]);
  const [volatility, setVolatility] = useState<number | null>(null);
  const [minMax, setMinMax] = useState<{ min: number; max: number; minDate: string; maxDate: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAssetReturns(ticker),
      getVolatility(ticker),
      getMinMax(ticker, 365),
    ]).then(([r, v, mm]) => {
      setReturns(r.returns);
      setVolatility(v);
      setMinMax(mm);
      setLoading(false);
    });
  }, [ticker]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-stone-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // 1 ano de retorno para usar nas comparações
  const year1 = returns.find((r) => r.days === 365);
  const has1y = year1 && year1.nominal !== null;

  return (
    <div className="space-y-3">
      {/* === Rentabilidade Nominal === */}
      <section className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <ChartCandlestick size={16} className="text-amber-600" />
            <h4 className="text-base font-bold text-stone-900">Rentabilidade de {ticker}</h4>
          </div>
        </div>

        <div className="p-4">
          <div className="rounded-xl border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 px-3 py-2 border-b border-stone-200">
              <p className="text-sm font-semibold text-stone-800">Rentabilidade</p>
            </div>
            <ReturnsGrid returns={returns} field="nominal" />
          </div>

          {/* Rentabilidade Real */}
          <div className="mt-3 rounded-xl border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 px-3 py-2 border-b border-stone-200">
              <p className="text-sm font-semibold text-stone-800">Rentabilidade Real</p>
              <p className="text-[10px] text-stone-500 mt-0.5">Rentabilidade menos a inflação (IPCA).</p>
            </div>
            <ReturnsGrid returns={returns} field="real" />
          </div>

          {/* Retorno Anualizado */}
          <div className="mt-3 rounded-xl border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 px-3 py-2 border-b border-stone-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-800">Retorno Anualizado (CAGR)</p>
                <p className="text-[10px] text-stone-500 mt-0.5">Taxa equivalente ao ano.</p>
              </div>
              <Info size={12} className="text-stone-400" />
            </div>
            <ReturnsGrid returns={returns.filter((r) => r.days >= 365)} field="annualized" />
          </div>
        </div>
      </section>

      {/* === Comparação com Benchmarks === */}
      {has1y && year1 && (
        <section className="rounded-2xl bg-white border border-stone-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-violet-600" />
            <h4 className="text-base font-bold text-stone-900">Comparação (1 ano)</h4>
          </div>

          <div className="space-y-2">
            <BenchmarkBar
              name={ticker}
              value={year1.nominal!}
              isAsset
              maxAbsValue={Math.max(
                Math.abs(year1.nominal!),
                ...Object.keys(BENCHMARKS).map((k) =>
                  Math.abs(getBenchmarkReturn(k as keyof typeof BENCHMARKS, 365))
                )
              )}
            />
            {(Object.keys(BENCHMARKS) as (keyof typeof BENCHMARKS)[]).map((key) => {
              const bench = BENCHMARKS[key];
              const value = getBenchmarkReturn(key, 365);
              return (
                <BenchmarkBar
                  key={key}
                  name={bench.name}
                  value={value}
                  isAsset={false}
                  maxAbsValue={Math.max(
                    Math.abs(year1.nominal!),
                    ...Object.keys(BENCHMARKS).map((k) =>
                      Math.abs(getBenchmarkReturn(k as keyof typeof BENCHMARKS, 365))
                    )
                  )}
                />
              );
            })}
          </div>

          <div className="mt-3 rounded-xl bg-stone-50 border border-stone-100 p-3">
            <p className="text-[11px] text-stone-700">
              {year1.nominal! > getBenchmarkReturn("cdi", 365) ? (
                <>✅ <strong>{ticker}</strong> superou o CDI (renda fixa segura) no último ano.</>
              ) : (
                <>⚠️ <strong>{ticker}</strong> rendeu menos que o CDI no último ano.</>
              )}
            </p>
          </div>
        </section>
      )}

      {/* === Indicadores Técnicos === */}
      <section className="rounded-2xl bg-white border border-stone-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-sky-600" />
          <h4 className="text-base font-bold text-stone-900">Indicadores</h4>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <IndicatorCard
            icon={BarChart3}
            iconColor="text-amber-600 bg-amber-100"
            label="Volatilidade anual"
            value={volatility !== null ? `${volatility.toFixed(2)}%` : "—"}
            hint={volatility !== null ? volatilityLabel(volatility) : ""}
          />
          {minMax && (
            <>
              <IndicatorCard
                icon={TrendingUp}
                iconColor="text-emerald-600 bg-emerald-100"
                label="Máxima (1 ano)"
                value={`R$ ${minMax.max.toFixed(2)}`}
                hint={new Date(minMax.maxDate).toLocaleDateString("pt-BR")}
              />
              <IndicatorCard
                icon={TrendingDown}
                iconColor="text-rose-600 bg-rose-100"
                label="Mínima (1 ano)"
                value={`R$ ${minMax.min.toFixed(2)}`}
                hint={new Date(minMax.minDate).toLocaleDateString("pt-BR")}
              />
            </>
          )}
          {year1 && year1.nominal !== null && (
            <IndicatorCard
              icon={Activity}
              iconColor="text-violet-600 bg-violet-100"
              label="Variação 12m"
              value={`${year1.nominal >= 0 ? "+" : ""}${year1.nominal.toFixed(2)}%`}
              hint="Janeiro a hoje"
            />
          )}
        </div>
      </section>

      {/* === Sobre === */}
      <section className="rounded-2xl bg-stone-50 border border-stone-100 p-4">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-stone-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-stone-700 leading-relaxed">
              <strong>{ticker}</strong> ({assetName}) — A <strong>rentabilidade real</strong> desconta
              a inflação acumulada (IPCA) do período. O <strong>CAGR</strong> é a taxa equivalente
              que o ativo precisaria render ao ano para chegar ao retorno acumulado.
            </p>
          </div>
        </div>
      </section>

      {/* === Fontes oficiais === */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} className="text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-stone-900">Dados de fontes oficiais</p>
            <p className="text-[10px] text-stone-500">Atualizado em {LAST_UPDATE}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {Object.entries(DATA_SOURCES).map(([key, src]) => (
            <div key={key} className="flex items-start gap-2 text-[11px]">
              <span className="text-emerald-600 mt-0.5">✓</span>
              <div className="flex-1">
                <span className="font-semibold text-stone-800">{src.name}</span>
                <span className="text-stone-500"> — {src.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-stone-500 mt-3 leading-relaxed">
          Cotações em tempo real via API da <strong>brapi.dev</strong>, que agrega dados oficiais da B3.
          Indicadores macroeconômicos do IBGE e BCB.
        </p>
      </section>
    </div>
  );
}

function ReturnsGrid({ returns, field }: { returns: PeriodReturn[]; field: "nominal" | "real" | "annualized" }) {
  if (returns.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-stone-400">Sem dados disponíveis</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 divide-x divide-y divide-stone-100">
      {returns.map((r) => {
        const value = r[field];
        return (
          <div key={r.label + field} className="p-3">
            <p className="text-[11px] text-stone-500">{r.label}</p>
            {value === null ? (
              <p className="text-sm font-semibold text-stone-300 mt-0.5">—</p>
            ) : (
              <p className={`text-sm font-bold mt-0.5 ${value >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {value >= 0 ? "+" : ""}{value.toFixed(2).replace(".", ",")}%
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BenchmarkBar({
  name,
  value,
  isAsset,
  maxAbsValue,
}: {
  key?: string;
  name: string;
  value: number;
  isAsset: boolean;
  maxAbsValue: number;
}) {
  const positive = value >= 0;
  const width = maxAbsValue > 0 ? (Math.abs(value) / maxAbsValue) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <p className={`text-xs w-20 truncate ${isAsset ? "font-bold text-stone-900" : "text-stone-600"}`}>
        {name}
        {isAsset && <span className="text-[9px] text-violet-600 ml-1">(você)</span>}
      </p>
      <div className="flex-1 h-6 rounded-md bg-stone-50 relative overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 transition-all rounded-md ${
            positive
              ? isAsset
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : "bg-emerald-200"
              : isAsset
                ? "bg-gradient-to-r from-rose-500 to-rose-400"
                : "bg-rose-200"
          }`}
          style={{ width: `${Math.max(width, 3)}%` }}
        />
        <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold ${
          isAsset && width > 30 ? "text-white" : positive ? "text-emerald-800" : "text-rose-800"
        }`}>
          {positive ? "+" : ""}{value.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function IndicatorCard({
  icon: Icon,
  iconColor,
  label,
  value,
  hint,
}: {
  icon: typeof BarChart3;
  iconColor: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
      <span className={`h-7 w-7 grid place-items-center rounded-lg ${iconColor}`}>
        <Icon size={14} />
      </span>
      <p className="text-[10px] text-stone-500 mt-2">{label}</p>
      <p className="text-sm font-bold text-stone-900 mt-0.5">{value}</p>
      {hint && <p className="text-[9px] text-stone-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function volatilityLabel(v: number): string {
  if (v < 15) return "Baixa";
  if (v < 30) return "Moderada";
  if (v < 50) return "Alta";
  return "Muito alta";
}
