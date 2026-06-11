// Catálogo de ativos populares da B3 + criptomoedas
// Logos vêm de brapi.dev (público) ou CDN crypto

export type AssetType = "stock" | "fund" | "etf" | "crypto";

export type CatalogAsset = {
  ticker: string;
  name: string;
  shortName: string;
  type: AssetType;
  logo: string;
  sector?: string;
  // preço base aproximado para fallback quando API não disponível
  basePrice: number;
  // volatilidade base anual em % (usada pra gerar histórico mock)
  volatility: number;
  // tendência: 1 = altista, -1 = baixista, 0 = lateral
  trend: number;
};

export const CATALOG: CatalogAsset[] = [
  // === Ações Brasileiras ===
  { ticker: "PETR4", name: "Petrobras PN", shortName: "Petrobras", type: "stock", logo: "https://icons.brapi.dev/icons/PETR4.svg", sector: "Energia", basePrice: 38.45, volatility: 25, trend: 0.5 },
  { ticker: "VALE3", name: "Vale ON", shortName: "Vale", type: "stock", logo: "https://icons.brapi.dev/icons/VALE3.svg", sector: "Mineração", basePrice: 65.20, volatility: 28, trend: 0.3 },
  { ticker: "ITUB4", name: "Itaú Unibanco PN", shortName: "Itaú", type: "stock", logo: "https://icons.brapi.dev/icons/ITUB4.svg", sector: "Financeiro", basePrice: 35.80, volatility: 18, trend: 0.7 },
  { ticker: "BBAS3", name: "Banco do Brasil ON", shortName: "Banco do Brasil", type: "stock", logo: "https://icons.brapi.dev/icons/BBAS3.svg", sector: "Financeiro", basePrice: 28.40, volatility: 22, trend: 0.8 },
  { ticker: "BBDC4", name: "Bradesco PN", shortName: "Bradesco", type: "stock", logo: "https://icons.brapi.dev/icons/BBDC4.svg", sector: "Financeiro", basePrice: 14.20, volatility: 20, trend: 0.4 },
  { ticker: "MGLU3", name: "Magazine Luiza ON", shortName: "Magalu", type: "stock", logo: "https://icons.brapi.dev/icons/MGLU3.svg", sector: "Varejo", basePrice: 8.50, volatility: 45, trend: -0.2 },
  { ticker: "WEGE3", name: "WEG ON", shortName: "WEG", type: "stock", logo: "https://icons.brapi.dev/icons/WEGE3.svg", sector: "Industrial", basePrice: 52.30, volatility: 22, trend: 1.0 },
  { ticker: "ABEV3", name: "Ambev ON", shortName: "Ambev", type: "stock", logo: "https://icons.brapi.dev/icons/ABEV3.svg", sector: "Bebidas", basePrice: 13.75, volatility: 18, trend: 0.2 },
  { ticker: "B3SA3", name: "B3 ON", shortName: "B3", type: "stock", logo: "https://icons.brapi.dev/icons/B3SA3.svg", sector: "Financeiro", basePrice: 12.40, volatility: 24, trend: 0.6 },
  { ticker: "ELET3", name: "Eletrobras ON", shortName: "Eletrobras", type: "stock", logo: "https://icons.brapi.dev/icons/ELET3.svg", sector: "Energia", basePrice: 42.80, volatility: 28, trend: 0.5 },
  { ticker: "RENT3", name: "Localiza ON", shortName: "Localiza", type: "stock", logo: "https://icons.brapi.dev/icons/RENT3.svg", sector: "Locação", basePrice: 48.50, volatility: 26, trend: 0.4 },
  { ticker: "SUZB3", name: "Suzano ON", shortName: "Suzano", type: "stock", logo: "https://icons.brapi.dev/icons/SUZB3.svg", sector: "Papel/Celulose", basePrice: 58.20, volatility: 30, trend: 0.3 },
  { ticker: "PRIO3", name: "PetroRio ON", shortName: "PetroRio", type: "stock", logo: "https://icons.brapi.dev/icons/PRIO3.svg", sector: "Energia", basePrice: 44.10, volatility: 35, trend: 0.8 },
  { ticker: "EMBR3", name: "Embraer ON", shortName: "Embraer", type: "stock", logo: "https://icons.brapi.dev/icons/EMBR3.svg", sector: "Industrial", basePrice: 62.50, volatility: 32, trend: 1.2 },
  { ticker: "RAIL3", name: "Rumo ON", shortName: "Rumo", type: "stock", logo: "https://icons.brapi.dev/icons/RAIL3.svg", sector: "Logística", basePrice: 22.80, volatility: 26, trend: 0.5 },

  // === FIIs ===
  { ticker: "MXRF11", name: "Maxi Renda FII", shortName: "Maxi Renda", type: "fund", logo: "https://icons.brapi.dev/icons/MXRF11.svg", sector: "Recebíveis", basePrice: 10.42, volatility: 8, trend: 0.2 },
  { ticker: "HGLG11", name: "CSHG Logística FII", shortName: "CSHG Logística", type: "fund", logo: "https://icons.brapi.dev/icons/HGLG11.svg", sector: "Logística", basePrice: 165.30, volatility: 10, trend: 0.4 },
  { ticker: "XPLG11", name: "XP Log FII", shortName: "XP Log", type: "fund", logo: "https://icons.brapi.dev/icons/XPLG11.svg", sector: "Logística", basePrice: 102.50, volatility: 11, trend: 0.3 },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliária", shortName: "Kinea Renda", type: "fund", logo: "https://icons.brapi.dev/icons/KNRI11.svg", sector: "Híbrido", basePrice: 158.40, volatility: 9, trend: 0.5 },
  { ticker: "VISC11", name: "Vinci Shopping Centers", shortName: "Vinci Shopping", type: "fund", logo: "https://icons.brapi.dev/icons/VISC11.svg", sector: "Shoppings", basePrice: 108.20, volatility: 12, trend: 0.4 },
  { ticker: "HGRE11", name: "CSHG Real Estate", shortName: "CSHG Real Estate", type: "fund", logo: "https://icons.brapi.dev/icons/HGRE11.svg", sector: "Lajes Corporativas", basePrice: 142.30, volatility: 10, trend: 0.3 },
  { ticker: "XPML11", name: "XP Malls FII", shortName: "XP Malls", type: "fund", logo: "https://icons.brapi.dev/icons/XPML11.svg", sector: "Shoppings", basePrice: 116.50, volatility: 11, trend: 0.5 },
  { ticker: "KNIP11", name: "Kinea Índices de Preços FII", shortName: "Kinea Índices", type: "fund", logo: "https://icons.brapi.dev/icons/KNIP11.svg", sector: "Recebíveis", basePrice: 94.80, volatility: 7, trend: 0.3 },
  { ticker: "BTLG11", name: "BTG Pactual Logística FII", shortName: "BTG Logística", type: "fund", logo: "https://icons.brapi.dev/icons/BTLG11.svg", sector: "Logística", basePrice: 102.10, volatility: 9, trend: 0.4 },
  { ticker: "HGRU11", name: "CSHG Renda Urbana", shortName: "CSHG Renda Urbana", type: "fund", logo: "https://icons.brapi.dev/icons/HGRU11.svg", sector: "Híbrido", basePrice: 124.50, volatility: 10, trend: 0.4 },
  { ticker: "HGBS11", name: "Hedge Brasil Shopping FII", shortName: "Hedge Shopping", type: "fund", logo: "https://icons.brapi.dev/icons/HGBS11.svg", sector: "Shoppings", basePrice: 218.40, volatility: 11, trend: 0.3 },
  { ticker: "TRXF11", name: "TRX Active Real Estate FII", shortName: "TRX Active", type: "fund", logo: "https://icons.brapi.dev/icons/TRXF11.svg", sector: "Híbrido", basePrice: 110.20, volatility: 10, trend: 0.5 },

  // === ETFs ===
  { ticker: "BOVA11", name: "iShares Ibovespa", shortName: "Bova11", type: "etf", logo: "https://icons.brapi.dev/icons/BOVA11.svg", sector: "Ibovespa", basePrice: 125.80, volatility: 22, trend: 0.6 },
  { ticker: "IVVB11", name: "iShares S&P 500", shortName: "Ivvb11", type: "etf", logo: "https://icons.brapi.dev/icons/IVVB11.svg", sector: "S&P 500", basePrice: 320.40, volatility: 18, trend: 1.0 },
  { ticker: "SMAL11", name: "iShares Small Cap", shortName: "Small11", type: "etf", logo: "https://icons.brapi.dev/icons/SMAL11.svg", sector: "Small Caps", basePrice: 108.20, volatility: 26, trend: 0.4 },
  { ticker: "HASH11", name: "Hashdex Nasdaq Crypto Index ETF", shortName: "Hashdex Crypto", type: "etf", logo: "https://icons.brapi.dev/icons/HASH11.svg", sector: "Cripto", basePrice: 48.50, volatility: 45, trend: 0.8 },
  { ticker: "XINA11", name: "Trend China ETF", shortName: "Trend China", type: "etf", logo: "https://icons.brapi.dev/icons/XINA11.svg", sector: "Global", basePrice: 6.80, volatility: 32, trend: 0.1 },
  { ticker: "LFTS11", name: "Investo Tesouro Selic ETF", shortName: "Investo Selic", type: "etf", logo: "https://icons.brapi.dev/icons/LFTS11.svg", sector: "Renda Fixa", basePrice: 112.40, volatility: 2, trend: 0.6 },
  { ticker: "WRLD11", name: "Investo MSCI World ETF", shortName: "Investo World", type: "etf", logo: "https://icons.brapi.dev/icons/WRLD11.svg", sector: "Global", basePrice: 98.60, volatility: 18, trend: 0.8 },
  { ticker: "GOLD11", name: "Trend Ouro ETF", shortName: "Trend Ouro", type: "etf", logo: "https://icons.brapi.dev/icons/GOLD11.svg", sector: "Commodities", basePrice: 11.20, volatility: 20, trend: 0.5 },

  // === Criptomoedas ===
  { ticker: "BTC", name: "Bitcoin", shortName: "Bitcoin", type: "crypto", logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg", basePrice: 580000, volatility: 60, trend: 1.5 },
  { ticker: "ETH", name: "Ethereum", shortName: "Ethereum", type: "crypto", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg", basePrice: 22500, volatility: 65, trend: 1.2 },
  { ticker: "SOL", name: "Solana", shortName: "Solana", type: "crypto", logo: "https://cryptologos.cc/logos/solana-sol-logo.svg", basePrice: 1280, volatility: 80, trend: 1.8 },
  { ticker: "BNB", name: "Binance Coin", shortName: "BNB", type: "crypto", logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg", basePrice: 3400, volatility: 55, trend: 0.8 },
  { ticker: "ADA", name: "Cardano", shortName: "Cardano", type: "crypto", logo: "https://cryptologos.cc/logos/cardano-ada-logo.svg", basePrice: 2.85, volatility: 75, trend: 0.5 },
  { ticker: "XRP", name: "XRP", shortName: "XRP", type: "crypto", logo: "https://cryptologos.cc/logos/xrp-xrp-logo.svg", basePrice: 3.10, volatility: 68, trend: 0.4 },
  { ticker: "DOGE", name: "Dogecoin", shortName: "DOGE", type: "crypto", logo: "https://cryptologos.cc/logos/dogecoin-doge-logo.svg", basePrice: 0.85, volatility: 110, trend: 0.7 },
  { ticker: "DOT", name: "Polkadot", shortName: "DOT", type: "crypto", logo: "https://cryptologos.cc/logos/polkadot-dot-logo.svg", basePrice: 42.50, volatility: 72, trend: 0.4 },
  { ticker: "LINK", name: "Chainlink", shortName: "LINK", type: "crypto", logo: "https://cryptologos.cc/logos/chainlink-link-logo.svg", basePrice: 115.00, volatility: 65, trend: 0.9 },
  { ticker: "MATIC", name: "Polygon", shortName: "MATIC", type: "crypto", logo: "https://cryptologos.cc/logos/polygon-matic-logo.svg", basePrice: 4.20, volatility: 78, trend: 0.5 },

];

export const findAsset = (ticker: string) =>
  CATALOG.find((a) => a.ticker.toUpperCase() === ticker.toUpperCase());

export const searchAssets = (query: string, limit = 20): CatalogAsset[] => {
  if (!query.trim()) return CATALOG.slice(0, limit);
  const q = query.toLowerCase().trim();
  return CATALOG
    .filter(
      (a) =>
        a.ticker.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.shortName.toLowerCase().includes(q) ||
        (a.sector && a.sector.toLowerCase().includes(q))
    )
    .slice(0, limit);
};

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  stock: "Ação",
  fund: "FII",
  etf: "ETF",
  crypto: "Cripto",
};

export const ASSET_TYPE_STYLE: Record<AssetType, string> = {
  stock: "bg-emerald-100 text-emerald-700",
  fund: "bg-sky-100 text-sky-700",
  etf: "bg-violet-100 text-violet-700",
  crypto: "bg-amber-100 text-amber-700",
};
