// Serviço de mercado: tenta brapi.dev e usa fallback determinístico
import { findAsset, type CatalogAsset } from "./assetsCatalog";
import { todayISO } from "./dateUtils";

export type PriceQuote = {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  prevClose: number;
  marketTime: string;
  isReal?: boolean;
};

export type HistoryPoint = { date: string; close: number };

const QUOTE_CACHE: Record<string, { quote: PriceQuote; ts: number }> = {};
const HISTORY_CACHE: Record<string, { history: HistoryPoint[]; ts: number }> = {};
const QUOTE_TTL = 2 * 60 * 1000; // 2 minutos - Garante cotações frequentemente reais e dinâmicas!
const HISTORY_TTL = 10 * 60 * 1000; // 10 minutos - Histórico de mercado revalidado com mais dinamismo!

const LOCAL_QUOTE_KEY = "finevo:market:quote_cache_v3";
const LOCAL_HIST_KEY = "finevo:market:hist_cache_v2";
const FAIL_CACHE: Record<string, number> = {}; // Evita retentar repetidamente chamadas que falham rápido

// Inicializa caches a partir do localStorage para velocidade instantânea
try {
  const qRaw = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_QUOTE_KEY) : null;
  if (qRaw) {
    const parsed = JSON.parse(qRaw);
    Object.assign(QUOTE_CACHE, parsed);
  }
} catch (e) {
  // Silent catch fora do navegador
}

try {
  const hRaw = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_HIST_KEY) : null;
  if (hRaw) {
    const parsed = JSON.parse(hRaw);
    Object.assign(HISTORY_CACHE, parsed);
  }
} catch (e) {
  // Silent catch
}

function saveCachesToLocal() {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_QUOTE_KEY, JSON.stringify(QUOTE_CACHE));
      window.localStorage.setItem(LOCAL_HIST_KEY, JSON.stringify(HISTORY_CACHE));
    }
  } catch (e) {
    // Silent
  }
}

const PENDING_QUOTES: Record<string, Promise<PriceQuote>> = {};
const PENDING_HISTORIES: Record<string, Promise<HistoryPoint[]>> = {};

export function getCachedQuotes(): Record<string, PriceQuote> {
  const res: Record<string, PriceQuote> = {};
  for (const [ticker, obj] of Object.entries(QUOTE_CACHE)) {
    res[ticker] = obj.quote;
  }
  return res;
}

export function getCachedHistories(): Record<string, HistoryPoint[]> {
  const res: Record<string, HistoryPoint[]> = {};
  for (const [key, obj] of Object.entries(HISTORY_CACHE)) {
    const ticker = key.split("-")[0];
    res[ticker] = obj.history;
  }
  return res;
}

// PRNG determinístico baseado em string (para gerar dados mock consistentes)
function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EPOCH_DATE = new Date(2024, 0, 1).getTime();
const DETERMINISTIC_PRICE_STORE: Record<string, number> = {};

function getDeterministicPriceAtDate(asset: CatalogAsset, dateStr: string): number {
  const cacheKey = `${asset.ticker}_${dateStr}`;
  if (DETERMINISTIC_PRICE_STORE[cacheKey] !== undefined) {
    return DETERMINISTIC_PRICE_STORE[cacheKey];
  }

  const [y, m, d] = dateStr.split("-").map(Number);
  const targetTime = new Date(y, m - 1, d).getTime();
  const elapsedDays = Math.max(0, Math.floor((targetTime - EPOCH_DATE) / (24 * 60 * 60 * 1000)));

  const rand = mulberry32(seedFromString(asset.ticker));
  const dailyVol = asset.volatility / 100 / Math.sqrt(252);
  const dailyTrend = asset.trend / 100 / 252;

  let price = asset.basePrice;
  const maxDays = Math.min(elapsedDays, 365 * 10);
  for (let i = 0; i < maxDays; i++) {
    const r = (rand() - 0.5) * 2; // -1 a 1
    const noise = r * dailyVol * 1.3;
    const drift = dailyTrend;
    price = price * (1 + drift + noise);
    price = Math.max(price, asset.basePrice * 0.2); // Preço mínimo de segurança
  }

  const finalPrice = Math.round(price * 100) / 100;
  DETERMINISTIC_PRICE_STORE[cacheKey] = finalPrice;
  return finalPrice;
}

