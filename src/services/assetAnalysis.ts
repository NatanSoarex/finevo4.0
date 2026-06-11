// Análise avançada de ativos: rentabilidade em múltiplos períodos,
// rentabilidade real (descontada IPCA), comparação com benchmarks.
//
// === FONTES DOS DADOS (atualizado em maio/2026) ===
// - Cotações e histórico de ativos: brapi.dev (API oficial de dados B3)
// - IPCA acumulado: IBGE (Sistema Nacional de Índices de Preços ao Consumidor)
//   ↳ https://www.ibge.gov.br/explica/inflacao.php
// - CDI: B3/CETIP via cálculos do Banco Central
//   ↳ https://www.bcb.gov.br/
// - Selic: COPOM/Banco Central do Brasil
// - Ibovespa: B3 (Brasil Bolsa Balcão)
// - Poupança: Caixa Econômica Federal / Banco Central

import { getHistory, type HistoryPoint } from "./marketApi";

export type PeriodReturn = {
  label: string;
  days: number;
  nominal: number | null;
  real: number | null;
  annualized: number | null;
};

// === IPCA ACUMULADO POR PERÍODO ===
// Fonte: IBGE — atualizado conforme dados oficiais de maio/2026
// IPCA 12 meses (mar/26): 4,14% (oficial)
// Projeção 2026 (Boletim Focus BC): 4,91%
const IPCA_ACCUMULATED: Record<string, number> = {
  "1m": 0.41,    // média mensal 2026
  "3m": 1.22,    // ~3× média mensal com efeito composto
  "1y": 4.14,    // IPCA 12 meses oficial IBGE (mar/26)
  "2y": 9.36,    // 2024 (4,83%) + projeção 12m
  "5y": 30.85,   // acumulado 5 anos (incl. 2021-2025 com IPCA alto)
  "10y": 78.20,  // acumulado 10 anos (2016-2026)
};

const PERIODS: { id: string; label: string; days: number }[] = [
  { id: "1m", label: "1 mês", days: 30 },
  { id: "3m", label: "3 meses", days: 90 },
  { id: "1y", label: "1 ano", days: 365 },
  { id: "2y", label: "2 anos", days: 730 },
  { id: "5y", label: "5 anos", days: 1825 },
  { id: "10y", label: "10 anos", days: 3650 },
];

function findClosestPrice(history: HistoryPoint[], targetTs: number): HistoryPoint | null {
  if (history.length === 0) return null;
  let closest = history[0];
  let bestDiff = Math.abs(new Date(closest.date).getTime() - targetTs);
  for (const p of history) {
    const d = Math.abs(new Date(p.date).getTime() - targetTs);
    if (d < bestDiff) {
      closest = p;
      bestDiff = d;
    }
  }
  return closest;
}

/**
 * Calcula retornos do ativo em todos os períodos definidos.
 */
export async function getAssetReturns(ticker: string): Promise<{
  returns: PeriodReturn[];
  currentPrice: number;
}> {
  const history = await getHistory(ticker, 3650).catch(() => [] as HistoryPoint[]);

  if (history.length === 0) {
    return {
      returns: PERIODS.map((p) => ({ ...p, nominal: null, real: null, annualized: null })),
      currentPrice: 0,
    };
  }

  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const lastPoint = sorted[sorted.length - 1];
  const currentPrice = lastPoint.close;
  const todayTs = new Date(lastPoint.date).getTime();
  const oldestTs = new Date(sorted[0].date).getTime();
  const totalDaysAvailable = (todayTs - oldestTs) / 86400000;

  const returns: PeriodReturn[] = PERIODS.map((p) => {
    if (p.days > totalDaysAvailable + 30) {
      return { label: p.label, days: p.days, nominal: null, real: null, annualized: null };
    }

    const targetTs = todayTs - p.days * 86400000;
    const past = findClosestPrice(sorted, targetTs);
    if (!past || past.close <= 0) {
      return { label: p.label, days: p.days, nominal: null, real: null, annualized: null };
    }

    const nominal = ((currentPrice - past.close) / past.close) * 100;
    const inflation = IPCA_ACCUMULATED[p.id] ?? 0;
    // Fórmula correta: ((1 + nominal/100) / (1 + inflation/100) - 1) * 100
    const real = ((1 + nominal / 100) / (1 + inflation / 100) - 1) * 100;

    // CAGR (Compound Annual Growth Rate)
    const years = p.days / 365;
    let annualized: number | null = null;
    if (years >= 1) {
      const ratio = currentPrice / past.close;
      if (ratio > 0) {
        annualized = (Math.pow(ratio, 1 / years) - 1) * 100;
      }
    }

    return {
      label: p.label,
      days: p.days,
      nominal: Math.round(nominal * 100) / 100,
      real: Math.round(real * 100) / 100,
      annualized: annualized !== null ? Math.round(annualized * 100) / 100 : null,
    };
  });

  return { returns, currentPrice };
}

