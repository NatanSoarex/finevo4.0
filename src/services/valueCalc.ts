// Calcula valor de posições no tempo de forma CONSISTENTE.
// Garante que:
//   - value(purchaseDate) = invested (sempre bate com o aporte real)
//   - value(today)        = currentPrice × quantity (bate com a cotação real)
//   - Entre as duas datas, segue a forma do movimento de mercado (histórico)

import type { Position } from "./portfolio";
import type { HistoryPoint, PriceQuote } from "./marketApi";
import { parseLocalDate, localTs } from "./dateUtils";

// Local date TS cache to avoid costly new Date() and string splits
const DATE_TS_CACHE: Record<string, number> = {};

// Caches globais e helper de assinaturas para otimização de alta performance GIGA veloz
const POSITIONS_CACHE = new Map<string, Position[]>();
const VIRTUAL_TX_CACHE = new Map<string, any[]>();
const PORTFOLIO_VALUE_CACHE = new Map<string, { value: number; invested: number }>();

function getPortfolioValueCacheKey(
  positions: Position[],
  targetTs: number,
  transactions?: any[]
): string {
  const pKey = positions.length > 0 ? `${positions.length}_${positions[0].id}_${positions[positions.length - 1].id}` : "empty";
  const tKey = transactions ? getTxCacheKey(transactions) : "no_tx";
  return `${pKey}__${tKey}__${targetTs}`;
}

function getTxCacheKey(transactions: any[]): string {
  if (transactions.length === 0) return "empty";
  const len = transactions.length;
  const first = transactions[0];
  const last = transactions[len - 1];
  const mid = transactions[Math.floor(len / 2)];
  return `${len}_f_${first.id}_${first.ts}_m_${mid.id}_${mid.ts}_l_${last.id}_${last.ts}`;
}

function getVirtualTxKey(positions: Position[], transactions: any[]): string {
  const tKey = getTxCacheKey(transactions);
  // Simplificado para evitar mapear todo o array longo de posições
  const pKey = positions.length > 0 ? `${positions.length}_${positions[0].ticker}_${positions[positions.length - 1].ticker}` : "empty_positions";
  return `${tKey}__${pKey}`;
}

function getCachedTs(dateStr: string): number {
  let ts = DATE_TS_CACHE[dateStr];
  if (ts === undefined) {
    const [y, m, d] = dateStr.split("-").map(Number);
    ts = new Date(y, (m || 1) - 1, d || 1).getTime();
    DATE_TS_CACHE[dateStr] = ts;
  }
  return ts;
}

const CLOSEST_PRICE_CACHE: Record<string, number | null> = {};
let closestPriceCacheSize = 0;

function findClosestPrice(history: HistoryPoint[], targetTs: number): number | null {
  if (history.length === 0) return null;

  const firstDate = history[0].date;
  const lastDate = history[history.length - 1].date;
  const cacheKey = `${firstDate}_${lastDate}_${targetTs}`;
  
  if (CLOSEST_PRICE_CACHE[cacheKey] !== undefined) {
    return CLOSEST_PRICE_CACHE[cacheKey];
  }

  // Utiliza busca binária O(log N) no histórico ordenado cronologicamente,
  // filtrando implicitamente apenas pontos que ocorreram ATÉ targetTs para evitar "leaks" de preços futuros.
  let low = 0;
  let high = history.length - 1;
  let bestIdx = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const midTs = getCachedTs(history[mid].date);
    if (midTs <= targetTs) {
      bestIdx = mid; // Candidato válido (<= targetTs)
      low = mid + 1; // Tenta encontrar um mais próximo (menor diferença) no futuro
    } else {
      high = mid - 1; // Fora do intervalo permitido
    }
  }

  let result: number | null = null;
  if (bestIdx !== -1) {
    result = history[bestIdx].close;
  } else {
    // Se targetTs é anterior a todo o histórico de preços, retornamos o valor mais antigo como fallback conservador.
    result = history[0].close;
  }

  // Prevenção de vazamento de memória para caches de uso longo
  if (closestPriceCacheSize > 8000) {
    for (const key in CLOSEST_PRICE_CACHE) {
      delete CLOSEST_PRICE_CACHE[key];
    }
    closestPriceCacheSize = 0;
  }

  CLOSEST_PRICE_CACHE[cacheKey] = result;
  closestPriceCacheSize++;
  return result;
}

/**
 * Retorna o valor da posição em uma data específica.
 *
 * Estratégia:
 * - Antes da compra: 0
 * - No dia da compra: invested (ancorado exato)
 * - Hoje: currentPrice × quantity (ancorado exato)
 * - Entre os dois: usa a CURVA REAL do mercado, escalada para passar pelos dois âncoras
 *
 * Isso garante que cada data tem seu valor próprio, refletindo o movimento real,
 * SEM cair em interpolação linear que apaga as variações reais.
 */