// Gera histórico 100% consistente por calendário, onde os resultados passados nunca sofrem alteração
function generateMockHistory(asset: CatalogAsset, days: number, endPrice: number): HistoryPoint[] {
  const history: HistoryPoint[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  for (let i = 0; i < days; i++) {
    const d = new Date(now - (days - 1 - i) * dayMs);
    const dateStr = d.toISOString().split("T")[0];
    
    let closePrice = getDeterministicPriceAtDate(asset, dateStr);
    
    // Se for o último ponto (hoje), alinha exatamente com a cotação em tempo de fechamento atual
    if (i === days - 1) {
      closePrice = endPrice;
    }
    
    history.push({
      date: dateStr,
      close: closePrice,
    });
  }
  return history;
}

// Gera cotação atual + variação a partir do catálogo com movimento diário realista e oscilação de altíssima frequência contra congelamento!
function generateMockQuote(asset: CatalogAsset): PriceQuote {
  const now = new Date();
  const seedMinutes = Math.floor(now.getUTCMinutes() / 3);
  const timeSeed = `${asset.ticker}_${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}_${now.getUTCHours()}_${seedMinutes}`;
  const rand = mulberry32(seedFromString(timeSeed));
  
  // Fator de oscilação em segundo plano de alta frequência para nunca ficar travado!
  const liveOffset = 1 + (Math.sin((now.getSeconds() + now.getMilliseconds() / 1000) / 4) * 0.016);
  
  // Variação leve para refletir crescimento ao longo do tempo
  const trendBoost = 1 + (asset.trend / 100) * (rand() * 0.3 + 0.4);
  const price = Math.round(asset.basePrice * trendBoost * liveOffset * 100) / 100;

  // Gera uma oscilação diária determinística e realista baseada na volatilidade do ativo
  const randVal = rand();
  const dailyVol = asset.volatility / 100 / Math.sqrt(252); // Desvio padrão diário (fração, ex: 0.011)
  const dailyVolPct = dailyVol * 100; // Desvio padrão diário em porcentagem (ex: 1.1%)
  
  // Variação determinística realista oscilando dentro de limites de desvio padrão
  const changePercentVal = (randVal - 0.5) * 2 * (dailyVolPct * 1.5) + (liveOffset - 1) * 100; 
  const changePercent = Math.round(changePercentVal * 100) / 100;

  // Calcula o fechamento anterior baseado no preço atual e na variação gerada
  const prevClose = Math.round((price / (1 + changePercent / 100)) * 100) / 100;
  const change = Math.round((price - prevClose) * 100) / 100;

  return {
    ticker: asset.ticker,
    price,
    change,
    changePercent,
    prevClose,
    marketTime: new Date().toISOString(),
    isReal: false,
  };
}

const COINCAP_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binance-coin",
  ADA: "cardano",
  XRP: "ripple",
  DOGE: "dogecoin",
  DOT: "polkadot",
  LINK: "chainlink",
  MATIC: "polygon"
};

const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  ADA: "cardano",
  XRP: "ripple",
  DOGE: "dogecoin",
  DOT: "polkadot",
  LINK: "chainlink",
  MATIC: "matic-network"
};

let cachedUsdBrl = 5.60;
let lastUsdBrlFetch = 0;

// Fonte de Câmbio: AwesomeAPI
async function fetchUsdBrlRate(): Promise<number> {
  if (Date.now() - lastUsdBrlFetch < 30 * 60 * 1000) { // cache de 30m
    return cachedUsdBrl;
  }
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    if (res.ok) {
      const json = await res.json();
      const val = parseFloat(json?.USDBRL?.bid);
      if (!isNaN(val) && val > 0) {
        cachedUsdBrl = val;
        lastUsdBrlFetch = Date.now();
      }
    }
  } catch (e) {
    console.warn("Erro ao obter cotação USD/BRL, usando conversão padrão tolerante", e);
  }
  return cachedUsdBrl;
}

let lastWorkingProxyIndex = 0;

// Utilitário central para realizar requisições CORS bypass robustas com 4 proxies redundantes
async function fetchJsonWithAllProxies(url: string, timeoutMs = 3000): Promise<any | null> {
  const proxies = [
    { name: "corsproxy.io", url: `https://corsproxy.io/?${encodeURIComponent(url)}`, isWrapper: false },
    { name: "allorigins-raw", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, isWrapper: false },
    { name: "codetabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, isWrapper: false },
    { name: "allorigins-get", url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, isWrapper: true },
  ];

  // Ordenação dinâmica para testar o último proxy funcional conhecido primeiro, cortando tempos de timeout
  const order: number[] = [];
  order.push(lastWorkingProxyIndex);
  for (let i = 0; i < proxies.length; i++) {
    if (i !== lastWorkingProxyIndex) {
      order.push(i);
    }
  }

  for (const idx of order) {
    const proxy = proxies[idx];
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(proxy.url, { signal: ctrl.signal });
      window.clearTimeout(timer);

      if (!res.ok) continue;

      let json: any;
      if (proxy.isWrapper) {
        const wrapper = await res.json();
        json = JSON.parse(wrapper.contents);
      } else {
        json = await res.json();
      }
      if (json) {
        lastWorkingProxyIndex = idx; // Se funcionou, salva este index para acelerar todas as próximas requisições instantaneamente
        return json;
      }
    } catch (e) {
      console.warn(`Proxy ${proxy.name} falhou para URL ${url}:`, e);
    }
  }
  return null;
}