/**
 * Volatilidade anualizada (desvio padrão × √252 pregões).
 */
export async function getVolatility(ticker: string, days = 365): Promise<number | null> {
  const history = await getHistory(ticker, days).catch(() => [] as HistoryPoint[]);
  if (history.length < 30) return null;

  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const dailyReturns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].close;
    const curr = sorted[i].close;
    if (prev > 0) dailyReturns.push((curr - prev) / prev);
  }
  if (dailyReturns.length === 0) return null;

  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / dailyReturns.length;
  const stdDaily = Math.sqrt(variance);
  return Math.round(stdDaily * Math.sqrt(252) * 100 * 100) / 100;
}

export async function getMinMax(ticker: string, days = 365): Promise<{ min: number; max: number; minDate: string; maxDate: string } | null> {
  const history = await getHistory(ticker, days).catch(() => [] as HistoryPoint[]);
  if (history.length === 0) return null;
  let minP = history[0];
  let maxP = history[0];
  for (const p of history) {
    if (p.close < minP.close) minP = p;
    if (p.close > maxP.close) maxP = p;
  }
  return { min: minP.close, max: maxP.close, minDate: minP.date, maxDate: maxP.date };
}

// === BENCHMARKS COM DADOS OFICIAIS ATUALIZADOS (maio/2026) ===
//
// CDI: 14,83% acumulado 12 meses (Fonte: B3/CETIP, dados via brasilindicadores.com.br)
// Ibovespa: 38,68% em 12 meses (Fonte: B3, dados via Banco Safra/Elos Ayta - mai/26)
// IPCA: 4,14% em 12 meses (Fonte: IBGE - mar/26 oficial)
// Poupança: 8,33% acumulado 12 meses (Fonte: Banco Central - mai/26)
// Selic: 14,5% ao ano (Fonte: COPOM - reunião de mai/26)
export const BENCHMARKS = {
  cdi: { name: "CDI", annual: 14.83, source: "B3/CETIP" },
  selic: { name: "Selic", annual: 14.50, source: "COPOM/BCB" },
  ibov: { name: "Ibovespa", annual: 38.68, source: "B3" },
  ipca: { name: "IPCA (Inflação)", annual: 4.14, source: "IBGE" },
  poup: { name: "Poupança", annual: 8.33, source: "BCB" },
};

export function getBenchmarkReturn(benchmark: keyof typeof BENCHMARKS, days: number): number {
  const annual = BENCHMARKS[benchmark].annual;
  const years = days / 365;
  return (Math.pow(1 + annual / 100, years) - 1) * 100;
}

// Metadata de fontes para exibir no UI
export const DATA_SOURCES = {
  prices: { name: "Cotações B3", url: "https://brapi.dev", desc: "Dados oficiais da Bolsa de Valores Brasileira" },
  ipca: { name: "IPCA", url: "https://www.ibge.gov.br/explica/inflacao.php", desc: "Instituto Brasileiro de Geografia e Estatística" },
  cdi: { name: "CDI", url: "https://www.bcb.gov.br/", desc: "B3/CETIP via Banco Central" },
  selic: { name: "Selic", url: "https://www.bcb.gov.br/controleinflacao/taxaselic", desc: "Comitê de Política Monetária (COPOM)" },
  ibov: { name: "Ibovespa", url: "https://www.b3.com.br/", desc: "B3 — principal índice da bolsa" },
  poup: { name: "Poupança", url: "https://www.bcb.gov.br/", desc: "Caixa Econômica Federal / Banco Central" },
};

export const LAST_UPDATE = "Maio de 2026";