export function getPositionValueAt(
  position: Position,
  targetDate: Date | number,
  history: HistoryPoint[],
  currentQuote: PriceQuote | undefined,
  backfill = false
): number {
  const targetTs = typeof targetDate === "number" ? targetDate : targetDate.getTime();
  const purchaseTs = parseLocalDate(position.purchaseDate).getTime();
  const todayTs = Date.now();
  const oneDayMs = 86400000;

  // Antes da compra: se for backfill, projetamos a quantidade para trás usando o preço histórico.
  if (backfill && targetTs < purchaseTs - oneDayMs) {
    const histAtTarget = findClosestPrice(history, targetTs);
    if (histAtTarget !== null && histAtTarget > 0) {
      return position.quantity * histAtTarget;
    }
    return (currentQuote?.price ?? position.purchasePrice) * position.quantity;
  }

  // Se não for backfill, antes da compra era zero.
  if (!backfill && targetTs < purchaseTs - oneDayMs) return 0;

  // Se o target for de um mês anterior ao atual, congelamos os valores usando apenas o histórico da época,
  // sem qualquer influência do preço atual/hoje para que o saldo de meses fechados NUNCA se mova ou mude.
  const now = new Date();
  const startOfCurrentMonthTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  if (targetTs < startOfCurrentMonthTs) {
    const histAtPurchase = findClosestPrice(history, purchaseTs);
    const histAtTarget = findClosestPrice(history, targetTs);

    if (histAtPurchase !== null && histAtTarget !== null && histAtPurchase > 0) {
      const ratioFromPurchase = histAtTarget / histAtPurchase;
      return position.invested * ratioFromPurchase;
    }

    if (histAtTarget !== null) {
      return position.quantity * histAtTarget;
    }

    // Fallback absoluto se não houver histórico de forma alguma
    return position.invested;
  }

  // Valor atual real
  const currentPrice = currentQuote?.price ?? position.purchasePrice;
  const currentValue = currentPrice * position.quantity;

  // Próximo do dia da compra: valor investido (apenas se não for backfill para manter a curva suave)
  if (!backfill && Math.abs(targetTs - purchaseTs) < oneDayMs) return position.invested;

  // Hoje ou futuro: valor de mercado atual
  if (targetTs >= todayTs - oneDayMs) return currentValue;

  // Sem histórico ou histórico insuficiente: interpolação linear no tempo (fallback)
  if (history.length < 2) {
    const totalPeriod = todayTs - purchaseTs;
    const elapsedPeriod = targetTs - purchaseTs;
    const w = totalPeriod > 0 ? elapsedPeriod / totalPeriod : 1;
    return position.invested + (currentValue - position.invested) * w;
  }

  const histAtPurchase = findClosestPrice(history, purchaseTs);
  const histAtTarget = findClosestPrice(history, targetTs);
  const histAtToday = findClosestPrice(history, todayTs);

  if (histAtPurchase === null || histAtTarget === null || histAtToday === null || histAtPurchase <= 0) {
    const totalPeriod = todayTs - purchaseTs;
    const elapsedPeriod = targetTs - purchaseTs;
    const w = totalPeriod > 0 ? elapsedPeriod / totalPeriod : 1;
    return position.invested + (currentValue - position.invested) * w;
  }

  // === ESCALA DUPLA ===
  // Calcula 2 valores possíveis e mistura:
  // 1) valorPorCompra: assume que o preço "real" de compra foi o histórico naquela data,
  //    e simplesmente aplica a variação histórica multiplicada pela quantidade.
  //    Isso preserva 100% as variações do mercado entre as datas.
  const ratioFromPurchase = histAtTarget / histAtPurchase;
  const valorPorCompra = position.invested * ratioFromPurchase;

  // 2) valorPorHoje: assume que o preço "real" de hoje é o do histórico,
  //    e calcula proporcionalmente ao currentValue.
  //    Isso garante que valor(hoje) == currentValue exato.
  const ratioFromToday = histAtTarget / histAtToday;
  const valorPorHoje = currentValue * ratioFromToday;

  // Faz uma média ponderada pelo tempo: quanto mais perto da compra, mais peso
  // pra valorPorCompra; quanto mais perto de hoje, mais peso pra valorPorHoje.
  // Isso garante âncoras exatas nas duas pontas E mantém a forma real do mercado.
  const totalPeriod = todayTs - purchaseTs;
  if (totalPeriod <= 0) return position.invested;
  const timeWeight = (targetTs - purchaseTs) / totalPeriod; // 0 = compra, 1 = hoje
  const w = Math.max(0, Math.min(1, timeWeight));

  return valorPorCompra * (1 - w) + valorPorHoje * w;
}

/**
 * Reconstrói o estado das posições ativas em um determinado timestamp `targetTs`
 * com base na lista de transações históricas fornecida pelo usuário.
 */