// === PREMIUM SOURCE #1: Yahoo Finance Quote API (V7) super leve, rápida e precisa ===
async function tryFetchYahooQuote(ticker: string): Promise<PriceQuote | null> {
  const tickerUpper = ticker.toUpperCase();
  const asset = findAsset(tickerUpper);
  const isCrypto = asset ? asset.type === "crypto" : ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "LINK", "MATIC"].includes(tickerUpper);

  let yahooTicker = tickerUpper;
  if (!isCrypto) {
    if (!yahooTicker.includes(".")) {
      yahooTicker = `${yahooTicker}.SA`;
    }
  } else {
    yahooTicker = `${yahooTicker}-BRL`;
  }

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`;
  const json = await fetchJsonWithAllProxies(url, 3500);
  if (!json) return null;

  try {
    const result = json?.quoteResponse?.result?.[0];
    if (!result) return null;

    const regularPrice = result.regularMarketPrice;
    if (typeof regularPrice !== "number") return null;

    const prevClose = result.regularMarketPreviousClose ?? result.previousClose ?? regularPrice;
    const change = result.regularMarketChange ?? (regularPrice - prevClose);
    const changePercent = result.regularMarketChangePercent ?? (prevClose !== 0 ? (change / prevClose) * 100 : 0);

    return {
      ticker: tickerUpper,
      price: regularPrice,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      prevClose: Math.round(prevClose * 100) / 100,
      marketTime: new Date((result.regularMarketTime || (Date.now() / 1000)) * 1000).toISOString(),
      isReal: true,
    };
  } catch (e) {
    console.warn(`Erro ao tratar Yahoo Quote para ${ticker}:`, e);
    return null;
  }
}

// === PREMIUM SOURCE #2: Yahoo Finance Chart API com múltiplos Proxies ===
async function tryFetchYahooFinance(ticker: string, days = 180): Promise<{ quote: PriceQuote; history: HistoryPoint[] } | null> {
  const tickerUpper = ticker.toUpperCase();
  const asset = findAsset(tickerUpper);
  const isCrypto = asset ? asset.type === "crypto" : ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "LINK", "MATIC"].includes(tickerUpper);

  let yahooTicker = tickerUpper;
  if (!isCrypto) {
    if (!yahooTicker.includes(".")) {
      yahooTicker = `${yahooTicker}.SA`;
    }
  } else {
    yahooTicker = `${yahooTicker}-BRL`;
  }

  // Mapeia dias para a menor faixa do Yahoo para otimizar transferência
  const range = days <= 5 ? "5d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : days <= 180 ? "6mo" : days <= 365 ? "1y" : "5y";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=${range}`;

  const json = await fetchJsonWithAllProxies(url, 3500);
  if (!json) return null;

  try {
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const regularPrice = meta.regularMarketPrice;
    if (typeof regularPrice !== "number") return null;

    const prevClose = meta.regularMarketPreviousClose ?? meta.previousClose ?? meta.chartPreviousClose ?? regularPrice;
    const change = regularPrice - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    const quote: PriceQuote = {
      ticker: tickerUpper,
      price: regularPrice,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      prevClose: Math.round(prevClose * 100) / 100,
      marketTime: new Date((meta.regularMarketTime || (Date.now() / 1000)) * 1000).toISOString(),
      isReal: true,
    };

    const timestamps = result.timestamp || [];
    const indicators = result.indicators?.quote?.[0] || {};
    const closes = indicators.close || [];

    const history: HistoryPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      if (typeof price === "number") {
        const d = new Date(timestamps[i] * 1000);
        history.push({
          date: d.toISOString().split("T")[0],
          close: Math.round(price * 100) / 100,
        });
      }
    }

    history.sort((a, b) => a.date.localeCompare(b.date));

    return { quote, history };
  } catch (e) {
    console.warn(`Erro ao tratar Yahoo Finance Chart para ${ticker}:`, e);
    return null;
  }
}

