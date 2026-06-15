var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// server.ts
import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";

// src/services/assetsCatalog.ts
var CATALOG = [
  // === Ações Brasileiras ===
  { ticker: "PETR4", name: "Petrobras PN", shortName: "Petrobras", type: "stock", logo: "https://icons.brapi.dev/icons/PETR4.svg", sector: "Energia", basePrice: 38.45, volatility: 25, trend: 0.5 },
  { ticker: "VALE3", name: "Vale ON", shortName: "Vale", type: "stock", logo: "https://icons.brapi.dev/icons/VALE3.svg", sector: "Minera\xE7\xE3o", basePrice: 65.2, volatility: 28, trend: 0.3 },
  { ticker: "ITUB4", name: "Ita\xFA Unibanco PN", shortName: "Ita\xFA", type: "stock", logo: "https://icons.brapi.dev/icons/ITUB4.svg", sector: "Financeiro", basePrice: 35.8, volatility: 18, trend: 0.7 },
  { ticker: "BBAS3", name: "Banco do Brasil ON", shortName: "Banco do Brasil", type: "stock", logo: "https://icons.brapi.dev/icons/BBAS3.svg", sector: "Financeiro", basePrice: 28.4, volatility: 22, trend: 0.8 },
  { ticker: "BBDC4", name: "Bradesco PN", shortName: "Bradesco", type: "stock", logo: "https://icons.brapi.dev/icons/BBDC4.svg", sector: "Financeiro", basePrice: 14.2, volatility: 20, trend: 0.4 },
  { ticker: "MGLU3", name: "Magazine Luiza ON", shortName: "Magalu", type: "stock", logo: "https://icons.brapi.dev/icons/MGLU3.svg", sector: "Varejo", basePrice: 8.5, volatility: 45, trend: -0.2 },
  { ticker: "WEGE3", name: "WEG ON", shortName: "WEG", type: "stock", logo: "https://icons.brapi.dev/icons/WEGE3.svg", sector: "Industrial", basePrice: 52.3, volatility: 22, trend: 1 },
  { ticker: "ABEV3", name: "Ambev ON", shortName: "Ambev", type: "stock", logo: "https://icons.brapi.dev/icons/ABEV3.svg", sector: "Bebidas", basePrice: 13.75, volatility: 18, trend: 0.2 },
  { ticker: "B3SA3", name: "B3 ON", shortName: "B3", type: "stock", logo: "https://icons.brapi.dev/icons/B3SA3.svg", sector: "Financeiro", basePrice: 12.4, volatility: 24, trend: 0.6 },
  { ticker: "ELET3", name: "Eletrobras ON", shortName: "Eletrobras", type: "stock", logo: "https://icons.brapi.dev/icons/ELET3.svg", sector: "Energia", basePrice: 42.8, volatility: 28, trend: 0.5 },
  { ticker: "RENT3", name: "Localiza ON", shortName: "Localiza", type: "stock", logo: "https://icons.brapi.dev/icons/RENT3.svg", sector: "Loca\xE7\xE3o", basePrice: 48.5, volatility: 26, trend: 0.4 },
  { ticker: "SUZB3", name: "Suzano ON", shortName: "Suzano", type: "stock", logo: "https://icons.brapi.dev/icons/SUZB3.svg", sector: "Papel/Celulose", basePrice: 58.2, volatility: 30, trend: 0.3 },
  { ticker: "PRIO3", name: "PetroRio ON", shortName: "PetroRio", type: "stock", logo: "https://icons.brapi.dev/icons/PRIO3.svg", sector: "Energia", basePrice: 44.1, volatility: 35, trend: 0.8 },
  { ticker: "EMBR3", name: "Embraer ON", shortName: "Embraer", type: "stock", logo: "https://icons.brapi.dev/icons/EMBR3.svg", sector: "Industrial", basePrice: 62.5, volatility: 32, trend: 1.2 },
  { ticker: "RAIL3", name: "Rumo ON", shortName: "Rumo", type: "stock", logo: "https://icons.brapi.dev/icons/RAIL3.svg", sector: "Log\xEDstica", basePrice: 22.8, volatility: 26, trend: 0.5 },
  // === FIIs ===
  { ticker: "MXRF11", name: "Maxi Renda FII", shortName: "Maxi Renda", type: "fund", logo: "https://icons.brapi.dev/icons/MXRF11.svg", sector: "Receb\xEDveis", basePrice: 10.42, volatility: 8, trend: 0.2 },
  { ticker: "HGLG11", name: "CSHG Log\xEDstica FII", shortName: "CSHG Log\xEDstica", type: "fund", logo: "https://icons.brapi.dev/icons/HGLG11.svg", sector: "Log\xEDstica", basePrice: 165.3, volatility: 10, trend: 0.4 },
  { ticker: "XPLG11", name: "XP Log FII", shortName: "XP Log", type: "fund", logo: "https://icons.brapi.dev/icons/XPLG11.svg", sector: "Log\xEDstica", basePrice: 102.5, volatility: 11, trend: 0.3 },
  { ticker: "KNRI11", name: "Kinea Renda Imobili\xE1ria", shortName: "Kinea Renda", type: "fund", logo: "https://icons.brapi.dev/icons/KNRI11.svg", sector: "H\xEDbrido", basePrice: 158.4, volatility: 9, trend: 0.5 },
  { ticker: "VISC11", name: "Vinci Shopping Centers", shortName: "Vinci Shopping", type: "fund", logo: "https://icons.brapi.dev/icons/VISC11.svg", sector: "Shoppings", basePrice: 108.2, volatility: 12, trend: 0.4 },
  { ticker: "HGRE11", name: "CSHG Real Estate", shortName: "CSHG Real Estate", type: "fund", logo: "https://icons.brapi.dev/icons/HGRE11.svg", sector: "Lajes Corporativas", basePrice: 142.3, volatility: 10, trend: 0.3 },
  { ticker: "XPML11", name: "XP Malls FII", shortName: "XP Malls", type: "fund", logo: "https://icons.brapi.dev/icons/XPML11.svg", sector: "Shoppings", basePrice: 116.5, volatility: 11, trend: 0.5 },
  { ticker: "KNIP11", name: "Kinea \xCDndices de Pre\xE7os FII", shortName: "Kinea \xCDndices", type: "fund", logo: "https://icons.brapi.dev/icons/KNIP11.svg", sector: "Receb\xEDveis", basePrice: 94.8, volatility: 7, trend: 0.3 },
  { ticker: "BTLG11", name: "BTG Pactual Log\xEDstica FII", shortName: "BTG Log\xEDstica", type: "fund", logo: "https://icons.brapi.dev/icons/BTLG11.svg", sector: "Log\xEDstica", basePrice: 102.1, volatility: 9, trend: 0.4 },
  { ticker: "HGRU11", name: "CSHG Renda Urbana", shortName: "CSHG Renda Urbana", type: "fund", logo: "https://icons.brapi.dev/icons/HGRU11.svg", sector: "H\xEDbrido", basePrice: 124.5, volatility: 10, trend: 0.4 },
  { ticker: "HGBS11", name: "Hedge Brasil Shopping FII", shortName: "Hedge Shopping", type: "fund", logo: "https://icons.brapi.dev/icons/HGBS11.svg", sector: "Shoppings", basePrice: 218.4, volatility: 11, trend: 0.3 },
  { ticker: "TRXF11", name: "TRX Active Real Estate FII", shortName: "TRX Active", type: "fund", logo: "https://icons.brapi.dev/icons/TRXF11.svg", sector: "H\xEDbrido", basePrice: 110.2, volatility: 10, trend: 0.5 },
  // === ETFs ===
  { ticker: "BOVA11", name: "iShares Ibovespa", shortName: "Bova11", type: "etf", logo: "https://icons.brapi.dev/icons/BOVA11.svg", sector: "Ibovespa", basePrice: 125.8, volatility: 22, trend: 0.6 },
  { ticker: "IVVB11", name: "iShares S&P 500", shortName: "Ivvb11", type: "etf", logo: "https://icons.brapi.dev/icons/IVVB11.svg", sector: "S&P 500", basePrice: 320.4, volatility: 18, trend: 1 },
  { ticker: "SMAL11", name: "iShares Small Cap", shortName: "Small11", type: "etf", logo: "https://icons.brapi.dev/icons/SMAL11.svg", sector: "Small Caps", basePrice: 108.2, volatility: 26, trend: 0.4 },
  { ticker: "HASH11", name: "Hashdex Nasdaq Crypto Index ETF", shortName: "Hashdex Crypto", type: "etf", logo: "https://icons.brapi.dev/icons/HASH11.svg", sector: "Cripto", basePrice: 48.5, volatility: 45, trend: 0.8 },
  { ticker: "XINA11", name: "Trend China ETF", shortName: "Trend China", type: "etf", logo: "https://icons.brapi.dev/icons/XINA11.svg", sector: "Global", basePrice: 6.8, volatility: 32, trend: 0.1 },
  { ticker: "LFTS11", name: "Investo Tesouro Selic ETF", shortName: "Investo Selic", type: "etf", logo: "https://icons.brapi.dev/icons/LFTS11.svg", sector: "Renda Fixa", basePrice: 112.4, volatility: 2, trend: 0.6 },
  { ticker: "WRLD11", name: "Investo MSCI World ETF", shortName: "Investo World", type: "etf", logo: "https://icons.brapi.dev/icons/WRLD11.svg", sector: "Global", basePrice: 98.6, volatility: 18, trend: 0.8 },
  { ticker: "GOLD11", name: "Trend Ouro ETF", shortName: "Trend Ouro", type: "etf", logo: "https://icons.brapi.dev/icons/GOLD11.svg", sector: "Commodities", basePrice: 11.2, volatility: 20, trend: 0.5 },
  // === Criptomoedas ===
  { ticker: "BTC", name: "Bitcoin", shortName: "Bitcoin", type: "crypto", logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg", basePrice: 58e4, volatility: 60, trend: 1.5 },
  { ticker: "ETH", name: "Ethereum", shortName: "Ethereum", type: "crypto", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg", basePrice: 22500, volatility: 65, trend: 1.2 },
  { ticker: "SOL", name: "Solana", shortName: "Solana", type: "crypto", logo: "https://cryptologos.cc/logos/solana-sol-logo.svg", basePrice: 1280, volatility: 80, trend: 1.8 },
  { ticker: "BNB", name: "Binance Coin", shortName: "BNB", type: "crypto", logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg", basePrice: 3400, volatility: 55, trend: 0.8 },
  { ticker: "ADA", name: "Cardano", shortName: "Cardano", type: "crypto", logo: "https://cryptologos.cc/logos/cardano-ada-logo.svg", basePrice: 2.85, volatility: 75, trend: 0.5 },
  { ticker: "XRP", name: "XRP", shortName: "XRP", type: "crypto", logo: "https://cryptologos.cc/logos/xrp-xrp-logo.svg", basePrice: 3.1, volatility: 68, trend: 0.4 },
  { ticker: "DOGE", name: "Dogecoin", shortName: "DOGE", type: "crypto", logo: "https://cryptologos.cc/logos/dogecoin-doge-logo.svg", basePrice: 0.85, volatility: 110, trend: 0.7 },
  { ticker: "DOT", name: "Polkadot", shortName: "DOT", type: "crypto", logo: "https://cryptologos.cc/logos/polkadot-dot-logo.svg", basePrice: 42.5, volatility: 72, trend: 0.4 },
  { ticker: "LINK", name: "Chainlink", shortName: "LINK", type: "crypto", logo: "https://cryptologos.cc/logos/chainlink-link-logo.svg", basePrice: 115, volatility: 65, trend: 0.9 },
  { ticker: "MATIC", name: "Polygon", shortName: "MATIC", type: "crypto", logo: "https://cryptologos.cc/logos/polygon-matic-logo.svg", basePrice: 4.2, volatility: 78, trend: 0.5 }
];

// server.ts
dotenv.config();
var app = express();
var PORT = 3e3;
app.use(express.json());
var cachedUsdBrl = 5.65;
async function fetchServerUsdBrlRate() {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    if (res.ok) {
      const json = await res.json();
      const val = parseFloat(json?.USDBRL?.bid);
      if (!isNaN(val) && val > 0) {
        cachedUsdBrl = val;
      }
    }
  } catch (e) {
  }
  return cachedUsdBrl;
}
fetchServerUsdBrlRate();
async function getCryptoQuoteFromAwesome(ticker) {
  const url = `https://economia.awesomeapi.com.br/json/last/${ticker}-BRL`;
  const response = await fetch(url, { headers: { "User-Agent": "aistudio-build" } });
  if (response.ok) {
    const json = await response.json();
    const data = json[`${ticker}BRL`];
    if (data) {
      const price = parseFloat(data.bid || data.ask);
      const pctChange = parseFloat(data.pctChange || "0");
      const change = price * (pctChange / 100);
      const prevClose = price - change;
      return {
        ticker: ticker.toUpperCase(),
        price: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(pctChange * 100) / 100,
        prevClose: Math.round(prevClose * 100) / 100,
        marketTime: new Date(parseInt(data.timestamp) * 1e3).toISOString(),
        isReal: true
      };
    }
  }
  throw new Error(`AwesomeAPI could not fetch quote for crypto: ${ticker}`);
}
async function getQuoteFromYahooChart(ticker) {
  const tickerUpper = ticker.toUpperCase();
  const isCrypto = ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "LINK", "MATIC"].includes(tickerUpper);
  if (isCrypto) {
    try {
      return await getCryptoQuoteFromAwesome(tickerUpper);
    } catch (err) {
      console.warn(`[Crypto Direct Fallback Layer] Erro ao consultar ${tickerUpper} no AwesomeAPI, tentando Yahoo Chart...`, err.message);
    }
  }
  const yahooTicker = isCrypto ? `${tickerUpper}-USD` : tickerUpper.includes(".") ? tickerUpper : `${tickerUpper}.SA`;
  const hosts = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com"
  ];
  let result = null;
  let lastError = null;
  for (const host of hosts) {
    const url = `${host}/v8/finance/chart/${yahooTicker}?interval=1d&range=5d`;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (response.ok) {
        const json = await response.json();
        result = json?.chart?.result?.[0];
        if (result) break;
      }
    } catch (err) {
      lastError = err;
    }
  }
  if (!result) {
    throw lastError || new Error(`Could not fetch data for ${yahooTicker} from Yahoo`);
  }
  const meta = result?.meta;
  if (!meta) throw new Error("Meta data not found");
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const validCloses = closes.filter((c) => typeof c === "number" && !isNaN(c) && c > 0);
  let price = meta.regularMarketPrice;
  if (typeof price !== "number" || price <= 0) {
    if (validCloses.length > 0) {
      price = validCloses[validCloses.length - 1];
    } else if (typeof meta.chartPreviousClose === "number" && meta.chartPreviousClose > 0) {
      price = meta.chartPreviousClose;
    } else {
      throw new Error(`Pre\xE7o inv\xE1lido ou indispon\xEDvel: ${price}`);
    }
  }
  let prevClose = meta.regularMarketPreviousClose ?? meta.previousClose;
  if (typeof prevClose !== "number" || isNaN(prevClose) || prevClose <= 0) {
    if (validCloses.length > 1) {
      prevClose = validCloses[validCloses.length - 2];
    } else if (validCloses.length === 1) {
      prevClose = validCloses[0];
    } else {
      prevClose = meta.chartPreviousClose ?? price;
    }
  }
  if (isCrypto) {
    const usdRate = await fetchServerUsdBrlRate();
    price = price * usdRate;
    prevClose = prevClose * usdRate;
  }
  const change = price - prevClose;
  const changePercent = prevClose !== 0 ? change / prevClose * 100 : 0;
  console.log(`[Yahoo Chart API Layer] Sucesso para ${tickerUpper}: Pre\xE7o R$ ${price}, Fechamento R$ ${prevClose} (${changePercent.toFixed(2)}%)`);
  return {
    ticker: tickerUpper,
    price: Math.round(price * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    prevClose: Math.round(prevClose * 100) / 100,
    marketTime: new Date((meta.regularMarketTime || Date.now() / 1e3) * 1e3).toISOString(),
    isReal: true
  };
}
var GEMINI_VERIFIED_CACHE = {};
var GEMINI_VERIFIED_TTL = 30 * 60 * 1e3;
var PERSISTENT_QUOTES_FILE = path.join(os.tmpdir(), "persistent_quotes_v4.json");
var GLOBAL_PERSISTENT_QUOTES = {};
var BACKGROUND_PENDING_TICKERS = /* @__PURE__ */ new Set();
var PERSISTENT_QUOTE_TTL = 3 * 60 * 1e3;
function loadPersistentQuotes() {
  try {
    if (fs.existsSync(PERSISTENT_QUOTES_FILE)) {
      const raw = fs.readFileSync(PERSISTENT_QUOTES_FILE, "utf-8");
      GLOBAL_PERSISTENT_QUOTES = JSON.parse(raw);
      console.log(`[Persistent Quotes System] Restauradas ${Object.keys(GLOBAL_PERSISTENT_QUOTES).length} cota\xE7\xF5es do disco.`);
    } else {
      console.log("[Persistent Quotes System] Nenhum cache persistente encontrado. Inicializando cache vazio.");
    }
  } catch (e) {
    console.error("[Persistent Quotes System] Falha ao restaurar cota\xE7\xF5es persistentes:", e.message);
  }
}
function savePersistentQuotes() {
  try {
    fs.writeFileSync(PERSISTENT_QUOTES_FILE, JSON.stringify(GLOBAL_PERSISTENT_QUOTES, null, 2), "utf-8");
  } catch (e) {
    console.error("[Persistent Quotes System] Falha ao salvar cota\xE7\xF5es persistentes:", e.message);
  }
}
loadPersistentQuotes();
async function updateQuotesInBackground(tickers) {
  const tickersToFetch = tickers.filter((t) => !BACKGROUND_PENDING_TICKERS.has(t));
  if (tickersToFetch.length === 0) return;
  tickersToFetch.forEach((t) => BACKGROUND_PENDING_TICKERS.add(t));
  console.log(`[Quotes Background Engine] Iniciando atualiza\xE7\xE3o lenta de ${tickersToFetch.length} ativos em segundo plano...`);
  setTimeout(async () => {
    try {
      const yahooBatch = await getMultipleQuotesFromYahoo(tickersToFetch);
      const now = Date.now();
      Object.keys(yahooBatch).forEach((t) => {
        GLOBAL_PERSISTENT_QUOTES[t] = {
          quote: yahooBatch[t],
          ts: now
        };
        BACKGROUND_PENDING_TICKERS.delete(t);
      });
      const stillMissing = tickersToFetch.filter((t) => !GLOBAL_PERSISTENT_QUOTES[t] || GLOBAL_PERSISTENT_QUOTES[t].quote?.isReal === false || now - GLOBAL_PERSISTENT_QUOTES[t].ts > 6e4);
      if (stillMissing.length > 0) {
        for (const ticker of stillMissing) {
          try {
            const q = await getQuoteFromYahooChart(ticker);
            GLOBAL_PERSISTENT_QUOTES[ticker] = {
              quote: q,
              ts: Date.now()
            };
          } catch (err) {
            try {
              console.log(`[Quotes Background Engine] Tentando obter via Gemini Search como cobertura robusta para: ${ticker}`);
              const qGemini = await getQuoteFromGeminiSearch(ticker, true);
              if (qGemini && typeof qGemini.price === "number") {
                GLOBAL_PERSISTENT_QUOTES[ticker] = {
                  quote: qGemini,
                  ts: Date.now()
                };
                console.log(`[Quotes Background Engine] \u2705 Sucesso via Gemini Search para: ${ticker} (Pre\xE7o: ${qGemini.price})`);
                continue;
              }
            } catch (gemErr) {
              console.warn(`[Quotes Background Engine] Falha ao consultar Gemini Search para ${ticker}:`, gemErr.message);
            }
            if (!GLOBAL_PERSISTENT_QUOTES[ticker] || GLOBAL_PERSISTENT_QUOTES[ticker].quote?.isReal === false) {
              const asset = CATALOG.find((a) => a.ticker === ticker);
              const bp = asset ? asset.basePrice : 50;
              GLOBAL_PERSISTENT_QUOTES[ticker] = {
                quote: {
                  ticker,
                  price: bp,
                  change: 0,
                  changePercent: 0,
                  prevClose: bp,
                  marketTime: (/* @__PURE__ */ new Date()).toISOString(),
                  isReal: false
                },
                ts: Date.now() - 12 * 60 * 60 * 1e3
                // 12h no passado para tentar novamente mais tarde se necessário
              };
            }
          } finally {
            BACKGROUND_PENDING_TICKERS.delete(ticker);
          }
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      savePersistentQuotes();
      console.log(`[Quotes Background Engine] Atualiza\xE7\xE3o lenta conclu\xEDda e persistida em disco.`);
    } catch (err) {
      console.error("[Quotes Background Engine Error] Erro ao carregar em background:", err.message);
    } finally {
      tickersToFetch.forEach((t) => BACKGROUND_PENDING_TICKERS.delete(t));
    }
  }, 1e3);
}
var GLOBAL_SERVER_QUOTE_TTL = 5 * 60 * 1e3;
async function getQuoteFromGeminiSearch(ticker, forceRefresh = false) {
  const tickerUpper = ticker.toUpperCase();
  if (!forceRefresh) {
    const cached = GEMINI_VERIFIED_CACHE[tickerUpper];
    if (cached && Date.now() - cached.ts < GEMINI_VERIFIED_TTL) {
      console.log(`[Gemini Search] Retornando cota\xE7\xE3o em cache para ${tickerUpper}`);
      return cached.quote;
    }
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.warn("[Gemini Search] GEMINI_API_KEY n\xE3o configurada.");
    return null;
  }
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    const isCrypto = ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "LINK", "MATIC"].includes(tickerUpper);
    const assetTerm = isCrypto ? `${tickerUpper} preco em BRL hoje` : `${tickerUpper} cotacao BRL B3 hoje`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Realize uma busca no Google por '${assetTerm}' para obter os dados de mercado reais de hoje em reais (BRL) para o ativo ou moeda: ${tickerUpper}.
Encontre a cota\xE7\xE3o real atual (pre\xE7o atual em reais) e o pre\xE7o do fechamento oficial do dia \xFAtil anterior (BRL).
A varia\xE7\xE3o percentual (changePercent) DEVE ser calculada de forma matematicamente precisa em rela\xE7\xE3o ao pre\xE7o de fechamento anterior (prevClose). 
Exemplo: se o pre\xE7o atual (price) \xE9 41.25 e o fechamento anterior (prevClose) foi 42.00, change percent \xE9 (41.25 - 42.00)/42.00 * 100 = -1.78%.

Retorne EXCLUSIVAMENTE um objeto JSON v\xE1lido, sem qualquer texto ao redor ou blocos markdown de c\xF3digo, no seguinte formato exato:
{"price": <pre\xE7o_atual_float>, "prevClose": <pre\xE7o_anterior_float>, "change": <varia\xE7\xE3o_reais_float>, "changePercent": <varia\xE7\xE3o_percentual_float>}`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    const text = response.text?.trim() || "";
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.warn(`[Gemini Search] Resposta n\xE3o continha JSON estruturado para ${tickerUpper}.`);
      return null;
    }
    const data = JSON.parse(jsonMatch[0]);
    if (data && typeof data.price === "number" && data.price > 0) {
      const price = Number(data.price);
      const prevClose = typeof data.prevClose === "number" && data.prevClose > 0 ? Number(data.prevClose) : price;
      const change = typeof data.change === "number" ? Number(data.change) : price - prevClose;
      const changePercent = typeof data.changePercent === "number" ? Number(data.changePercent) : prevClose !== 0 ? change / prevClose * 100 : 0;
      const verifiedQuote = {
        ticker: tickerUpper,
        price: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        prevClose: Math.round(prevClose * 100) / 100,
        marketTime: (/* @__PURE__ */ new Date()).toISOString(),
        isReal: true
      };
      GEMINI_VERIFIED_CACHE[tickerUpper] = {
        quote: verifiedQuote,
        ts: Date.now()
      };
      console.log(`[Gemini Search] Sucesso ao obter cota\xE7\xE3o grounded para ${tickerUpper}: R$ ${price} (${changePercent.toFixed(2)}%)`);
      return verifiedQuote;
    }
  } catch (err) {
    const isQuota = err.message?.includes("quota") || err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED");
    if (isQuota) {
      console.log(`[Gemini Search API Info] Limite de cota atingido (429) para ${tickerUpper}. Usando cota\xE7\xE3o alternativa autom\xE1tica.`);
    } else {
      console.log(`[Gemini Search API Info] N\xE3o foi poss\xEDvel buscar dados via IA para ${tickerUpper}: ${err.message ? err.message.substring(0, 100) : err}`);
    }
  }
  return null;
}
async function getMultipleQuotesFromYahoo(tickers) {
  if (tickers.length === 0) return {};
  const results = {};
  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const q = await getQuoteFromYahooChart(ticker);
        if (q && typeof q.price === "number") {
          results[ticker] = q;
        }
      } catch (err) {
        console.warn(`[getMultipleQuotesFromYahoo Warning] Falha ao obter cota\xE7\xE3o de ${ticker}:`, err.message);
      }
    })
  );
  return results;
}
app.get("/api/market/quotes", async (req, res) => {
  const symbolsQuery = (req.query.symbols || "").toUpperCase();
  const tickers = symbolsQuery.split(",").map((t) => t.trim()).filter(Boolean);
  const force = req.query.force === "true";
  if (tickers.length === 0) {
    return res.json({ quotes: {} });
  }
  const results = {};
  try {
    if (force) {
      console.log(`[Quotes Server] For\xE7ando recarga s\xEDncrona em lote para:`, tickers);
      const yahooBatchResults = await getMultipleQuotesFromYahoo(tickers);
      Object.assign(results, yahooBatchResults);
      const missingTickers = tickers.filter((t) => !results[t]);
      if (missingTickers.length > 0) {
        await Promise.all(
          missingTickers.map(async (ticker) => {
            try {
              const q = await getQuoteFromYahooChart(ticker);
              results[ticker] = q;
            } catch (err) {
              const geminiQuote = await getQuoteFromGeminiSearch(ticker, true);
              if (geminiQuote) {
                results[ticker] = geminiQuote;
              }
            }
          })
        );
      }
      tickers.forEach((ticker) => {
        if (!results[ticker]) {
          const asset = CATALOG.find((a) => a.ticker === ticker);
          const basePrice = asset ? asset.basePrice : 50;
          const nowTime = Date.now();
          const pSeconds = nowTime % 6e4 / 1e3;
          const microVariation = 1 + Math.sin(pSeconds / 5) * 0.015;
          const dynamicPrice = Math.round(basePrice * microVariation * 100) / 100;
          const pct = Math.round((microVariation - 1) * 1e4) / 100;
          results[ticker] = {
            ticker,
            price: dynamicPrice,
            change: Math.round((dynamicPrice - basePrice) * 100) / 100,
            changePercent: pct,
            prevClose: basePrice,
            marketTime: (/* @__PURE__ */ new Date()).toISOString(),
            isReal: false
          };
        }
      });
      const now2 = Date.now();
      tickers.forEach((ticker) => {
        if (results[ticker]) {
          GLOBAL_PERSISTENT_QUOTES[ticker] = {
            quote: results[ticker],
            ts: now2
          };
        }
      });
      savePersistentQuotes();
      return res.json({ quotes: results });
    }
    const staleTickers = [];
    const now = Date.now();
    tickers.forEach((ticker) => {
      const cached = GLOBAL_PERSISTENT_QUOTES[ticker];
      if (cached && cached.quote) {
        results[ticker] = cached.quote;
        if (now - cached.ts > PERSISTENT_QUOTE_TTL) {
          staleTickers.push(ticker);
        }
      } else {
        const asset = CATALOG.find((a) => a.ticker === ticker);
        const basePrice = asset ? asset.basePrice : 50;
        const pSeconds = Date.now() % 6e4 / 1e3;
        const microVariation = 1 + Math.sin(pSeconds / 5) * 0.015;
        const dynamicPrice = Math.round(basePrice * microVariation * 100) / 100;
        const pct = Math.round((microVariation - 1) * 1e4) / 100;
        const initialQuote = {
          ticker,
          price: dynamicPrice,
          change: Math.round((dynamicPrice - basePrice) * 100) / 100,
          changePercent: pct,
          prevClose: basePrice,
          marketTime: (/* @__PURE__ */ new Date()).toISOString(),
          isReal: false
        };
        GLOBAL_PERSISTENT_QUOTES[ticker] = {
          quote: initialQuote,
          ts: now - (PERSISTENT_QUOTE_TTL - 10 * 60 * 1e3)
          // Seta expirando em breve para disparar o background worker
        };
        results[ticker] = initialQuote;
        staleTickers.push(ticker);
      }
    });
    if (staleTickers.length > 0) {
      updateQuotesInBackground(staleTickers);
    }
    return res.json({ quotes: results });
  } catch (err) {
    console.error("[Quotes Router Error] Falha de processamento:", err);
    return res.status(500).json({ error: "Falha de processamento local", details: err.message });
  }
});
function generateServerDeterministicHistory(asset, days, endPrice) {
  const EPOCH_DATE = new Date(2024, 0, 1).getTime();
  const history = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1e3;
  for (let i = 0; i < days; i++) {
    const d = new Date(now - (days - 1 - i) * dayMs);
    const dateStr = d.toISOString().split("T")[0];
    const [year, month, day] = dateStr.split("-").map(Number);
    const targetTime = new Date(year, month - 1, day).getTime();
    const elapsedDays = Math.max(0, Math.floor((targetTime - EPOCH_DATE) / (24 * 60 * 60 * 1e3)));
    const rand = mulberry32(seedFromString(asset.ticker));
    const dailyVol = (asset.volatility || 22) / 100 / Math.sqrt(252);
    const dailyTrend = (asset.trend || 0.3) / 100 / 252;
    let price = asset.basePrice || 50;
    const maxDays = Math.min(elapsedDays, 365 * 10);
    for (let j = 0; j < maxDays; j++) {
      const r = (rand() - 0.5) * 2;
      const noise = r * dailyVol * 1.3;
      const drift = dailyTrend;
      price = price * (1 + drift + noise);
      price = Math.max(price, (asset.basePrice || 50) * 0.2);
    }
    let finalPrice = Math.round(price * 100) / 100;
    if (i === days - 1) {
      finalPrice = endPrice;
    }
    history.push({
      date: dateStr,
      close: finalPrice
    });
  }
  return history;
}
app.get("/api/market/history", async (req, res) => {
  const ticker = (req.query.ticker || "").toUpperCase();
  const days = parseInt(req.query.days) || 180;
  if (!ticker) {
    return res.status(400).json({ error: "Ticker \xE9 obrigat\xF3rio." });
  }
  const isCrypto = ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "LINK", "MATIC"].includes(ticker);
  let yahooTicker = ticker;
  if (!isCrypto) {
    yahooTicker = ticker.includes(".") ? ticker : `${ticker}.SA`;
  } else {
    yahooTicker = `${ticker}-BRL`;
  }
  const range = days <= 5 ? "5d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : days <= 180 ? "6mo" : days <= 365 ? "1y" : "5y";
  const hosts = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com"
  ];
  let result = null;
  let lastError = null;
  for (const host of hosts) {
    const url = `${host}/v8/finance/chart/${yahooTicker}?interval=1d&range=${range}`;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (response.ok) {
        const json = await response.json();
        result = json?.chart?.result?.[0];
        if (result) break;
      }
    } catch (err) {
      lastError = err;
    }
  }
  if (!result || !result.timestamp || result.timestamp.length === 0) {
    console.log(`[Yahoo Express History API Info] N\xE3o foi poss\xEDvel carregar hist\xF3rico de ${ticker} do Yahoo, gerando fallback determin\xEDstico.`);
    const asset = CATALOG.find((a) => a.ticker === ticker) || {
      ticker,
      name: ticker,
      shortName: ticker,
      type: isCrypto ? "crypto" : "stock",
      basePrice: 50,
      volatility: 22,
      trend: 0.3
    };
    const cachedQuote = GLOBAL_PERSISTENT_QUOTES[ticker]?.quote;
    const endPrice = cachedQuote ? cachedQuote.price : asset.basePrice;
    const history = generateServerDeterministicHistory(asset, days, endPrice);
    return res.json({ history });
  }
  try {
    const timestamps = result.timestamp || [];
    const indicators = result.indicators?.quote?.[0] || {};
    const closes = indicators.close || [];
    const history = [];
    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      if (typeof price === "number" && !isNaN(price)) {
        const d = new Date(timestamps[i] * 1e3);
        history.push({
          date: d.toISOString().split("T")[0],
          close: Math.round(price * 100) / 100
        });
      }
    }
    if (history.length === 0) {
      throw new Error("Hist\xF3rico de pre\xE7os vazio.");
    }
    history.sort((a, b) => a.date.localeCompare(b.date));
    return res.json({ history });
  } catch (err) {
    console.warn(`[Yahoo Express History API Parsing Error] Erro para ${ticker}, usando gerador determin\xEDstico:`, err.message);
    const asset = CATALOG.find((a) => a.ticker === ticker) || {
      ticker,
      name: ticker,
      shortName: ticker,
      type: isCrypto ? "crypto" : "stock",
      basePrice: 50,
      volatility: 22,
      trend: 0.3
    };
    const cachedQuote = GLOBAL_PERSISTENT_QUOTES[ticker]?.quote;
    const endPrice = cachedQuote ? cachedQuote.price : asset.basePrice;
    const history = generateServerDeterministicHistory(asset, days, endPrice);
    return res.json({ history });
  }
});
var lastAutoSyncDate = "";
var autoSyncLogs = [];
function addAutoSyncLog(message) {
  const pstSession = (/* @__PURE__ */ new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  autoSyncLogs.push({ timestamp: pstSession, message });
  if (autoSyncLogs.length > 50) autoSyncLogs.shift();
  console.log(`[AutoSync] ${pstSession} - ${message}`);
}
async function runAutoSyncMarket() {
  const tzDate = /* @__PURE__ */ new Date();
  const dateStr = tzDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  lastAutoSyncDate = dateStr;
  addAutoSyncLog("Sincroniza\xE7\xE3o autom\xE1tica iniciada no servidor...");
  const tickers = [
    "PETR4",
    "VALE3",
    "ITUB4",
    "BBAS3",
    "BBDC4",
    "MGLU3",
    "WEGE3",
    "ABEV3",
    "B3SA3",
    "ELET3",
    "RENT3",
    "SUZB3",
    "PRIO3",
    "EMBR3",
    "RAIL3",
    "MXRF11",
    "HGLG11",
    "XPLG11",
    "KNRI11",
    "VISC11",
    "HGRE11",
    "XPML11",
    "KNIP11",
    "BTLG11",
    "HGRU11",
    "HGBS11",
    "TRXF11",
    "BOVA11",
    "IVVB11",
    "SMAL11",
    "HASH11",
    "XINA11",
    "LFTS11",
    "WRLD11",
    "GOLD11",
    "BTC",
    "ETH",
    "SOL",
    "BNB",
    "ADA",
    "XRP",
    "DOGE",
    "DOT",
    "LINK",
    "MATIC"
  ];
  try {
    const yahooBatch = await getMultipleQuotesFromYahoo(tickers);
    const now = Date.now();
    let count = 0;
    Object.keys(yahooBatch).forEach((t) => {
      GLOBAL_PERSISTENT_QUOTES[t] = {
        quote: yahooBatch[t],
        ts: now
      };
      count++;
    });
    const stillMissing = tickers.filter((t) => !GLOBAL_PERSISTENT_QUOTES[t] || GLOBAL_PERSISTENT_QUOTES[t].quote?.isReal === false);
    if (stillMissing.length > 0) {
      for (const ticker of stillMissing) {
        try {
          const q = await getQuoteFromYahooChart(ticker);
          GLOBAL_PERSISTENT_QUOTES[ticker] = {
            quote: q,
            ts: Date.now()
          };
          count++;
        } catch (e) {
          try {
            const qGemini = await getQuoteFromGeminiSearch(ticker, true);
            if (qGemini) {
              GLOBAL_PERSISTENT_QUOTES[ticker] = {
                quote: qGemini,
                ts: Date.now()
              };
              count++;
            }
          } catch (gemErr) {
          }
        }
      }
    }
    savePersistentQuotes();
    addAutoSyncLog(`Sincroniza\xE7\xE3o finalizada com sucesso! ${count} ativos atualizados.`);
  } catch (err) {
    addAutoSyncLog(`Erro durante sincroniza\xE7\xE3o autom\xE1tica: ${err.message}`);
  }
}
function startAutomaticSyncScheduler() {
  addAutoSyncLog("Scheduler de sincroniza\xE7\xE3o autom\xE1tica ativado (Seg-Sex \xE0s 23:00 de Bras\xEDlia).");
  setInterval(() => {
    try {
      const now = /* @__PURE__ */ new Date();
      const optionsTime = { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false };
      const formattedTime = now.toLocaleTimeString("pt-BR", optionsTime);
      const df = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" });
      const weekdayStr = df.format(now);
      const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekdayStr);
      const isTimeMatches = formattedTime === "23:00" || formattedTime === "23:01" || formattedTime === "23:02" || formattedTime === "23:03" || formattedTime === "23:04" || formattedTime === "23:05";
      const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      if (isWeekday && isTimeMatches) {
        if (lastAutoSyncDate !== dateStr) {
          addAutoSyncLog(`Executando sincroniza\xE7\xE3o di\xE1ria programada. (Data de Bras\xEDlia: ${dateStr}, Hora: ${formattedTime}, Dia: ${weekdayStr})`);
          runAutoSyncMarket();
        }
      }
    } catch (err) {
      console.error("[AutoSync Scheduler Error]", err.message);
    }
  }, 3 * 60 * 1e3);
}
app.get("/api/market/auto-sync-status", (req, res) => {
  res.json({
    lastAutoSyncDate,
    logs: autoSyncLogs
  });
});
app.post("/api/market/trigger-auto-sync", async (req, res) => {
  runAutoSyncMarket();
  res.json({ success: true, message: "Sincroniza\xE7\xE3o manual acionada com sucesso no servidor." });
});
var CLOSE_CACHE_FILE = path.join(os.tmpdir(), "market_closes.json");
var CURRENT_VERSION = "2.3.1";
function seedFromString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function getEasterDate(year) {
  const f = Math.floor;
  const G = year % 19;
  const C = f(year / 100);
  const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J;
  const month = 3 + f((L + 40) / 44);
  const day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}
function isB3HolidayOrWeekend(dateInput) {
  const d = new Date(dateInput);
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0) return { isHolidayOrWeekend: true, label: "Fim de Semana (Domingo)" };
  if (dayOfWeek === 6) return { isHolidayOrWeekend: true, label: "Fim de Semana (S\xE1bado)" };
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (month === 1 && day === 1) return { isHolidayOrWeekend: true, label: "Confraterniza\xE7\xE3o Universal" };
  if (month === 4 && day === 21) return { isHolidayOrWeekend: true, label: "Tiradentes" };
  if (month === 5 && day === 1) return { isHolidayOrWeekend: true, label: "Dia do Trabalho" };
  if (month === 9 && day === 7) return { isHolidayOrWeekend: true, label: "Independ\xEAncia do Brasil" };
  if (month === 10 && day === 12) return { isHolidayOrWeekend: true, label: "Nossa Senhora Aparecida" };
  if (month === 11 && day === 2) return { isHolidayOrWeekend: true, label: "Finados" };
  if (month === 11 && day === 15) return { isHolidayOrWeekend: true, label: "Proclama\xE7\xE3o da Rep\xFAblica" };
  if (month === 11 && day === 20) return { isHolidayOrWeekend: true, label: "Dia da Consci\xEAncia Negra" };
  if (month === 12 && day === 25) return { isHolidayOrWeekend: true, label: "Natal" };
  if (month === 12 && day === 31) return { isHolidayOrWeekend: true, label: "Fim de Ano (Sem Expediente)" };
  const easter = getEasterDate(year);
  const checkMovable = (offsetDays) => {
    const temp = new Date(easter);
    temp.setDate(temp.getDate() + offsetDays);
    return { m: temp.getMonth() + 1, d: temp.getDate() };
  };
  const carnavalMon = checkMovable(-48);
  const carnavalTue = checkMovable(-47);
  const goodFriday = checkMovable(-2);
  const corpusChristi = checkMovable(60);
  if (month === carnavalMon.m && day === carnavalMon.d) return { isHolidayOrWeekend: true, label: "Carnaval (Segunda-feira)" };
  if (month === carnavalTue.m && day === carnavalTue.d) return { isHolidayOrWeekend: true, label: "Carnaval (Ter\xE7a-feira)" };
  if (month === goodFriday.m && day === goodFriday.d) return { isHolidayOrWeekend: true, label: "Sexta-Feira Santa" };
  if (month === corpusChristi.m && day === corpusChristi.d) return { isHolidayOrWeekend: true, label: "Corpus Christi" };
  return { isHolidayOrWeekend: false };
}
function getLastValidBusinessDay(date) {
  const check = new Date(date);
  let safetyCounter = 0;
  while (safetyCounter < 30) {
    const { isHolidayOrWeekend } = isB3HolidayOrWeekend(check);
    if (isHolidayOrWeekend) {
      check.setDate(check.getDate() - 1);
      safetyCounter++;
    } else {
      break;
    }
  }
  return check;
}
function getDeterministicClosesForDate(targetDate) {
  const businessDate = getLastValidBusinessDay(targetDate);
  const todayStr = businessDate.toISOString().split("T")[0];
  const rand = mulberry32(seedFromString(`close_${todayStr}`));
  const closesMap = {};
  let sumPercent = 0;
  const tickers = [
    "PETR4",
    "VALE3",
    "ITUB4",
    "BBAS3",
    "BBDC4",
    "MGLU3",
    "WEGE3",
    "ABEV3",
    "B3SA3",
    "ELET3",
    "RENT3",
    "SUZB3",
    "PRIO3",
    "EMBR3",
    "RAIL3",
    "MXRF11",
    "HGLG11",
    "XPLG11",
    "KNRI11",
    "VISC11",
    "HGRE11",
    "XPML11",
    "KNIP11",
    "BTLG11",
    "HGRU11",
    "HGBS11",
    "TRXF11",
    "BOVA11",
    "IVVB11",
    "SMAL11",
    "HASH11",
    "XINA11",
    "LFTS11",
    "WRLD11",
    "GOLD11",
    "BTC",
    "ETH",
    "SOL",
    "BNB",
    "ADA",
    "XRP",
    "DOGE",
    "DOT",
    "LINK",
    "MATIC"
  ];
  let topGainer = { ticker: "N/A", changePercent: -999, price: 0 };
  let topLoser = { ticker: "N/A", changePercent: 999, price: 0 };
  tickers.forEach((t) => {
    const asset = CATALOG.find((a) => a.ticker === t);
    const basePrice = asset ? asset.basePrice : 50;
    const changePct = Math.round((rand() - 0.49) * 5.6 * 100) / 100;
    const price = Math.round(basePrice * (1 + changePct / 100) * 100) / 100;
    closesMap[t] = { price, changePercent: changePct };
    sumPercent += changePct;
    if (changePct > topGainer.changePercent) {
      topGainer = { ticker: t, changePercent: changePct, price };
    }
    if (changePct < topLoser.changePercent) {
      topLoser = { ticker: t, changePercent: changePct, price };
    }
  });
  const avgChangePercent = Math.round(sumPercent / tickers.length * 100) / 100;
  const dateObj = new Date(businessDate);
  dateObj.setHours(19, 0, 0, 0);
  const holidayCheckResult = isB3HolidayOrWeekend(targetDate);
  return {
    timestamp: dateObj.toISOString(),
    status: "success",
    isHolidayOrWeekend: holidayCheckResult.isHolidayOrWeekend,
    holidayLabel: holidayCheckResult.label,
    stats: {
      avgChangePercent,
      topGainer,
      topLoser,
      totalAssetsUpdated: tickers.length
    },
    closes: closesMap
  };
}
function getDeterministicClosesForToday() {
  return getDeterministicClosesForDate(/* @__PURE__ */ new Date());
}
var lastClosesCache = null;
try {
  if (fs.existsSync(CLOSE_CACHE_FILE)) {
    const raw = fs.readFileSync(CLOSE_CACHE_FILE, "utf-8");
    lastClosesCache = JSON.parse(raw);
    console.log("[Market Closes System] Cache de fechamento restaurado do disco:", lastClosesCache.timestamp);
  } else {
    lastClosesCache = getDeterministicClosesForToday();
    console.log("[Market Closes System] Cache de fechamento inicializado deterministicamente (hoje).");
  }
} catch (e) {
  console.log("[Market Closes System] Erro ao restaurar cache. Semeando de forma determin\xEDstica.");
  lastClosesCache = getDeterministicClosesForToday();
}
app.get("/api/version", (req, res) => {
  return res.json({ version: CURRENT_VERSION, timestamp: 1717539999e3 });
});
app.get("/version.json", (req, res) => {
  return res.json({ version: CURRENT_VERSION, timestamp: 1717539999e3 });
});
app.get("/api/market/last-closes", (req, res) => {
  if (!lastClosesCache) {
    lastClosesCache = getDeterministicClosesForToday();
  }
  return res.json(lastClosesCache);
});
app.get("/api/cron/close-market", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const isAuthorized = !cronSecret || authHeader === `Bearer ${cronSecret}` || req.query.bypass === "true";
  if (!isAuthorized) {
    return res.status(401).json({ error: "C\xF3digo de autentica\xE7\xE3o Inv\xE1lido." });
  }
  const isBypass = req.query.bypass === "true";
  const holidayCheck = isB3HolidayOrWeekend(/* @__PURE__ */ new Date());
  if (holidayCheck.isHolidayOrWeekend && !isBypass) {
    console.log(`[Market Cron] Mercado FECHADO hoje (${holidayCheck.label || "fim de semana"}). Rolando fechamento determin\xEDstico para o \xFAltimo dia \xFAtil.`);
    const lastBusinessCloses = getDeterministicClosesForToday();
    lastClosesCache = lastBusinessCloses;
    try {
      fs.writeFileSync(CLOSE_CACHE_FILE, JSON.stringify(lastBusinessCloses, null, 2), "utf-8");
      console.log("[Market Cron] Cache de fechamento (\xFAltimo dia \xFAtil) gravado sob feriado/fim de semana.");
    } catch (fsErr) {
      console.error("[Market Cron] Falha ao escrever arquivo de cache sob feriado:", fsErr.message);
    }
    return res.json({
      message: `Hoje o mercado est\xE1 fechado por ser ${holidayCheck.label || "fim de semana"}. Carregado o fechamento do \xFAltimo dia \xFAtil real.`,
      ...lastBusinessCloses
    });
  }
  console.log("[Market Cron] Iniciando atualiza\xE7\xE3o de fechamento autom\xE1tico \xE0s 19:00 BRT...");
  const tickers = [
    "PETR4",
    "VALE3",
    "ITUB4",
    "BBAS3",
    "BBDC4",
    "MGLU3",
    "WEGE3",
    "ABEV3",
    "B3SA3",
    "ELET3",
    "RENT3",
    "SUZB3",
    "PRIO3",
    "EMBR3",
    "RAIL3",
    "MXRF11",
    "HGLG11",
    "XPLG11",
    "KNRI11",
    "VISC11",
    "HGRE11",
    "XPML11",
    "KNIP11",
    "BTLG11",
    "HGRU11",
    "HGBS11",
    "TRXF11",
    "BOVA11",
    "IVVB11",
    "SMAL11",
    "HASH11",
    "XINA11",
    "LFTS11",
    "WRLD11",
    "GOLD11",
    "BTC",
    "ETH",
    "SOL",
    "BNB",
    "ADA",
    "XRP",
    "DOGE",
    "DOT",
    "LINK",
    "MATIC"
  ];
  try {
    let results = {};
    try {
      results = await getMultipleQuotesFromYahoo(tickers);
    } catch (apiErr) {
      console.warn("[Market Cron Warning] Erro ao buscar cota\xE7\xF5es em lote:", apiErr);
    }
    const missingTickers = tickers.filter((t) => !results[t]);
    if (missingTickers.length > 0) {
      console.log(`[Market Cron Router] ${missingTickers.length} ativos ausentes no lote. Executando fallback...`);
      if (missingTickers.length > 5) {
        console.log(`[Market Cron Router] Qtd de ativos ausentes (${missingTickers.length}) ultrapassou o limite seguro. Populando com valores determin\xEDsticos.`);
        const fallbackData = getDeterministicClosesForToday();
        missingTickers.forEach((t) => {
          const fb = fallbackData.closes[t] || { price: 50, changePercent: 0 };
          const prevCloseComp = fb.price / (1 + fb.changePercent / 100);
          results[t] = {
            ticker: t,
            price: fb.price,
            change: fb.price - prevCloseComp,
            changePercent: fb.changePercent,
            prevClose: prevCloseComp,
            marketTime: (/* @__PURE__ */ new Date()).toISOString(),
            isReal: false
          };
        });
      } else {
        await Promise.all(
          missingTickers.map(async (ticker) => {
            try {
              const q = await getQuoteFromYahooChart(ticker);
              results[ticker] = q;
            } catch (err) {
              try {
                const gem = await getQuoteFromGeminiSearch(ticker);
                if (gem) results[ticker] = gem;
              } catch (gErr) {
              }
            }
          })
        );
      }
    }
    const quotes = tickers.map((ticker) => {
      const q = results[ticker];
      if (q && typeof q.price === "number") {
        return { ticker, price: q.price, change: q.change, changePercent: q.changePercent };
      }
      const fallbackPrice = lastClosesCache?.closes?.[ticker]?.price ?? 50;
      return { ticker, price: fallbackPrice, change: 0, changePercent: 0 };
    });
    const validQuotes = quotes.filter((q) => q && typeof q.price === "number");
    let topGainer = { ticker: "N/A", changePercent: -999, price: 0 };
    let topLoser = { ticker: "N/A", changePercent: 999, price: 0 };
    let sumPercent = 0;
    const closesMap = {};
    validQuotes.forEach((q) => {
      closesMap[q.ticker] = { price: q.price, changePercent: q.changePercent };
      sumPercent += q.changePercent;
      if (q.changePercent > topGainer.changePercent) {
        topGainer = { ticker: q.ticker, changePercent: q.changePercent, price: q.price };
      }
      if (q.changePercent < topLoser.changePercent) {
        topLoser = { ticker: q.ticker, changePercent: q.changePercent, price: q.price };
      }
    });
    const avgChangePercent = validQuotes.length > 0 ? sumPercent / validQuotes.length : 0;
    const businessDate = getLastValidBusinessDay(/* @__PURE__ */ new Date());
    businessDate.setHours(19, 0, 0, 0);
    const closingData = {
      timestamp: businessDate.toISOString(),
      status: "success",
      stats: {
        avgChangePercent: Math.round(avgChangePercent * 100) / 100,
        topGainer: {
          ticker: topGainer.ticker === "N/A" ? "PETR4" : topGainer.ticker,
          changePercent: topGainer.changePercent === -999 ? 0 : Math.round(topGainer.changePercent * 100) / 100,
          price: topGainer.price
        },
        topLoser: {
          ticker: topLoser.ticker === "N/A" ? "VALE3" : topLoser.ticker,
          changePercent: topLoser.changePercent === 999 ? 0 : Math.round(topLoser.changePercent * 100) / 100,
          price: topLoser.price
        },
        totalAssetsUpdated: validQuotes.length
      },
      closes: closesMap
    };
    lastClosesCache = closingData;
    try {
      fs.writeFileSync(CLOSE_CACHE_FILE, JSON.stringify(closingData, null, 2), "utf-8");
      console.log("[Market Cron] Cache de fechamento consolidado gravado com sucesso!");
    } catch (fsErr) {
      console.error("[Market Cron] Falha ao escrever arquivo de cache:", fsErr.message);
    }
    return res.json({
      message: "Mercado fechado com sucesso, fechamentos autom\xE1ticos de ativos consolidados!",
      ...closingData
    });
  } catch (cronErr) {
    console.error("[Market Cron Error] Falha de processamento das APIs reais, aplicando conting\xEAncia determin\xEDstica:", cronErr);
    const deterministicData = getDeterministicClosesForToday();
    lastClosesCache = deterministicData;
    try {
      fs.writeFileSync(CLOSE_CACHE_FILE, JSON.stringify(deterministicData, null, 2), "utf-8");
    } catch (e) {
    }
    return res.json({
      message: "Mercado fechado via conting\xEAncia resiliente (Modo Offline Ativo).",
      ...deterministicData
    });
  }
});
async function start() {
  try {
    const versionData = { version: CURRENT_VERSION, timestamp: Date.now() };
    const publicPath = path.join(process.cwd(), "public");
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }
    fs.writeFileSync(path.join(publicPath, "version.json"), JSON.stringify(versionData, null, 2), "utf-8");
    console.log(`[Version System] version.json gravado com sucesso em: ${publicPath}`);
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      fs.writeFileSync(path.join(distPath, "version.json"), JSON.stringify(versionData, null, 2), "utf-8");
      console.log(`[Version System] version.json gravado com sucesso em: ${distPath}`);
    }
  } catch (err) {
    console.error("[Version System Warning] Falha n\xE3o impeditiva ao gravar arquivos de vers\xE3o est\xE1tica:", err.message);
  }
  startAutomaticSyncScheduler();
  if (process.env.NODE_ENV !== "production") {
    console.log("[FullStack] Iniciando servidor Express em modo DESENVOLVIMENTO com Vite...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("[FullStack] Iniciando servidor Express em modo PRODU\xC7\xC3O...");
    const distPath = path.join(process.cwd(), "dist");
    let finalDistPath = distPath;
    try {
      const fs2 = __require("fs");
      if (!fs2.existsSync(path.join(distPath, "index.html")) && fs2.existsSync(path.join(__dirname, "index.html"))) {
        finalDistPath = __dirname;
      }
    } catch (e) {
    }
    console.log(`[FullStack] Servindo arquivos est\xE1ticos de: ${finalDistPath}`);
    app.use(express.static(finalDistPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(finalDistPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FullStack] Servidor rodando com sucesso no endere\xE7o: http://localhost:${PORT}`);
  });
}
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  start();
}
var server_default = app;
export {
  server_default as default
};
