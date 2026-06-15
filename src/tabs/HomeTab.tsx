import { useState, useEffect, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Plus, Search, HelpCircle,
  Calendar, DollarSign, Filter, Coins, Building, Briefcase, Award,
  Trash2, RefreshCw, Layers, ArrowUpRight, ArrowDownRight, Check, AlertCircle, X
} from "lucide-react";
import { usePortfolio, type Position } from "../services/portfolio";
import { useTransactions, addTransaction, removeTransaction, type Transaction } from "../services/transactions";
import { CATALOG, searchAssets, type CatalogAsset, findAsset } from "../services/assetsCatalog";
import { getQuote, getHistory, type PriceQuote, type HistoryPoint } from "../services/marketApi";
import { todayISO, parseLocalDate, formatBR } from "../services/dateUtils";

export default function HomeTab() {
  const positions = usePortfolio();
  const { transactions } = useTransactions();

  // State para cotações atuais carregadas via API
  const [quotes, setQuotes] = useState<Record<string, PriceQuote>>({});
  const [histories, setHistories] = useState<Record<string, HistoryPoint[]>>({});
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);

  // States para o Form de Aporte / Venda
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<CatalogAsset | null>(null);
  const [txKind, setTxKind] = useState<"buy" | "sell">("buy");
  const [txQty, setTxQty] = useState("");
  const [txPrice, setTxPrice] = useState("");
  const [txDate, setTxDate] = useState(todayISO());
  const [txNote, setTxNote] = useState("");
  const [formError, setFormError] = useState("");
  const [successAnimation, setSuccessAnimation] = useState(false);

  // Períodos ativos do Gráfico de Evolução (7d, 30d, 90d)
  const [chartPeriod, setChartPeriod] = useState<7 | 30 | 90>(30);
  const [activeHoverData, setActiveHoverData] = useState<{ date: string; value: number; invested: number } | null>(null);

  // Filtragem de Busca Autocomplete do catálogo
  const filteredCatalogAssets = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchAssets(searchQuery, 5);
  }, [searchQuery]);

  // Carrega cotações e históricos para as posições ativas
  useEffect(() => {
    if (positions.length === 0) return;

    let isSubscribed = true;
    const fetchAllData = async () => {
      setIsLoadingQuotes(true);
      const newQuotes: Record<string, PriceQuote> = {};
      const newHistories: Record<string, HistoryPoint[]> = {};

      try {
        await Promise.all(
          positions.map(async (pos) => {
            // Busca cotação atual
            try {
              const q = await getQuote(pos.ticker, refreshSeed > 0);
              newQuotes[pos.ticker] = q;
            } catch (e) {
              console.warn("Erro ao carregar cotação para:", pos.ticker, e);
            }

            // Busca histórico para o gráfico
            try {
              const h = await getHistory(pos.ticker, chartPeriod, refreshSeed > 0);
              newHistories[pos.ticker] = h;
            } catch (e) {
              console.warn("Erro ao carregar histórico para:", pos.ticker, e);
            }
          })
        );

        if (isSubscribed) {
          setQuotes(newQuotes);
          setHistories(newHistories);
        }
      } catch (err) {
        console.error("Falha ao atualizar dados de mercado:", err);
      } finally {
        if (isSubscribed) {
          setIsLoadingQuotes(false);
        }
      }
    };

    fetchAllData();
    return () => {
      isSubscribed = false;
    };
  }, [positions, chartPeriod, refreshSeed]);

  // Atalho para atualizar os valores de mercado manualmente
  const handleForceUpdate = () => {
    setRefreshSeed((prev) => prev + 1);
  };

  // Preenche preço sugerido quando o usuário seleciona um ativo no catálogo
  const handleSelectAsset = async (asset: CatalogAsset) => {
    setSelectedAsset(asset);
    setSearchQuery("");
    
    // Tenta carregar a cotação em tempo real deste ativo para sugerir ao usuário
    try {
      const q = await getQuote(asset.ticker);
      setTxPrice(q.price.toString());
    } catch {
      setTxPrice(asset.basePrice.toString());
    }
  };

  // Submissão do novo aporte/venda
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedAsset) {
      setFormError("Selecione um ativo da lista.");
      return;
    }

    const qty = parseFloat(txQty);
    const price = parseFloat(txPrice);

    if (isNaN(qty) || qty <= 0) {
      setFormError("A quantidade deve ser um número maior que zero.");
      return;
    }

    if (isNaN(price) || price <= 0) {
      setFormError("O preço por unidade deve ser maior que zero (R$).");
      return;
    }

    if (!txDate) {
      setFormError("Selecione a data da operação.");
      return;
    }

    // Valida se o usuário tem saldo suficiente ao tentar vender
    if (txKind === "sell") {
      const currentPos = positions.find((p) => p.ticker.toUpperCase() === selectedAsset.ticker.toUpperCase());
      if (!currentPos || currentPos.quantity < qty) {
        setFormError(
          `Saldo insuficiente. Você possui apenas ${currentPos?.quantity ?? 0} unidades deste ativo.`
        );
        return;
      }
    }

    // Adiciona transação
    const total = qty * price;
    addTransaction({
      kind: txKind,
      ticker: selectedAsset.ticker.toUpperCase(),
      assetName: selectedAsset.name,
      assetType: selectedAsset.type,
      assetLogo: selectedAsset.logo,
      quantity: qty,
      unitPrice: price,
      total,
      date: txDate,
      note: txNote || undefined,
    });

    // Animação de sucesso
    setSuccessAnimation(true);
    setTimeout(() => {
      setSuccessAnimation(false);
      // Reseta formulário
      setSelectedAsset(null);
      setTxQty("");
      setTxPrice("");
      setTxNote("");
      setIsFormOpen(false);
    }, 1500);
  };

  // --- RENDIMENTOS E CALCULOS TOTAIS DA CARTEIRA ATUAL ---
  const totals = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentVal = 0;

    positions.forEach((pos) => {
      totalInvested += pos.invested;
      const currentPrice = quotes[pos.ticker]?.price ?? pos.purchasePrice;
      totalCurrentVal += currentPrice * pos.quantity;
    });

    const absoluteReturn = totalCurrentVal - totalInvested;
    const pctReturn = totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;

    return {
      invested: totalInvested,
      current: totalCurrentVal,
      absReturn: absoluteReturn,
      pctReturn,
    };
  }, [positions, quotes]);

  // --- CÁLCULO DE HISTÓRICO PATRIMONIAL CONSOLIDADO NO TEMPO (Interactive SVG Chart) ---
  const chartData = useMemo(() => {
    if (positions.length === 0) return [];

    // Encontra a data mais antiga de compra das posições do usuário
    let minTs = Date.now();
    positions.forEach((p) => {
      const t = parseLocalDate(p.purchaseDate).getTime();
      if (t < minTs) minTs = t;
    });

    // Gera lista de todos os dias no período selecionado (7, 30 ou 90 dias atrás até hoje)
    const dayMs = 24 * 60 * 60 * 1000;
    const nowTs = Date.now();
    const listDays: { label: string; dateStr: string; ts: number }[] = [];

    for (let i = chartPeriod - 1; i >= 0; i--) {
      const d = new Date(nowTs - i * dayMs);
      const dateStr = d.toISOString().split("T")[0];
      const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      listDays.push({ label, dateStr, ts: d.getTime() });
    }

    // Calcula balanço total de patrimônio por dia
    return listDays.map((step) => {
      let dailyValue = 0;
      let dailyInvested = 0;

      positions.forEach((pos) => {
        const pDateTs = parseLocalDate(pos.purchaseDate).getTime();
        // Se o ativo já tinha sido comprado nessa data (ou próximo dela)
        if (pDateTs <= step.ts + 86400000) {
          const hist = histories[pos.ticker] || [];
          // Encontra o preço de fechamento mais próximo da data do step que seja <= step.ts
          let closestPrice = pos.purchasePrice;
          let bestDiff = Infinity;

          for (const h of hist) {
            const hTs = parseLocalDate(h.date).getTime();
            if (hTs <= step.ts) {
              const diff = step.ts - hTs;
              if (diff < bestDiff) {
                bestDiff = diff;
                closestPrice = h.close;
              }
            }
          }

          dailyValue += closestPrice * pos.quantity;
          dailyInvested += pos.invested;
        }
      });

      return {
        date: step.label,
        dateFull: step.dateStr,
        value: dailyValue || 0,
        invested: dailyInvested || 0,
      };
    });
  }, [positions, histories, chartPeriod]);

  // Alocação de ativos por categoria (Ações, FIIs, ETFs, Cripto)
  const allocation = useMemo(() => {
    const summary: Record<string, { value: number; count: number; color: string; label: string; icon: any }> = {
      stock: { value: 0, count: 0, color: "from-emerald-500 to-emerald-600", label: "Ações Brasil", icon: Briefcase },
      fund: { value: 0, count: 0, color: "from-sky-500 to-sky-600", label: "Fundos Imob. (FIIs)", icon: Building },
      etf: { value: 0, count: 0, color: "from-indigo-500 to-indigo-600", label: "ETFs Globais", icon: Layers },
      crypto: { value: 0, count: 0, color: "from-amber-500 to-amber-600", label: "Criptoativos", icon: Coins },
    };

    positions.forEach((pos) => {
      const q = quotes[pos.ticker]?.price ?? pos.purchasePrice;
      const val = q * pos.quantity;
      if (summary[pos.type]) {
        summary[pos.type].value += val;
        summary[pos.type].count += 1;
      }
    });

    const totalVal = Object.values(summary).reduce((s, c) => s + c.value, 0);

    return Object.entries(summary).map(([id, item]) => {
      const percentage = totalVal > 0 ? (item.value / totalVal) * 100 : 0;
      return {
        id,
        ...item,
        percentage,
      };
    });
  }, [positions, quotes]);

  // --- SVG CHANGER HELPERS ---
  const svgLinePath = useMemo(() => {
    if (chartData.length < 2) return "";
    const maxValue = Math.max(...chartData.map((d) => Math.max(d.value, d.invested)), 100);
    const minValue = Math.min(...chartData.map((d) => Math.min(d.value, d.invested)), 0);
    const range = maxValue - minValue;

    const width = 500;
    const height = 150;
    const padding = 10;

    const points = chartData.map((d, index) => {
      const x = padding + (index / (chartData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((d.value - minValue) / range) * (height - padding * 2);
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (2 * (p1.x - p0.x)) / 3;
      const cpY2 = p1.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }

    return {
      line: path,
      area: `${path} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`,
      points,
    };
  }, [chartData]);

  return (
    <div className="pb-16 max-w-4xl mx-auto space-y-6">
      {/* HEADER DE BEM-VINDO & SINCRONISMO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-sans tracking-tight text-stone-900 flex items-center gap-2">
            <span>Início</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full line-clamp-1">
              Consolidador Oficial
            </span>
          </h2>
          <p className="text-sm text-stone-500 font-sans mt-0.5">
            Monitore seu patrimônio total e estude sua rentabilidade acumulada de forma facilitada.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isLoadingQuotes ? (
            <button
              onClick={handleForceUpdate}
              className="p-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition shadow-sm hover:scale-105 active:scale-95 cursor-pointer text-xs font-semibold flex items-center gap-1.5"
              title="Atualizar cotações do mercado"
            >
              <RefreshCw size={13} className="text-emerald-500" />
              <span>Atualizar Mercado</span>
            </button>
          ) : (
            <div className="p-2.5 rounded-xl border border-stone-100 bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <RefreshCw size={13} className="animate-spin text-emerald-600" />
              <span>Consolidando Carteira...</span>
            </div>
          )}

          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="py-2.5 px-4 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/15 text-xs transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Novo Aporte</span>
          </button>
        </div>
      </div>

      {/* PAINEL PATRIMONIAL GERAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* VALOR PATRIMONIAL */}
        <div className="md:col-span-2 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-stone-100 pointer-events-none">
            <TrendingUp size={110} strokeWidth={0.8} />
          </div>

          <div className="z-10">
            <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold">
              Patrimônio Líquido Acumulado
            </span>
            <div className="mt-1 flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-extrabold font-sans tracking-tight text-stone-900 leading-none">
                R$ {totals.current.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <div
                className={`py-1 px-2.5 rounded-full text-xs font-bold leading-none flex items-center gap-1 shrink-0 ${
                  totals.absReturn >= 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "bg-rose-50 text-rose-700 border border-rose-100"
                }`}
              >
                {totals.absReturn >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                <span>
                  {totals.absReturn >= 0 ? "+" : ""}R${" "}
                  {totals.absReturn.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ({totals.pctReturn.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-100 pt-4 mt-6 grid grid-cols-2 gap-4 text-xs z-10">
            <div>
              <span className="text-stone-400 font-medium">Aporte Total Inicial</span>
              <p className="text-base font-bold text-stone-800 mt-0.5">
                R$ {totals.invested.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span className="text-stone-400 font-medium">Ativos Registrados</span>
              <p className="text-base font-bold text-stone-800 mt-0.5">
                {positions.length} ativo{positions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* ALOCAÇÃO DE ATIVOS (Mini Bento card) */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
                <Layers className="text-emerald-500" size={15} />
                <span>Alocação da Carteira</span>
              </h3>
              <span className="text-[10px] text-stone-400 font-medium">Divisão geral</span>
            </div>

            <div className="mt-4 space-y-3.5">
              {allocation.map((alloc) => (
                <div key={alloc.id} className="group">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-stone-600 flex items-center gap-1.5">
                      <alloc.icon size={13} className="text-stone-400" />
                      <span>{alloc.label}</span>
                    </span>
                    <span className="text-stone-900">{alloc.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${alloc.color} transition-all duration-500`}
                      style={{ width: `${alloc.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {positions.length === 0 && (
                <div className="text-center py-6">
                  <AlertCircle size={22} className="mx-auto text-stone-300" />
                  <p className="text-[11px] text-stone-400 mt-1">Carrege ativos e aportes para ver sua distribuição.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO DE NOVO APORTE EXPANDÍVEL */}
      {isFormOpen && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-6 shadow-md transition-all duration-200 animate-slide-up">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
            <h3 className="font-bold text-stone-900 flex items-center gap-2">
              <Award className="text-emerald-600" size={18} />
              <span>Registrar Nova Operação</span>
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {successAnimation ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
                <Check size={24} strokeWidth={3} />
              </div>
              <p className="mt-3 text-sm font-bold text-emerald-800">
                Lançamento registrado com sucesso!
              </p>
              <span className="text-xs text-emerald-600 mt-1">Patrimônio recalculado instantaneamente.</span>
            </div>
          ) : (
            <form onSubmit={handleAddTransaction} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* BUSCA DE ATIVOS */}
                <div className="relative">
                  <label className="block text-xs font-bold text-stone-600 mb-1.5">Ativo (Buscar Código/Nome)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-stone-400" size={14} />
                    <input
                      type="text"
                      value={selectedAsset ? selectedAsset.ticker : searchQuery}
                      onChange={(e) => {
                        setSelectedAsset(null);
                        setSearchQuery(e.target.value);
                      }}
                      placeholder="Ex: PETR4, BTC..."
                      className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-stone-900 font-semibold"
                    />
                    {selectedAsset && (
                      <button
                        type="button"
                        onClick={() => setSelectedAsset(null)}
                        className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 font-semibold font-sans text-xs"
                      >
                        Trocar
                      </button>
                    )}
                  </div>

                  {/* AUTOCOMPLETE DROPDOWN */}
                  {!selectedAsset && searchQuery.trim() && (
                    <div className="absolute left-0 right-0 top-16 z-50 rounded-xl border border-stone-200 bg-white max-h-56 overflow-y-auto shadow-lg divide-y divide-stone-50 animate-fade-in">
                      {filteredCatalogAssets.map((asset) => (
                        <button
                          key={asset.ticker}
                          type="button"
                          onClick={() => handleSelectAsset(asset)}
                          className="w-full px-4 py-2.5 text-left hover:bg-stone-50 transition flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={asset.logo}
                              alt={asset.ticker}
                              className="h-5 w-5 rounded-md object-contain bg-stone-100"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=32&auto=format&fit=crop&q=60";
                              }}
                            />
                            <div>
                              <p className="font-bold text-stone-900 font-mono">{asset.ticker}</p>
                              <span className="text-[10px] text-stone-400">{asset.name}</span>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
                            {asset.type}
                          </span>
                        </button>
                      ))}
                      {filteredCatalogAssets.length === 0 && (
                        <div className="px-4 py-4 text-center text-stone-400 italic">
                          Nenhum ativo encontrado com esse termo.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* TIPO DE OPERAÇÃO */}
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5">Operação</label>
                  <div className="grid grid-cols-2 gap-1 bg-stone-200/50 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTxKind("buy")}
                      className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                        txKind === "buy"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-stone-600 hover:text-stone-950"
                      }`}
                    >
                      Compra
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxKind("sell")}
                      className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                        txKind === "sell"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-stone-600 hover:text-stone-950"
                      }`}
                    >
                      Venda
                    </button>
                  </div>
                </div>

                {/* DATA DA OPERAÇÃO */}
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5">Data da Operação</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 text-stone-400" size={14} />
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* QUANTIDADE */}
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5">Quantidade</label>
                  <input
                    type="number"
                    step="any"
                    value={txQty}
                    onChange={(e) => setTxQty(e.target.value)}
                    placeholder="Ex: 10, 0.5..."
                    className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl focus:outline-none bg-white"
                  />
                </div>

                {/* PREÇO UNITÁRIO */}
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5">Preço Unitário (R$)</label>
                  <input
                    type="number"
                    step="any"
                    value={txPrice}
                    onChange={(e) => setTxPrice(e.target.value)}
                    placeholder="R$ por unidade"
                    className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl focus:outline-none bg-white"
                  />
                </div>

                {/* OBSERVAÇÃO / NOTA */}
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5">Observação (Opcional)</label>
                  <input
                    type="text"
                    value={txNote}
                    onChange={(e) => setTxNote(e.target.value)}
                    placeholder="Ex: Aporte mensal, trade..."
                    className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl focus:outline-none bg-white"
                  />
                </div>
              </div>

              {selectedAsset && (
                <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs mt-2 relative overflow-hidden transition-all duration-150-out">
                  <img
                    src={selectedAsset.logo}
                    alt={selectedAsset.ticker}
                    className="h-8 w-8 rounded-lg object-contain bg-white border p-0.5"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=32&auto=format&fit=crop&q=60";
                    }}
                  />
                  <div>
                    <h4 className="font-bold text-stone-850 font-mono uppercase">
                      {selectedAsset.ticker} — {selectedAsset.name}
                    </h4>
                    <p className="text-stone-500 font-semibold font-sans mt-0.5">
                      Rendimento histórico anual de cotações aprox:{" "}
                      <span className="text-emerald-600 font-bold">+{selectedAsset.volatility}%</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200/50 mt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-500 hover:text-stone-700 bg-white hover:bg-stone-50 text-xs font-semibold border transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/10 transition duration-150 cursor-pointer"
                >
                  Registrar Lançamento
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* SEGMENTO DE EVOLUÇÃO GRÁFICA */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-stone-800 flex items-center gap-1.5 text-sm">
              <TrendingUp className="text-emerald-500" size={16} />
              <span>Evolução Patrimonial Simulada</span>
            </h3>
            <span className="text-[11px] text-stone-400 mt-0.5">
              Estudo estático baseado em preços históricos arquivados da sua carteira
            </span>
          </div>

          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg text-xs font-semibold self-start sm:self-center">
            {([7, 30, 90] as const).map((period) => (
              <button
                key={period}
                onClick={() => setChartPeriod(period)}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  chartPeriod === period ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
                }`}
              >
                {period}D
              </button>
            ))}
          </div>
        </div>

        {positions.length === 0 ? (
          <div className="py-16 text-center">
            <HelpCircle size={40} className="mx-auto text-stone-300" />
            <h4 className="font-bold text-stone-700 mt-2 text-sm">Nenhum investimento adicionado ainda</h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              Adicione compras de ativos usando o botão <strong className="text-emerald-600 font-bold">Novo Aporte</strong> no canto superior da tela para simular a variação do seu patrimônio.
            </p>
          </div>
        ) : (
          <div className="relative pt-2">
            {/* HOVER TOOLTIP */}
            {activeHoverData && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-stone-900 text-white p-2.5 rounded-xl shadow-lg z-20 text-[10px] space-y-1 scale-95 transition-all duration-150">
                <p className="font-bold font-mono">{activeHoverData.date}</p>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-400">Patrimônio:</span>
                  <span className="font-extrabold text-emerald-400 font-mono">
                    R$ {activeHoverData.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-400">Total Investido:</span>
                  <span className="font-bold text-stone-300 font-mono">
                    R$ {activeHoverData.invested.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* ARTISANAL RESPONSIVE SVG GRAPH */}
            <div className="relative h-44 w-full">
              <svg
                viewBox="0 0 500 150"
                className="h-full w-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference lines */}
                <line x1="10" y1="10" x2="490" y2="10" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="3" />
                <line x1="10" y1="75" x2="490" y2="75" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="3" />
                <line x1="10" y1="140" x2="490" y2="140" stroke="#f4f4f5" strokeWidth="1" />

                {svgLinePath && (
                  <>
                    {/* Fill Area */}
                    <path d={svgLinePath.area} fill="url(#chartGradient)" />

                    {/* Gradient Stroke Line */}
                    <path
                      d={svgLinePath.line}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Circles on Hover checkpoints */}
                    {svgLinePath.points.map((pt, idx) => {
                      const dataPoint = chartData[idx];
                      const isHovered = activeHoverData?.date === dataPoint.date;
                      return (
                        <g key={idx}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isHovered ? 4.5 : 2}
                            fill={isHovered ? "#10b981" : "#34d399"}
                            stroke="#ffffff"
                            strokeWidth="1"
                            className="cursor-pointer transition-all duration-150 hover:r-5 focus:outline-none"
                            onMouseEnter={() =>
                              setActiveHoverData({
                                date: dataPoint.date,
                                value: dataPoint.value,
                                invested: dataPoint.invested,
                              })
                            }
                            onMouseLeave={() => setActiveHoverData(null)}
                          />
                        </g>
                      );
                    })}
                  </>
                )}
              </svg>
            </div>

            {/* HORIZONTAL DATE LABELS */}
            <div className="flex justify-between px-2.5 mt-2 text-[10px] text-stone-400 font-mono font-bold select-none">
              <span>{chartData[0]?.date}</span>
              <span>{chartData[Math.floor(chartData.length / 2)]?.date}</span>
              <span>{chartData[chartData.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </div>

      {/* LISTAGEM DE MEUS ATIVOS */}
      <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-stone-800 text-sm">Meus Ativos em Carteira</h3>
            <p className="text-[11px] text-stone-400 mt-0.5">Seus investimentos consolidados ativos no mercado</p>
          </div>
          <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full select-none font-mono">
            {positions.length} ativo{positions.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="divide-y divide-stone-100">
          {positions.map((pos) => {
            const rawQuote = quotes[pos.ticker];
            const currentPrice = rawQuote?.price ?? pos.purchasePrice;
            const currentTotal = currentPrice * pos.quantity;
            const assetDiff = currentPrice - pos.purchasePrice;
            const assetDiffPct = (assetDiff / pos.purchasePrice) * 100;

            const isPositive = assetDiff >= 0;

            return (
              <div
                key={pos.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-stone-50/75 transition gap-4"
              >
                {/* Info básica: Logo + Nome */}
                <div className="flex items-center gap-3">
                  <img
                    src={pos.logo}
                    alt={pos.ticker}
                    className="h-10 w-10 rounded-xl object-contain bg-stone-100 p-0.5 border border-stone-200"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=32&auto=format&fit=crop&q=60";
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-900 font-mono uppercase tracking-wide">
                        {pos.ticker}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-stone-400 bg-stone-100 px-1.5 py-0.2 rounded-md">
                        {pos.type}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 font-medium font-sans truncate max-w-xs">{pos.name}</p>
                  </div>
                </div>

                {/* Quantidades e Preço de Aquisição */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs text-left sm:text-right font-sans shrink-0">
                  <div>
                    <span className="text-stone-400 font-medium">Quantidade</span>
                    <p className="font-bold text-stone-900 mt-0.5 font-mono">
                      {pos.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 6 })}
                    </p>
                  </div>

                  <div>
                    <span className="text-stone-400 font-medium">Preço Médio</span>
                    <p className="font-semibold text-stone-600 mt-0.5 font-mono">
                      R$ {pos.purchasePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="hidden sm:block">
                    <span className="text-stone-400 font-medium">Cotação Atual</span>
                    <p className="font-bold text-stone-850 mt-0.5 font-mono">
                      R$ {currentPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Valor Total atual e Resultado */}
                <div className="flex items-center justify-between sm:justify-end gap-5 border-t border-dashed border-stone-100 sm:border-0 pt-3 sm:pt-0 shrink-0 text-right">
                  <div className="block sm:hidden text-left">
                    <span className="text-[10px] text-stone-400 font-medium">Cotação</span>
                    <p className="font-bold text-stone-800 font-mono text-xs mt-0.5">
                      R$ {currentPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div>
                    <span className="text-stone-450 text-[10px] sm:text-xs font-semibold">Valor Atual</span>
                    <p className="font-extrabold text-stone-900 leading-none text-base font-mono mt-0.5">
                      R$ {currentTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div
                      className={`text-[10px] font-bold font-mono mt-1 ${isPositive ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {isPositive ? "+" : ""}
                      {assetDiffPct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {positions.length === 0 && (
            <div className="py-12 text-center text-stone-400 italic text-xs select-none">
              Nenhum ativo consolidado. Lançe um aporte acima para começar!
            </div>
          )}
        </div>
      </div>

      {/* ÚLTIMAS TRANSAÇÕES / LANÇAMENTOS */}
      <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-stone-800 text-sm">Histórico de Alterações</h3>
            <p className="text-[11px] text-stone-400 mt-0.5">Últimos eventos e aportes de compra/venda</p>
          </div>
        </div>

        <div className="divide-y divide-stone-100">
          {transactions.slice(0, 8).map((tx) => {
            const isBuy = tx.kind === "buy";
            return (
              <div
                key={tx.id}
                className="p-5 flex items-center justify-between hover:bg-stone-50/50 transition gap-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 rounded-full border flex items-center justify-center shrink-0 ${
                      isBuy
                        ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                        : "bg-rose-50 border-rose-100 text-rose-600"
                    }`}
                  >
                    {isBuy ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-stone-900 leading-none flex items-center gap-1.5">
                      <span className="font-mono text-stone-850 uppercase">{tx.ticker}</span>
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                          isBuy ? "bg-emerald-100/70 text-emerald-800" : "bg-rose-100/70 text-rose-800"
                        }`}
                      >
                        {isBuy ? "COMPRA" : "VENDA"}
                      </span>
                    </p>
                    <span className="text-[10px] text-stone-400 font-semibold font-mono block mt-1">
                      {formatBR(tx.date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right text-xs">
                    <p className="font-bold text-stone-900 font-mono">
                      {isBuy ? "+" : "-"} R$ {tx.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-stone-400 font-mono mt-0.5 block">
                      {tx.quantity} un. x PM R$ {tx.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (window.confirm("Deseja realmente remover esta transação?")) {
                        removeTransaction(tx.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Excluir transação"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {transactions.length === 0 && (
            <div className="py-12 text-center text-stone-400 italic text-xs select-none">
              Nenhuma transação gravada ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