// Fonte de Cripto #1: CoinCap API Global (com conversão USD -> BRL do AwesomeAPI)
async function tryFetchCoinCap(ticker: string, days = 180): Promise<{ quote: PriceQuote; history: HistoryPoint[] } | null> {
  const coinId = COINCAP_ID_MAP[ticker.toUpperCase()];
  if (!coinId) return null;

  const failKey = `coincap:${ticker.toUpperCase()}`;
  const lastFail = FAIL_CACHE[failKey] || 0;
  if (Date.now() - lastFail < 30 * 1000) { // Tenta re-checar após 30s se falhou antes
    return null;
  }

  try {
    const usdBrl = await fetchUsdBrlRate();
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 3000); // 3.0s timeout max
    const resAsset = await fetch(`https://api.coincap.io/v2/assets/${coinId}`, { signal: ctrl.signal });
    window.clearTimeout(timer);

    if (!resAsset.ok) {
      FAIL_CACHE[failKey] = Date.now();
      return null;
    }
    const jsonAsset = await resAsset.json();
    const data = jsonAsset?.data;
    if (!data || !data.priceUsd) {
      FAIL_CACHE[failKey] = Date.now();
      return null;
    }

    const priceUsd = parseFloat(data.priceUsd);
    const priceBrl = priceUsd * usdBrl;
    const changePercent = parseFloat(data.changePercent24Hr ?? "0");
    const change = priceBrl * (changePercent / 100);
    const prevClose = priceBrl - change;

    const quote: PriceQuote = {
      ticker: ticker.toUpperCase(),
      price: priceBrl,
      change,
      changePercent,
      prevClose,
      marketTime: new Date().toISOString(),
      isReal: true,
    };

    // Obter histórico de preços em USD
    const ctrlHist = new AbortController();
    const timerHist = window.setTimeout(() => ctrlHist.abort(), 3000); // 3.0s timeout max
    const resHist = await fetch(`https://api.coincap.io/v2/assets/${coinId}/history?interval=d1`, { signal: ctrlHist.signal });
    window.clearTimeout(timerHist);

    let history: HistoryPoint[] = [];
    if (resHist.ok) {
      const jsonHist = await resHist.json();
      const histData = jsonHist?.data;
      if (Array.isArray(histData)) {
        const startIdx = Math.max(0, histData.length - days);
        history = histData.slice(startIdx).map((item: any) => ({
          date: new Date(item.time).toISOString().split("T")[0],
          close: parseFloat(item.priceUsd) * usdBrl,
        }));
      }
    }

    return { quote, history };
  } catch (e) {
    FAIL_CACHE[failKey] = Date.now();
    return null;
  }
}

// Fonte de Cripto #2: AwesomeAPI BRL Direto para criptomoedas
async function tryFetchCryptoAwesomeAPI(ticker: string): Promise<PriceQuote | null> {
  const tickerUpper = ticker.toUpperCase();
  if (!["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "LINK", "MATIC"].includes(tickerUpper)) {
    return null;
  }

  const failKey = `awesome:${tickerUpper}`;
  const lastFail = FAIL_CACHE[failKey] || 0;
  if (Date.now() - lastFail < 30 * 1000) {
    return null;
  }

  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 3000); // 3.0s timeout
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${tickerUpper}-BRL`, { signal: ctrl.signal });
    window.clearTimeout(timer);

    if (!res.ok) {
      FAIL_CACHE[failKey] = Date.now();
      return null;
    }
    const json = await res.json();
    const data = json[tickerUpper + "BRL"];
    if (!data) {
      FAIL_CACHE[failKey] = Date.now();
      return null;
    }

    const price = parseFloat(data.bid ?? data.ask);
    const pctChange = parseFloat(data.pctChange ?? "0");
    const change = price * (pctChange / 100);
    const prevClose = price - change;

    return {
      ticker: tickerUpper,
      price,
      change,
      changePercent: pctChange,
      prevClose,
      marketTime: new Date(parseInt(data.timestamp) * 1000).toISOString(),
      isReal: true,
    };
  } catch (e) {
    FAIL_CACHE[failKey] = Date.now();
    return null;
  }
}

// Fonte de Cripto #3: CoinGecko API Global (BRL)
async function tryFetchCoinGecko(ticker: string): Promise<PriceQuote | null> {
  const coinId = COINGECKO_ID_MAP[ticker.toUpperCase()];
  if (!coinId) return null;

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=brl&include_24hr_change=true`;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 3000); // 3.0s timeout
    const res = await fetch(url, { signal: ctrl.signal });
    window.clearTimeout(timer);

    if (!res.ok) return null;
    const json = await res.json();
    const data = json[coinId];
    if (!data || typeof data.brl !== "number") return null;

    const price = data.brl;
    const changePercent = data.brl_24h_change ?? 0;
    const change = price - (price / (1 + changePercent / 100));
    const prevClose = price - change;

    return {
      ticker: ticker.toUpperCase(),
      price,
      change,
      changePercent,
      prevClose,
      marketTime: new Date().toISOString(),
      isReal: true,
    };
  } catch {
    return null;
  }
}

const BRAPI_BASE = "https://brapi.dev/api";