export function getPositionsAt(
  transactions: any[],
  targetTs: number
): Position[] {
  const txKey = getTxCacheKey(transactions);
  const cacheKey = `${txKey}_${targetTs}`;
  if (POSITIONS_CACHE.has(cacheKey)) {
    return POSITIONS_CACHE.get(cacheKey)!;
  }

  // Filtra transações que ocorreram em ou antes de targetTs
  // Ordena por data e depois por ts de criação para manter sequência cronológica estável
  const sortedTx = transactions
    .filter((tx) => {
      const txTs = getCachedTs(tx.date);
      return txTs <= targetTs;
    })
    .sort((a, b) => {
      const dateA = getCachedTs(a.date);
      const dateB = getCachedTs(b.date);
      if (dateA !== dateB) return dateA - dateB;
      return a.ts - b.ts;
    });

  const reconstructed: Record<string, Position> = {};

  for (const tx of sortedTx) {
    const ticker = tx.ticker.toUpperCase();
    if (tx.kind === "buy") {
      const pos = reconstructed[ticker];
      if (!pos) {
        reconstructed[ticker] = {
          id: `pos_recon_${ticker}`,
          ticker: tx.ticker,
          name: tx.assetName,
          type: tx.assetType,
          logo: tx.assetLogo,
          purchaseDate: tx.date,
          purchasePrice: tx.unitPrice,
          quantity: tx.quantity,
          invested: tx.total,
          createdAt: tx.ts,
        };
      } else {
        const totalQty = pos.quantity + tx.quantity;
        const totalInvested = pos.invested + tx.total;
        const avgPrice = totalQty > 0 ? totalInvested / totalQty : 0;
        pos.quantity = totalQty;
        pos.invested = Math.round(totalInvested * 100) / 100;
        pos.purchasePrice = Math.round(avgPrice * 100) / 100;
        if (tx.date < pos.purchaseDate) {
          pos.purchaseDate = tx.date;
        }
      }
    } else if (tx.kind === "sell") {
      const pos = reconstructed[ticker];
      if (pos) {
        const newQty = Math.max(0, pos.quantity - tx.quantity);
        const newInvested = newQty * pos.purchasePrice;
        if (newQty <= 1e-8) {
          delete reconstructed[ticker];
        } else {
          pos.quantity = newQty;
          pos.invested = Math.round(newInvested * 100) / 100;
        }
      }
    }
  }

  const result = Object.values(reconstructed);
  
  POSITIONS_CACHE.set(cacheKey, result);
  if (POSITIONS_CACHE.size > 5000) {
    POSITIONS_CACHE.clear();
  }
  
  return result;
}

/**
 * Soma o valor de TODAS as posições em uma data de forma precisa.
 * Se uma lista de `transactions` for fornecida, reconstrói o portfólio exato
 * ativo na data solicitada, impedindo erros com ativos no passado ou parcialmente vendidos.
 */
export function getPortfolioValueAt(
  positions: Position[],
  targetDate: Date | number,
  histories: Record<string, HistoryPoint[]>,
  quotes: Record<string, PriceQuote>,
  transactions?: any[],
  backfill = false
): { value: number; invested: number } {
  const targetTs = typeof targetDate === "number" ? targetDate : targetDate.getTime();
  
  const cacheKey = `${getPortfolioValueCacheKey(positions, targetTs, transactions)}__backfill_${backfill}`;
  if (PORTFOLIO_VALUE_CACHE.has(cacheKey)) {
    return PORTFOLIO_VALUE_CACHE.get(cacheKey)!;
  }
  
  let txList = transactions;
  if (transactions && transactions.length > 0) {
    const vKey = getVirtualTxKey(positions, transactions);
    let combined = VIRTUAL_TX_CACHE.get(vKey);
    if (!combined) {
      const tickersWithTx = new Set(transactions.map((t) => t.ticker.toUpperCase()));
      const virtualTxs: any[] = [];
      for (const p of positions) {
        if (!tickersWithTx.has(p.ticker.toUpperCase())) {
          virtualTxs.push({
            id: `virtual_tx_${p.ticker}`,
            kind: "buy",
            ticker: p.ticker,
            assetName: p.name,
            assetType: p.type,
            assetLogo: p.logo,
            quantity: p.quantity,
            unitPrice: p.purchasePrice,
            total: p.invested,
            date: p.purchaseDate,
            ts: getCachedTs(p.purchaseDate),
          });
        }
      }
      combined = virtualTxs.length > 0 ? [...virtualTxs, ...transactions] : transactions;
      VIRTUAL_TX_CACHE.set(vKey, combined);
      if (VIRTUAL_TX_CACHE.size > 200) {
        VIRTUAL_TX_CACHE.clear();
      }
    }
    txList = combined;
  }

  // Se for backfill, consideramos todo o portfólio atual (não filtramos cronologicamente porque queremos simular as mesmas posições no passado)
  const activePositions = backfill
    ? positions
    : (txList && txList.length > 0)
      ? getPositionsAt(txList, targetTs)
      : positions.filter((p) => getCachedTs(p.purchaseDate) <= targetTs + 86400000);

  let value = 0;
  let invested = 0;
  for (const p of activePositions) {
    invested += p.invested;
    value += getPositionValueAt(p, targetTs, histories[p.ticker] ?? [], quotes[p.ticker], backfill);
  }
  
  const res = { value, invested };
  PORTFOLIO_VALUE_CACHE.set(cacheKey, res);
  if (PORTFOLIO_VALUE_CACHE.size > 20000) {
    PORTFOLIO_VALUE_CACHE.clear();
  }
  return res;
}
