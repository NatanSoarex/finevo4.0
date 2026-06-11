import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, TrendingUp, TrendingDown } from "lucide-react";
import { ASSET_TYPE_LABEL, ASSET_TYPE_STYLE, type AssetType, type CatalogAsset, searchAssets } from "../services/assetsCatalog";
import { getQuote, getCachedQuotes, type PriceQuote } from "../services/marketApi";
import AssetLogo from "./AssetLogo";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: CatalogAsset, quote: PriceQuote) => void;
};

const TYPE_FILTERS: { id: AssetType | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "stock", label: "Ações" },
  { id: "fund", label: "FIIs" },
  { id: "etf", label: "ETFs" },
  { id: "crypto", label: "Cripto" },
];

export default function SearchAssetModal({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AssetType | "all">("all");
  const [results, setResults] = useState<CatalogAsset[]>([]);
  const [quotes, setQuotes] = useState<Record<string, PriceQuote>>({});
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  // Bloqueio de scroll do body ao abrir e suporte à tecla Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalStyle;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setFilter("all");
      return;
    }
    const filtered = searchAssets(query);
    const final = filter === "all" ? filtered : filtered.filter((a) => a.type === filter);
    setResults(final);
  }, [query, filter, open]);

  // Carrega cotações dos resultados visíveis de maneira otimizada com debounce e cache local
  useEffect(() => {
    if (!open) return;

    // Primeiro, tenta ler instantaneamente do cache para evitar flicker e lentidão
    try {
      const cached = getCachedQuotes();
      const updatedQuotes: Record<string, PriceQuote> = {};
      let hasCached = false;
      results.slice(0, 15).forEach((a) => {
        if (cached[a.ticker]) {
          updatedQuotes[a.ticker] = cached[a.ticker];
          hasCached = true;
        }
      });
      if (hasCached) {
        setQuotes((prev) => ({ ...prev, ...updatedQuotes }));
      }
    } catch (e) {
      console.warn("Erro ao ler cotações em cache:", e);
    }

    // Debounce de 200ms para requisições de rede das cotações enquanto o usuário digita
    const timer = setTimeout(() => {
      setLoading(true);
      const top = results.slice(0, 12); // Pega apenas os 12 primeiros resultados mais relevantes para economizar conexões de rede
      Promise.all(
        top.map(async (a) => {
          try {
            const q = await getQuote(a.ticker);
            return [a.ticker, q] as const;
          } catch {
            return null;
          }
        })
      ).then((arr) => {
        const next: Record<string, PriceQuote> = {};
        for (const it of arr) if (it) next[it[0]] = it[1];
        setQuotes((prev) => ({ ...prev, ...next }));
        setLoading(false);
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [results, open]);

  const handlePick = async (asset: CatalogAsset) => {
    setPicking(asset.ticker);
    try {
      const q = quotes[asset.ticker] ?? (await getQuote(asset.ticker));
      onSelect(asset, q);
    } finally {
      setPicking(null);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-[460px] rounded-t-3xl bg-white shadow-2xl animate-slide-up flex flex-col"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-stone-100">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-lg font-semibold text-stone-900">Adicionar investimento</h3>
              <p className="text-xs text-stone-500 mt-0.5">Busque pelo nome ou ticker</p>
            </div>
            <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: PETR4, Banco do Brasil, Bitcoin..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-base placeholder:text-stone-400 text-stone-900 focus:outline-none focus:border-emerald-400 focus:bg-white"
            />
          </div>

          {/* Type filters */}
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  filter === f.id
                    ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
                    : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ maxHeight: "calc(92vh - 200px)" }}>
          {results.length === 0 ? (
            <div className="p-10 text-center">
              <Search size={32} className="mx-auto text-stone-300" />
              <p className="text-sm text-stone-500 mt-3">Nenhum ativo encontrado</p>
              <p className="text-[11px] text-stone-400 mt-1">Tente outro termo</p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {results.map((a) => {
                const q = quotes[a.ticker];
                const up = q ? q.changePercent >= 0 : true;
                return (
                  <li key={a.ticker}>
                    <button
                      onClick={() => handlePick(a)}
                      disabled={picking === a.ticker}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 transition text-left disabled:opacity-50"
                    >
                      <AssetLogo ticker={a.ticker} logo={a.logo} type={a.type} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-stone-900 truncate">{a.ticker}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ASSET_TYPE_STYLE[a.type]}`}>
                            {ASSET_TYPE_LABEL[a.type]}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 truncate">{a.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {q ? (
                          <>
                             <p className="text-sm font-semibold text-stone-900">
                               R$ {q.price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </p>
                          </>
                        ) : (
                          <div className="space-y-1">
                            <div className="h-4 w-16 bg-stone-100 rounded animate-pulse ml-auto" />
                            <div className="h-3 w-10 bg-stone-100 rounded animate-pulse ml-auto" />
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {loading && results.length > 0 && (
            <p className="text-center text-[11px] text-stone-400 py-3">Carregando cotações...</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