// Fonte de Ações #2: BRAPI com tratamento de erro
async function tryFetchBrapi(ticker: string, range = "3mo"): Promise<{ quote: PriceQuote; history: HistoryPoint[] } | null> {
  const failKey = ticker.toUpperCase();
  const lastFail = FAIL_CACHE[failKey] || 0;
  if (Date.now() - lastFail < 30 * 1000) {
    return null;
  }

  try {
    const url = `${BRAPI_BASE}/quote/${ticker}?range=${range}&interval=1d`;
    let json: any = null;
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 3000); // 3.0s timeout max
      const res = await fetch(url, { signal: ctrl.signal });
      window.clearTimeout(timer);
      if (res.ok) {
        json = await res.json();
      }
    } catch {
      // Ignora erro do fetch direto para tentar os proxies redundantes
    }

    if (!json) {
      json = await fetchJsonWithAllProxies(url, 3500);
    }

    if (!json) {
      FAIL_CACHE[failKey] = Date.now();
      return null;
    }

    const r = json?.results?.[0];
    if (!r || typeof r.regularMarketPrice !== "number") {
      FAIL_CACHE[failKey] = Date.now();
      return null;
    }

    const quote: PriceQuote = {
      ticker: r.symbol ?? ticker,
      price: r.regularMarketPrice,
      change: r.regularMarketChange ?? 0,
      changePercent: r.regularMarketChangePercent ?? 0,
      prevClose: r.regularMarketPreviousClose ?? r.regularMarketPrice,
      marketTime: r.regularMarketTime ?? new Date().toISOString(),
      isReal: true,
    };

    const history: HistoryPoint[] = Array.isArray(r.historicalDataPrice)
      ? r.historicalDataPrice.map((p: any) => ({
          date: new Date((p.date as number) * 1000).toISOString().split("T")[0],
          close: p.close ?? p.adjustedClose ?? r.regularMarketPrice,
        }))
      : [];

    return { quote, history };
  } catch {
    FAIL_CACHE[failKey] = Date.now();
    return null;
  }
}

// Fonte de Ações #3: HG Brasil Finance API
async function tryFetchHGBrasil(ticker: string): Promise<PriceQuote | null> {
  const tickerUpper = ticker.toUpperCase();
  try {
    const url = `https://api.hgbrasil.com/finance/stock_price?key=development&symbol=${tickerUpper}`;
    const json = await fetchJsonWithAllProxies(url, 3500);
    if (!json) return null;

    const stock = json?.results?.[tickerUpper];
    if (!stock || typeof stock.price !== "number") return null;

    const price = stock.price;
    const changePercent = stock.change_percent ?? 0;
    const change = price - (price / (1 + changePercent / 100));
    const prevClose = price - change;

    return {
      ticker: tickerUpper,
      price,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      prevClose: Math.round(prevClose * 100) / 100,
      marketTime: new Date().toISOString(),
      isReal: true,
    };
  } catch {
    return null;
  }
}

// === Auxiliares SWR para Revalidação Silenciosa e Loteamento de Requisições ===

let batchTimeout: any = null;
const pendingBatchTickers: Set<string> = new Set();
const batchCallbacks: Record<string, ((quote: PriceQuote) => void)[]> = {};
let isBatchForced = false;

async function executeBatchRequest() {
  const tickersToFetch = Array.from(pendingBatchTickers);
  pendingBatchTickers.clear();
  batchTimeout = null;

  const force = isBatchForced;
  isBatchForced = false;

  if (tickersToFetch.length === 0) return;

  const callbacksToResolve = { ...batchCallbacks };
  
  // Limpa as filas para o próximo lote
  for (const ticker of tickersToFetch) {
    delete batchCallbacks[ticker];
  }

  try {
    const res = await fetch(`/api/market/quotes?symbols=${tickersToFetch.join(",")}&force=${force ? "true" : "false"}`);
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Resposta do servidor não é um JSON válido. Presumindo ausência do backend em produção.");
      }
      const data = await res.json();
      const quotes = data?.quotes || {};

      for (const ticker of tickersToFetch) {
        const quote = quotes[ticker];
        const resolves = callbacksToResolve[ticker] || [];
        
        if (quote && typeof quote.price === "number") {
          QUOTE_CACHE[ticker] = { quote, ts: Date.now() };
          saveCachesToLocal();
          for (const cb of resolves) cb(quote);
        } else {
          // Fallback se não retornou cotação real no lote
          const existing = QUOTE_CACHE[ticker];
          if (existing && existing.quote && existing.quote.isReal !== false) {
            existing.ts = Date.now() - QUOTE_TTL + (15 * 60 * 1000);
            saveCachesToLocal();
            for (const cb of resolves) cb(existing.quote);
          } else {
            let asset = findAsset(ticker);
            if (!asset) {
              const isCrypto = ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "LINK", "MATIC"].includes(ticker);
              asset = {
                ticker,
                name: ticker,
                shortName: ticker,
                type: isCrypto ? "crypto" : "stock",
                logo: `https://icons.brapi.dev/icons/${ticker}.svg`,
                basePrice: 50,
                volatility: 22,
                trend: 0.3,
              };
            }
            const generated = generateMockQuote(asset);
            QUOTE_CACHE[ticker] = { quote: generated, ts: Date.now() };
            saveCachesToLocal();
            for (const cb of resolves) cb(generated);
          }
        }
      }
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[marketApi.ts] Erro ao buscar cotações do lote via api (/api/market/quotes):`, err, `. Tentando fallback de consulta direta do cliente...`);
    
    // Tenta obter cotações uma a uma via Sourcing do cliente para não quebrar em deploys estáticos/front-only!
    for (const ticker of tickersToFetch) {
      const resolves = callbacksToResolve[ticker] || [];
      try {
        // Tenta Yahoo Quote primeiro
        let quote = await tryFetchYahooQuote(ticker);
        if (!quote) {
          // Tenta Yahoo Chart
          const resChart = await tryFetchYahooFinance(ticker, 5);
          if (resChart) {
            quote = resChart.quote;
          }
        }
        if (!quote) {
          // Tenta CoinCap se for cripto
          const resCoin = await tryFetchCoinCap(ticker, 5);
          if (resCoin) {
            quote = resCoin.quote;
          }
        }
        
        if (quote) {
          QUOTE_CACHE[ticker] = { quote, ts: Date.now() };
          saveCachesToLocal();
          for (const cb of resolves) cb(quote);
          continue;
        }
      } catch (clientErr) {
        console.warn(`[marketApi.ts] Falha no fallback direto do cliente para ${ticker}:`, clientErr);
      }

      // Em caso de falha completa de rede/servidor para este ativo, resolve com cache existente ou gera mock
      const existing = QUOTE_CACHE[ticker];
      if (existing && existing.quote) {
        for (const cb of resolves) cb(existing.quote);
      } else {
        let asset = findAsset(ticker);
        if (!asset) {
          const isCrypto = ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "LINK", "MATIC"].includes(ticker);
          asset = {
            ticker,
            name: ticker,
            shortName: ticker,
            type: isCrypto ? "crypto" : "stock",
            logo: `https://icons.brapi.dev/icons/${ticker}.svg`,
            basePrice: 50,
            volatility: 22,
            trend: 0.3,
          };
        }
        const generated = generateMockQuote(asset);
        QUOTE_CACHE[ticker] = { quote: generated, ts: Date.now() };
        saveCachesToLocal();
        for (const cb of resolves) cb(generated);
      }
    }
  }
}

function fetchQuoteBatched(ticker: string): Promise<PriceQuote> {
  const tickerUpper = ticker.toUpperCase();
  return new Promise((resolve) => {
    if (!batchCallbacks[tickerUpper]) {
      batchCallbacks[tickerUpper] = [];
    }
    batchCallbacks[tickerUpper].push(resolve);
    pendingBatchTickers.add(tickerUpper);

    if (batchTimeout) clearTimeout(batchTimeout);
    batchTimeout = setTimeout(executeBatchRequest, 50);
  });
}

async function fetchQuoteFromNetwork(ticker: string, forceRefresh?: boolean): Promise<PriceQuote> {
  return fetchQuoteBatched(ticker);
}

function triggerBackgroundQuoteRevalidation(ticker: string) {
  const tickerUpper = ticker.toUpperCase();
  if (PENDING_QUOTES[tickerUpper]) return;

  const promise = (async () => {
    try {
      await fetchQuoteFromNetwork(tickerUpper);
    } catch {
      // Ignora erro silenciando em background
    } finally {
      delete PENDING_QUOTES[tickerUpper];
    }
  })();
  PENDING_QUOTES[tickerUpper] = promise.then(() => QUOTE_CACHE[tickerUpper]?.quote ?? fetchQuoteFromNetwork(tickerUpper));
}

async function fetchHistoryFromNetwork(ticker: string, days: number, forceRefresh?: boolean): Promise<HistoryPoint[]> {
  const tickerUpper = ticker.toUpperCase();
  const key = `${tickerUpper}-${days}`;

  let asset = findAsset(tickerUpper);
  if (!asset) {
    const isCrypto = ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "LINK", "MATIC"].includes(tickerUpper);
    asset = {
      ticker: tickerUpper,
      name: tickerUpper,
      shortName: tickerUpper,
      type: isCrypto ? "crypto" : "stock",
      logo: `https://icons.brapi.dev/icons/${tickerUpper}.svg`,
      basePrice: 50,
      volatility: 22,
      trend: 0.3,
    };
  }

  try {
    const res = await fetch(`/api/market/history?ticker=${tickerUpper}&days=${days}`);
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Resposta do histórico não é JSON válido.");
      }
      const data = await res.json();
      const history = data?.history;
      if (Array.isArray(history) && history.length > 0) {
        HISTORY_CACHE[key] = { history, ts: Date.now() };
        saveCachesToLocal();
        return history;
      }
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[marketApi.ts] Erro ao buscar histórico de servidor via api (/api/market/history) para ${tickerUpper}:`, err, `. Tentando fallback de histórico do cliente...`);
    try {
      // Tenta obter histórico diretamente do Yahoo no cliente usando CORS proxies
      const resChart = await tryFetchYahooFinance(tickerUpper, days);
      if (resChart && Array.isArray(resChart.history) && resChart.history.length > 0) {
        HISTORY_CACHE[key] = { history: resChart.history, ts: Date.now() };
        // Aproveita também para atualizar a cotação instantaneamente
        QUOTE_CACHE[tickerUpper] = { quote: resChart.quote, ts: Date.now() };
        saveCachesToLocal();
        return resChart.history;
      }

      // Se for cripto e não funcionou no Yahoo, tenta coincap
      const isCrypto = asset ? asset.type === "crypto" : ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "LINK", "MATIC"].includes(tickerUpper);
      if (isCrypto) {
        const resCoin = await tryFetchCoinCap(tickerUpper, days);
        if (resCoin && Array.isArray(resCoin.history) && resCoin.history.length > 0) {
          HISTORY_CACHE[key] = { history: resCoin.history, ts: Date.now() };
          QUOTE_CACHE[tickerUpper] = { quote: resCoin.quote, ts: Date.now() };
          saveCachesToLocal();
          return resCoin.history;
        }
      }
    } catch (clientErr) {
      console.warn(`[marketApi.ts] Falha no fallback de histórico direto do cliente para ${tickerUpper}:`, clientErr);
    }
  }

  // Fallback final seguro: se já houver um histórico real em cache, retorna ele em vez do mock gerado
  const existingHist = HISTORY_CACHE[key];
  if (existingHist && existingHist.history && existingHist.history.length > 0) {
    existingHist.ts = Date.now() - HISTORY_TTL + (15 * 60 * 1000); // adia próxima revalidação por 15m
    saveCachesToLocal();
    return existingHist.history;
  }

  // Fallback final: gerador de histórico determinístico realista baseado na última cotação
  const quote = await fetchQuoteFromNetwork(tickerUpper, forceRefresh);
  const history = generateMockHistory(asset, days, quote.price);
  HISTORY_CACHE[key] = { history, ts: Date.now() };
  saveCachesToLocal();
  return history;
}

function triggerBackgroundHistoryRevalidation(ticker: string, days: number) {
  const tickerUpper = ticker.toUpperCase();
  const key = `${tickerUpper}-${days}`;
  if (PENDING_HISTORIES[key]) return;

  const promise = (async () => {
    try {
      await fetchHistoryFromNetwork(tickerUpper, days);
    } catch {
      // Ignora silenciando em background
    } finally {
      delete PENDING_HISTORIES[key];
    }
  })();
  PENDING_HISTORIES[key] = promise.then(() => HISTORY_CACHE[key]?.history ?? fetchHistoryFromNetwork(tickerUpper, days));
}

// === API pública ===

export async function getQuote(ticker: string, forceRefresh?: boolean): Promise<PriceQuote> {
  const tickerUpper = ticker.toUpperCase();

  if (forceRefresh) {
    delete FAIL_CACHE[tickerUpper];
    delete FAIL_CACHE[`coincap:${tickerUpper}`];
    delete FAIL_CACHE[`awesome:${tickerUpper}`];
    isBatchForced = true;
    // Mantemos QUOTE_CACHE[tickerUpper] intacto para servir de fallback seguro se a rede ou proxies falharem
  } else {
    const cached = QUOTE_CACHE[tickerUpper];
    if (cached && cached.quote) {
      // Se a cotação estiver dentro do TTL, retorna imediato sinergeticamente
      if (Date.now() - cached.ts < QUOTE_TTL) {
        return cached.quote;
      }
    }
  }

  if (!forceRefresh && PENDING_QUOTES[tickerUpper]) {
    return PENDING_QUOTES[tickerUpper];
  }

  const promise = (async () => {
    try {
      return await fetchQuoteFromNetwork(tickerUpper, forceRefresh);
    } catch (err) {
      const cached = QUOTE_CACHE[tickerUpper];
      if (cached && cached.quote) {
        console.warn(`[getQuote] Falha de rede para ${tickerUpper}, usando fallback de cache expirado.`);
        return cached.quote;
      }
      throw err;
    } finally {
      delete PENDING_QUOTES[tickerUpper];
    }
  })();

  PENDING_QUOTES[tickerUpper] = promise;
  return promise;
}

export async function getHistory(ticker: string, days = 180, forceRefresh?: boolean): Promise<HistoryPoint[]> {
  const bucketedDays = days <= 30 ? 30 : days <= 90 ? 90 : days <= 180 ? 180 : days <= 365 ? 365 : Math.ceil(days / 90) * 90;
  days = bucketedDays;

  const tickerUpper = ticker.toUpperCase();
  const key = `${tickerUpper}-${days}`;

  if (forceRefresh) {
    delete FAIL_CACHE[tickerUpper];
    delete FAIL_CACHE[`coincap:${tickerUpper}`];
    // Mantemos o HISTORY_CACHE[key] intacto como fallback de contingência se a rede ou proxies falharem
  } else {
    const cached = HISTORY_CACHE[key];
    const isCorrupted = cached && days > 15 && cached.history && cached.history.length < 15;
    if (cached && !isCorrupted) {
      if (Date.now() - cached.ts < HISTORY_TTL) {
        return cached.history;
      }
    }
  }

  if (!forceRefresh && PENDING_HISTORIES[key]) {
    return PENDING_HISTORIES[key];
  }

  const promise = (async () => {
    try {
      return await fetchHistoryFromNetwork(tickerUpper, days, forceRefresh);
    } catch (err) {
      const cached = HISTORY_CACHE[key];
      if (cached && cached.history) {
        console.warn(`[getHistory] Falha de rede para ${key}, usando cache expirado.`);
        return cached.history;
      }
      throw err;
    } finally {
      delete PENDING_HISTORIES[key];
    }
  })();

  PENDING_HISTORIES[key] = promise;
  return promise;
}

// Retorna preço estimado para uma data passada (busca no histórico)
export async function getPriceOnDate(ticker: string, dateISO: string): Promise<number> {
  const targetStr = dateISO.slice(0, 10);
  // Se for hoje, retorna diretamente a cotação em tempo real e de fechamento mais atual!
  if (targetStr === todayISO()) {
    const q = await getQuote(ticker, false);
    return q.price;
  }

  const target = new Date(dateISO).getTime();
  const now = Date.now();
  const daysAgo = Math.max(7, Math.ceil((now - target) / (24 * 60 * 60 * 1000)) + 30);
  const history = await getHistory(ticker, Math.min(daysAgo, 1825)); // até 5 anos

  if (history.length === 0) {
    const q = await getQuote(ticker);
    return q.price;
  }

  // Acha o ponto mais próximo da data alvo
  let closest = history[0];
  let closestDiff = Math.abs(new Date(closest.date).getTime() - target);
  for (const p of history) {
    const diff = Math.abs(new Date(p.date).getTime() - target);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = p;
    }
  }
  return closest.close;
}

export function getApiHealthStatus() {
  const isCoinCapFailed = (FAIL_CACHE["coincap:BTC"] || 0) > 0 || (FAIL_CACHE["coincap:ETH"] || 0) > 0;
  const isAwesomeFailed = (FAIL_CACHE["awesome:BTC"] || 0) > 0;
  
  // Se houver qualquer ticker em falha recente
  const failedTickersCount = Object.keys(FAIL_CACHE).filter(k => FAIL_CACHE[k] > 0).length;
  const isBrapiFailed = failedTickersCount > 2;

  return {
    coinCap: isCoinCapFailed ? "fallback" : "online",
    awesomeApi: isAwesomeFailed ? "offline" : "online",
    brapi: isBrapiFailed ? "fallback" : "online",
    cachedQuotes: Object.keys(QUOTE_CACHE).length,
    cachedHistories: Object.keys(HISTORY_CACHE).length,
  };
}

export function clearAllMarketCaches() {
  // Esvazia caches em memória sem quebrar as referências const
  for (const k of Object.keys(QUOTE_CACHE)) {
    delete QUOTE_CACHE[k];
  }
  for (const k of Object.keys(HISTORY_CACHE)) {
    delete HISTORY_CACHE[k];
  }
  for (const k of Object.keys(FAIL_CACHE)) {
    delete FAIL_CACHE[k];
  }
  
  // Limpa localStorage de caches e falhas de rede
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LOCAL_QUOTE_KEY);
      window.localStorage.removeItem(LOCAL_HIST_KEY);
      
      // Expulsa outros possíveis resíduos
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (key && (key.includes("market") || key.includes("cache") || key.includes("quote") || key.includes("hist"))) {
          window.localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}

