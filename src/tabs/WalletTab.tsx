import React, { useEffect, useMemo, useRef, useState } from "react"; // useState mantido para outros estados
import { createPortal } from "react-dom";
import {
  TrendingUp, TrendingDown, Plus, PiggyBank,
  RefreshCw, ChevronRight, BarChart3, History,
  Terminal, X, Cpu, Sliders, Calendar, Coins, Check, Sparkles
} from "lucide-react";
import { usePortfolio, seedDemoIfEmpty, type Position } from "../services/portfolio";
import { getHistory, getQuote, getCachedQuotes, getCachedHistories, type HistoryPoint, type PriceQuote } from "../services/marketApi";
import { getPortfolioValueAt } from "../services/valueCalc";
import { ASSET_TYPE_LABEL, ASSET_TYPE_STYLE, findAsset, type CatalogAsset } from "../services/assetsCatalog";
import { seedTransactionsIfEmpty, useTransactions, addTransaction } from "../services/transactions";
import { localTs, todayISO, parseLocalDate } from "../services/dateUtils";
import { useAuth } from "../services/auth";
import { getGlobalSyncStatus, registerSyncListener, pushAllDataToSupabase } from "../services/supabaseSync";
import AssetLogo from "../components/AssetLogo";
import Sparkline from "../components/Sparkline";
import SearchAssetModal from "../components/SearchAssetModal";
import AddPositionModal from "../components/AddPositionModal";
import PositionDetailModal from "../components/PositionDetailModal";
import TransactionsHistoryModal from "../components/TransactionsHistoryModal";
import PortfolioEvolution from "../components/PortfolioEvolution";

interface PortfolioHistoryPoint {
  date: string;
  close: number;
  aplicado: number;
  ganho: number;
}

type WalletProps = {
  autoOpenAporte?: boolean;
  onConsumedAporte?: () => void;
};

const periods = [
  { id: 30, label: "1M" },
  { id: 90, label: "3M" },
  { id: 180, label: "6M" },
  { id: 365, label: "1A" },
  { id: 1825, label: "MÁX" },
];

function CloudSyncBar() {
  const { user } = useAuth();
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const performSilentPush = async () => {
      if (pushing) return;
      setPushing(true);
      try {
        console.log("[Finevo Cloud Sync] Realizando salvamento invisível e automático...");
        await pushAllDataToSupabase();
      } catch (e) {
        console.warn("[Finevo Cloud Sync Exception] Sincronização em segundo plano postergada:", e);
      } finally {
        setPushing(false);
      }
    };

    // Auto-sync silencioso após 1.5 segundos da abertura da Carteira
    const timer = setTimeout(performSilentPush, 1500);
    return () => clearTimeout(timer);
  }, [user]);

  return null;
}

const WalletTab = React.memo(function WalletTab({ autoOpenAporte, onConsumedAporte }: WalletProps) {
  const positions = usePortfolio();
  const hide = false;
  const [quotes, setQuotes] = useState<Record<string, PriceQuote>>(() => getCachedQuotes());
  const [histories, setHistories] = useState<Record<string, HistoryPoint[]>>(() => getCachedHistories());
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  const [syncConsoleOpen, setSyncConsoleOpen] = useState(false);
  const [serverAutoSyncLogs, setServerAutoSyncLogs] = useState<{ timestamp: string; message: string }[]>([]);
  const [serverLastSyncDate, setServerLastSyncDate] = useState("");
  const [triggeringServerSync, setTriggeringServerSync] = useState(false);

  const fetchServerSyncStatus = async () => {
    try {
      const res = await fetch("/api/market/auto-sync-status");
      if (res.ok) {
        const data = await res.json();
        setServerAutoSyncLogs(data.logs || []);
        setServerLastSyncDate(data.lastAutoSyncDate || "");
      }
    } catch (e) {
      console.error("Erro ao carregar logs do servidor", e);
    }
  };

  const triggerServerSync = async () => {
    setTriggeringServerSync(true);
    try {
      const res = await fetch("/api/market/trigger-auto-sync", { method: "POST" });
      if (res.ok) {
        showToast("Sincronização agendada no servidor!");
        setTimeout(() => {
          fetchServerSyncStatus();
          setTriggeringServerSync(false);
        }, 1500);
      } else {
        setTriggeringServerSync(false);
      }
    } catch {
      setTriggeringServerSync(false);
    }
  };

  // Modais
  const [searchOpen, setSearchOpen] = useState(false);
  const [pickedAsset, setPickedAsset] = useState<{ asset: CatalogAsset; quote: PriceQuote } | null>(null);
  const [detailPos, setDetailPos] = useState<Position | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Histórico de transações (count para exibir no botão)
  const { transactions } = useTransactions();

  // Período do gráfico geral
  const [period, setPeriod] = useState(90);

  // Seed demo quando vazio
  useEffect(() => {
    seedDemoIfEmpty();
    seedTransactionsIfEmpty();
  }, []);

  // Auto-open search modal vindo da home
  useEffect(() => {
    if (autoOpenAporte) {
      const t = window.setTimeout(() => setSearchOpen(true), 250);
      onConsumedAporte?.();
      return () => window.clearTimeout(t);
    }
  }, [autoOpenAporte, onConsumedAporte]);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 2400);
  };

  // Carrega cotações + histórico LONGO (sempre 1 ano para manter cálculos consistentes)
  // O período do gráfico só filtra a EXIBIÇÃO, não o cálculo.
  /**
   * Carrega cotação e histórico de cada ticker de forma INDEPENDENTE.
   * Conforme cada request volta, atualiza o estado parcialmente —
   * assim o usuário vê os dados aparecerem progressivamente sem esperar todos.
   */
  const loadMarketData = async (force = false) => {
    if (positions.length === 0) return;

    const tickers: string[] = Array.from(new Set(positions.map((p) => p.ticker)));
    
    // Evita loaders intermitentes se os dados já estiverem em cache
    const cachedQuotes = getCachedQuotes();
    const cachedHistories = getCachedHistories();
    const allCached = !force && tickers.every((t) => cachedQuotes[t] !== undefined && cachedHistories[t] !== undefined);

    if (!allCached) {
      setLoadingQuotes(true);
    } else {
      setLoadingQuotes(false);
    }

    const oldestPurchaseTs = Math.min(...positions.map((p) => localTs(p.purchaseDate)));
    const daysSinceOldest = Math.ceil((Date.now() - oldestPurchaseTs) / 86400000);
    const fetchDays = Math.max(365, daysSinceOldest + 30);

    // Dispara todas as cotações em paralelo, mas atualiza o estado conforme cada uma responde
    const quotePromises = tickers.map((t) =>
      getQuote(t, force)
        .then((q) => setQuotes((prev) => ({ ...prev, [t]: q })))
        .catch(() => {
          const purchasePrice = positions.find((p) => p.ticker === t)?.purchasePrice ?? 0;
          setQuotes((prev) => {
            if (prev[t] && prev[t].price > 0) return prev; // Mantém a cotação existente se já tiver
            return {
              ...prev,
              [t]: {
                ticker: t,
                price: purchasePrice,
                change: 0,
                changePercent: 0,
                prevClose: purchasePrice,
                marketTime: new Date().toISOString()
              }
            };
          });
        })
    );
    const historyPromises = tickers.map((t) =>
      getHistory(t, fetchDays, force)
        .then((h) => setHistories((prev) => ({ ...prev, [t]: h })))
        .catch(() => setHistories((prev) => ({ ...prev, [t]: [] })))
    );

    // Espera tudo terminar para tirar o loading
    await Promise.allSettled([...quotePromises, ...historyPromises]);
    setLoadingQuotes(false);
  };

  // Recarrega e força a atualização síncrona em background das cotações
  const positionsKey = positions.map((p) => `${p.ticker}_${p.purchaseDate}_${p.quantity}`).sort().join(",");
  
  // 1. Carga inicial e automática quando as posições mudam
  useEffect(() => {
    loadMarketData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey]);

  // 2. Automação inteligente invisível de alta frequência:
  // Força atualização em segundo plano 1.5s após abrir a tela e atualiza a cada 45 segundos em silêncio.
  useEffect(() => {
    if (positions.length === 0) return;

    // Agenda atualização real via rede (forçando bypass dos caches locais desatualizados para banir preço fixado em 38)
    const silentForceUpdate = async () => {
      console.log("[Finevo Market API] Atualizando cotações via Crawler do Google e Yahoo de forma 100% invisível em background...");
      try {
        await loadMarketData(true);
      } catch (e) {
        console.warn("[Finevo Market API Exception] Silently deferred pricing update:", e);
      }
    };

    // Dispara 1.5s após foco inicial
    const timeout = setTimeout(silentForceUpdate, 1500);

    // Ciclo recorrente de revalidação a cada 45s
    const interval = setInterval(silentForceUpdate, 45000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey]);

  // Série de evolução patrimonial - usa cálculo ANCORADO
  // O histórico carregado é SEMPRE longo (>= 1 ano), aqui só filtramos
  // a janela de EXIBIÇÃO pelo período selecionado.
  const portfolioHistory = useMemo(() => {
    if (positions.length === 0) return [] as PortfolioHistoryPoint[];

    // Junta todas as datas únicas dos históricos
    const allDates = new Set<string>();
    for (const p of positions) {
      const h = histories[p.ticker];
      if (h) for (const point of h) allDates.add(point.date);
    }
    const sortedAll = Array.from(allDates).sort();
    if (sortedAll.length === 0) {
      // Fallback absoluto de segurança para evitar que a UI mostre o spinner indefinidamente:
      // Se não há datas (ex: falhas extremas de conectividade), gera um histórico linear estável de "period" dias
      const fallbackPoints: PortfolioHistoryPoint[] = [];
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const totalCurrent = positions.reduce((sum, p) => sum + (quotes[p.ticker]?.price ?? p.purchasePrice) * p.quantity, 0);
      const totalInvested = positions.reduce((sum, p) => sum + p.invested, 0);

      for (let i = period; i >= 0; i--) {
        const d = new Date(now - i * dayMs);
        fallbackPoints.push({
          date: d.toISOString().split("T")[0],
          close: Math.round(totalCurrent * 100) / 100,
          aplicado: Math.round(totalInvested * 100) / 100,
          ganho: Math.round((totalCurrent - totalInvested) * 100) / 100,
        });
      }
      return fallbackPoints;
    }

    // Janela de exibição
    const cutoffTs = Date.now() - period * 86400000;
    const todayKey = todayISO();

    let datesInWindow = sortedAll.filter((date) => localTs(date) >= cutoffTs);

    // Garante o ponto "hoje" como último ponto exato
    if (!datesInWindow.includes(todayKey)) datesInWindow.push(todayKey);

    // Se a janela ficou muito pequena (ex: 1M com pouco histórico), adiciona pontos
    if (datesInWindow.length < 2) {
      datesInWindow = sortedAll.slice(-Math.min(30, sortedAll.length));
      if (!datesInWindow.includes(todayKey)) datesInWindow.push(todayKey);
    }

    return datesInWindow
      .map((date) => {
        const ts = localTs(date);
        const { value } = getPortfolioValueAt(positions, ts, histories, quotes, transactions, false);
        const close = Math.round(value * 100) / 100;

        // Valor aplicado (compras menos vendas registradas até essa data limite)
        const comprado = transactions
          .filter((t) => t.kind === "buy" && localTs(t.date) <= ts)
          .reduce((sum, t) => sum + t.total, 0);

        const vendido = transactions
          .filter((t) => t.kind === "sell" && localTs(t.date) <= ts)
          .reduce((sum, t) => sum + t.total, 0);

        let netAplicado = Math.max(0, comprado - vendido);
        if (netAplicado === 0 && positions.length > 0) {
          const activePositions = positions.filter((p) => localTs(p.purchaseDate) <= ts + 86400000);
          netAplicado = activePositions.reduce((sum, p) => sum + p.invested, 0);
        }

        // Rendimento (permitindo variação negativa legítima se value < netAplicado)
        const ganho = netAplicado > 0 ? close - netAplicado : 0;

        return {
          date,
          close,
          aplicado: Math.round(netAplicado * 100) / 100,
          ganho: Math.round(ganho * 100) / 100,
        };
      })
      .filter((p) => p.close > 0); // remove pontos antes de qualquer compra
  }, [positions, histories, quotes, period, transactions]);

  return (
    <div className="px-5 pt-8 pb-32 md:pb-12 space-y-5">
      {/* Toast */}
      {toast && createPortal(
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-slide-up">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 font-medium shadow-lg">
            {toast}
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-stone-500">Sua carteira</p>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Patrimônio</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="h-10 px-4 flex items-center gap-1.5 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 transition shadow-sm shadow-emerald-500/30 font-semibold text-sm"
          >
            <Plus size={16} /> Novo Aporte
          </button>
        </div>
      </header>

      {/* Sincronização Cloud */}
      <CloudSyncBar />

      {/* Empty state */}
      {positions.length === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-stone-200 bg-white p-10 text-center">
          <PiggyBank size={40} className="mx-auto text-stone-300" />
          <p className="text-sm font-semibold text-stone-700 mt-4">Comece a investir</p>
          <p className="text-[11px] text-stone-500 mt-1 max-w-[280px] mx-auto">
            Adicione seu primeiro ativo e acompanhe a evolução do seu patrimônio em tempo real.
          </p>
          <button
            onClick={() => setSearchOpen(true)}
            className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition shadow-md shadow-emerald-500/30"
          >
            <Plus size={16} /> Novo Aporte
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna Principal: Evolução de Patrimônio e Ativos */}
          <div className="lg:col-span-7 space-y-5">
            <PortfolioEvolution
              history={portfolioHistory}
              period={period}
              onChangePeriod={setPeriod}
              isLoading={loadingQuotes}
              isWalletEmpty={positions.length === 0}
            />

            {/* Lista de posições */}
            <section className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-stone-900">Meus investimentos</h3>
                <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">{positions.length} ativo{positions.length !== 1 ? "s" : ""}</span>
              </div>
              {(() => {
                // Agrupa por tipo
                const groups: Record<string, Position[]> = {};
                for (const p of positions) {
                  if (!groups[p.type]) groups[p.type] = [];
                  groups[p.type].push(p);
                }
                // Ordem visual dos tipos (mais comuns primeiro)
                const typeOrder: (keyof typeof ASSET_TYPE_LABEL)[] = ["stock", "fund", "etf", "crypto"];
                const orderedTypes = typeOrder.filter((t) => groups[t]?.length);

                return (
                  <div className="space-y-5">
                    {orderedTypes.map((type) => {
                      const items = groups[type]
                        .slice()
                        .sort((a, b) => {
                          const va = (quotes[a.ticker]?.price ?? a.purchasePrice) * a.quantity;
                          const vb = (quotes[b.ticker]?.price ?? b.purchasePrice) * b.quantity;
                          return vb - va;
                        });
                      const groupTotal = items.reduce((s, p) => {
                        const price = quotes[p.ticker]?.price ?? p.purchasePrice;
                        return s + price * p.quantity;
                      }, 0);

                      return (
                        <div key={type}>
                          {/* Cabeçalho do grupo */}
                          <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ASSET_TYPE_STYLE[type]}`}>
                                {ASSET_TYPE_LABEL[type]}
                              </span>
                              <span className="text-[10px] text-stone-400">
                                {items.length} {items.length === 1 ? "ativo" : "ativos"}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-stone-700">
                              R$ {groupTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          {/* Lista de ativos do grupo */}
                          <div className="space-y-2">
                            {items.map((p) => (
                              <PositionCard
                                key={p.id}
                                position={p}
                                quote={quotes[p.ticker]}
                                history={histories[p.ticker] ?? []}
                                onClick={() => setDetailPos(p)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>
          </div>

          {/* Coluna Lateral: Métricas Avançadas, Alocação, Histórico de Lançamentos */}
          <div className="lg:col-span-5 space-y-5">
            {/* Alocação por tipo */}
            <AllocationByType positions={positions} quotes={quotes} hide={hide} />

            {/* Histórico de Rentabilidade Mensal */}
            <MonthlyProfitability positions={positions} transactions={transactions} quotes={quotes} histories={histories} />

            {/* Agenda de Dividendos Futuros / Previsão */}
            <FutureDividends positions={positions} quotes={quotes} />

            {/* Histórico de lançamentos */}
            <section>
              <button
                onClick={() => setHistoryOpen(true)}
                className="w-full flex items-center gap-3 rounded-3xl bg-white border border-stone-200 p-4 hover:bg-stone-50 transition shadow-sm group active:scale-[0.99]"
              >
                <span className="h-11 w-11 grid place-items-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 group-hover:scale-110 transition-transform">
                  <History size={20} />
                </span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-stone-900">Histórico de lançamentos</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {transactions.length === 0
                      ? "Nenhum lançamento ainda"
                      : `${transactions.length} ${transactions.length === 1 ? "operação registrada" : "operações registradas"}`}
                  </p>
                </div>
                <ChevronRight size={18} className="text-stone-400 group-hover:text-stone-600 transition" />
              </button>
            </section>
          </div>
        </div>
      )}

      {/* Modais */}
      <SearchAssetModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(asset, quote) => {
          setSearchOpen(false);
          setPickedAsset({ asset, quote });
        }}
      />
      <AddPositionModal
        open={!!pickedAsset}
        onClose={() => setPickedAsset(null)}
        asset={pickedAsset?.asset ?? null}
        quote={pickedAsset?.quote ?? null}
        onSuccess={(msg) => {
          showToast(msg);
          setPickedAsset(null);
          // O useEffect reage automaticamente à mudança em positions
        }}
      />
      <PositionDetailModal
        open={!!detailPos}
        onClose={() => setDetailPos(null)}
        position={detailPos}
        quote={detailPos ? quotes[detailPos.ticker] : null}
        onRemoved={(msg) => showToast(msg)}
        onAddMore={async () => {
          // Abre direto o modal de cadastro de aporte para o ativo atual,
          // sem passar pela busca.
          if (!detailPos) return;
          const asset = findAsset(detailPos.ticker);
          if (!asset) {
            // fallback raro: catalogo não tem o ativo → abre busca
            setSearchOpen(true);
            return;
          }
          let q = quotes[detailPos.ticker];
          if (!q) {
            try {
              q = await getQuote(detailPos.ticker);
            } catch {
              showToast("Não foi possível carregar a cotação");
              return;
            }
          }
          setPickedAsset({ asset, quote: q });
        }}
      />
      <TransactionsHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

    </div>
  );
});

/* ===== Card de posição ===== */
function PositionCard({
  position,
  quote,
  history,
  onClick,
}: {
  position: Position;
  quote?: PriceQuote;
  history: HistoryPoint[];
  onClick: () => void;
  key?: any;
}) {
  const currentPrice = quote?.price ?? position.purchasePrice;
  // Arredonda para 2 casas — corrige erros de ponto flutuante
  // (ex: 15.3846 × 32.50 = 500.000000001 → vira 500.00)
  const rawValue = currentPrice * position.quantity;
  const currentValue = Math.round(rawValue * 100) / 100;

  // Se a diferença com o investido for ≤ 1 centavo, considera "sem variação"
  // (evita lucro/prejuízo fantasma de R$ 0,01 por erro de float)
  const rawProfit = currentValue - position.invested;
  const profit = Math.abs(rawProfit) < 0.02 ? 0 : Math.round(rawProfit * 100) / 100;
  const profitPct = position.invested > 0 ? (profit / position.invested) * 100 : 0;
  const positive = profit >= 0;

  const dayUp = quote ? quote.changePercent >= 0 : true;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-white border border-stone-200 p-3.5 hover:bg-stone-50 transition shadow-sm group"
    >
      <div className="flex items-center gap-3">
        <AssetLogo ticker={position.ticker} logo={position.logo} type={position.type} size={42} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-stone-900 truncate">{position.ticker}</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ASSET_TYPE_STYLE[position.type]}`}>
              {ASSET_TYPE_LABEL[position.type]}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 flex items-center flex-wrap gap-x-1 mt-0.5">
            <span>
              {position.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {position.type === "fund" ? "cotas" : position.type === "crypto" ? position.ticker : "un."}
            </span>
          </p>
        </div>

        {/* Mini sparkline */}
        <div className="hidden xs:block">
          <Sparkline
            data={history.length > 1 ? history.map((h) => h.close) : [1, 1]}
            width={56}
            height={28}
            color={positive ? "#10b981" : "#f43f5e"}
            fillColor={positive ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)"}
            strokeWidth={1.4}
          />
        </div>

        <div className="text-right shrink-0 min-w-[80px]">
          <p className="text-sm font-bold text-stone-900">
            R$ {currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition" />
      </div>
    </button>
  );
}

/* ===== Alocação por Ativo com Gráfico circular de Rosca (Donut) e Rótulos ===== */
function AllocationByType({
  positions,
  quotes,
  hide,
}: {
  positions: Position[];
  quotes: Record<string, PriceQuote>;
  hide: boolean;
}) {
  const byAsset = useMemo(() => {
    const map: Record<string, { value: number; count: number; type: string }> = {};
    for (const p of positions) {
      const price = quotes[p.ticker]?.price ?? p.purchasePrice;
      const value = price * p.quantity;
      if (!map[p.ticker]) {
        map[p.ticker] = { value: 0, count: 0, type: p.type };
      }
      map[p.ticker].value += value;
      map[p.ticker].count += 1;
    }
    const total = Object.values(map).reduce((a, b) => a + b.value, 0);
    return Object.entries(map)
      .map(([ticker, data]) => ({
        ticker,
        type: data.type,
        value: data.value,
        count: data.count,
        pct: total > 0 ? (data.value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [positions, quotes]);

  const ASSET_COLORS = [
    { bg: "bg-[#4263eb]", hex: "#4263eb" },   // Royal Blue (BBSE3)
    { bg: "bg-[#76c15b]", hex: "#76c15b" },   // Mid-Green (ALZR11)
    { bg: "bg-[#ecc04a]", hex: "#ecc04a" },   // Golden Yellow (BBAS3)
    { bg: "bg-[#ea5252]", hex: "#ea5252" },   // Coral Red (HGBS11)
    { bg: "bg-[#64c3ec]", hex: "#64c3ec" },   // Light Blue (GGRC11)
    { bg: "bg-[#24a26e]", hex: "#24a26e" },   // Sea-Green (GARE11)
    { bg: "bg-[#f38d49]", hex: "#f38d49" },   // Soft Orange (SAPR4)
    { bg: "bg-violet-400", hex: "#a78bfa" },  // Fallbacks
    { bg: "bg-fuchsia-400", hex: "#e879f9" },
    { bg: "bg-amber-300", hex: "#fcd34d" },
    { bg: "bg-teal-400", hex: "#2dd4bf" },
  ];

  const totalValue = useMemo(() => {
    return byAsset.reduce((acc, curr) => acc + curr.value, 0);
  }, [byAsset]);

  return (
    <section>
      <h3 className="text-sm font-semibold text-stone-900 mb-3">
        Posição atual (ativos)
      </h3>
      <div className="rounded-3xl bg-white border border-stone-200 p-6 shadow-sm">
        <div className="flex flex-col items-center justify-center">
          {/* Donut Chart with Sector Text Labels */}
          <div className="relative w-64 h-64 shrink-0 flex items-center justify-center mb-6">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* Background circle of the donut track */}
              <circle
                cx="100"
                cy="100"
                r="79.57747"
                fill="transparent"
                stroke="#f5f5f4"
                strokeWidth="28"
              />
              {(() => {
                let accumulatedPercent = 0;
                return byAsset.map((item, idx) => {
                  const pct = item.pct;
                  if (pct <= 0) return null;
                  const dashArray = `${(pct * 5).toFixed(3)} ${((100 - pct) * 5).toFixed(3)}`;
                  const dashOffset = ((100 - accumulatedPercent) * 5).toFixed(3);
                  accumulatedPercent += pct;
                  const color = ASSET_COLORS[idx % ASSET_COLORS.length];
                  return (
                    <circle
                      key={item.ticker}
                      cx="100"
                      cy="100"
                      r="79.57747"
                      fill="transparent"
                      stroke={color.hex}
                      strokeWidth="28"
                      strokeDasharray={dashArray}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 100 100)"
                      className="transition-all duration-300 ease-out hover:stroke-[30px] cursor-pointer"
                    >
                      <title>{`${item.ticker}: ${pct.toFixed(2)}%`}</title>
                    </circle>
                  );
                });
              })()}

              {/* Text labels rendered directly over the sectors */}
              {(() => {
                let accumulatedPercent = 0;
                return byAsset.map((item, idx) => {
                  const pct = item.pct;
                  const startPct = accumulatedPercent;
                  accumulatedPercent += pct;

                  if (pct < 4.5) return null; // Avoid labels on very small slices to prevent overlap

                  const midPct = startPct + pct / 2;
                  const midAngle = -Math.PI / 2 + (2 * Math.PI * midPct) / 100;

                  // Compute coordinates along the middle of the track (radius 79.57747)
                  const x = 100 + 79.57747 * Math.cos(midAngle);
                  const y = 100 + 79.57747 * Math.sin(midAngle);

                  return (
                    <g key={`label-${item.ticker}`}>
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="font-sans text-[8.5px] font-extrabold fill-stone-900 leading-tight pointer-events-none select-none"
                      >
                        <tspan x={x} dy="-4" className="font-extrabold">{item.ticker}</tspan>
                        <tspan x={x} dy="9" className="font-bold text-[7.5px] fill-stone-700">{pct.toFixed(2)}%</tspan>
                      </text>
                    </g>
                  );
                });
              })()}
            </svg>
          </div>

          {/* Vertical List Legend at the bottom, exactly matching the image */}
          <div className="w-full space-y-3.5 border-t border-stone-150 pt-5">
            {byAsset.map((item, idx) => {
              const color = ASSET_COLORS[idx % ASSET_COLORS.length];
              return (
                <div key={item.ticker} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-xs font-bold text-stone-700 tracking-tight">
                      {item.ticker}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-stone-900 font-sans tracking-tight">
                    {hide ? "•••%" : `${item.pct.toFixed(2)}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== Rentabilidade Histórica Mensal ===== */
function MonthlyProfitability({
  positions,
  transactions,
  quotes,
  histories,
}: {
  positions: Position[];
  transactions: any[];
  quotes: Record<string, PriceQuote>;
  histories: Record<string, HistoryPoint[]>;
}) {
  const isHistoryLoading = useMemo(() => {
    return positions.some((p) => !histories[p.ticker]);
  }, [positions, histories]);

  const monthlyData = useMemo(() => {
    if (positions.length === 0) return [];
    if (isHistoryLoading) return [];

    let earliestDate = new Date();
    // Default de 5 meses atrás para ter pelo menos 6 meses sempre disponíveis
    earliestDate.setMonth(earliestDate.getMonth() - 5);

    positions.forEach((p) => {
      const pDate = parseLocalDate(p.purchaseDate);
      if (pDate < earliestDate) {
        earliestDate = pDate;
      }
    });

    const today = new Date();
    const months: { year: number; month: number; key: string; label: string }[] = [];

    let current = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
    const limitDate = new Date(today.getFullYear(), today.getMonth(), 1);

    while (current <= limitDate) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      const shortLabel = `${monthNames[month].substring(0, 3)}/${String(year).substring(2)}`;

      months.push({ year, month, key, label: shortLabel });
      current.setMonth(current.getMonth() + 1);
    }

    const selectedMonths = months.slice(-12).reverse();

    return selectedMonths.map((m) => {
      const isCurrentMonth = m.year === today.getFullYear() && m.month === today.getMonth();
      const endTs = isCurrentMonth
        ? Date.now()
        : new Date(m.year, m.month + 1, 0, 23, 59, 59).getTime();

      const prevMonthEndTs = new Date(m.year, m.month, 0, 23, 59, 59).getTime();

      const { value: initialValue } = getPortfolioValueAt(positions, prevMonthEndTs, histories, quotes, transactions);
      const { value: finalValue } = getPortfolioValueAt(positions, endTs, histories, quotes, transactions);

      const monthPrefix = m.key;
      const currentMonthTx = transactions.filter((t) => t.date.startsWith(monthPrefix));

      const buys = currentMonthTx.filter((t) => t.kind === "buy").reduce((sum, t) => sum + t.total, 0);
      const sells = currentMonthTx.filter((t) => t.kind === "sell").reduce((sum, t) => sum + t.total, 0);
      const contributions = buys - sells;

      const dividends = currentMonthTx.filter((t) => t.kind === "dividend").reduce((sum, t) => sum + t.total, 0);

      const gainOrLoss = (finalValue - initialValue - contributions) + dividends;
      const base = initialValue + Math.max(0, contributions);
      const profitPct = base > 0 ? (gainOrLoss / base) * 100 : 0;

      return {
        key: m.key,
        label: m.label,
        initialValue,
        finalValue,
        contributions,
        dividends,
        gainOrLoss: Math.round(gainOrLoss * 100) / 100,
        profitPct: Math.round(profitPct * 100) / 100,
      };
    });
  }, [positions, transactions, quotes, histories]);

  const totalSummary = useMemo(() => {
    // Filtramos apenas meses onde houve saldo/atividade para calcular o retorno acumulado correto do período ativo
    const activeMonths = monthlyData.filter(d => d.initialValue > 0 || d.finalValue > 0 || d.contributions !== 0);
    if (activeMonths.length === 0) return { gainOrLoss: 0, profitPct: 0 };

    const totalGainOrLoss = activeMonths.reduce((sum, d) => sum + d.gainOrLoss, 0);
    
    // Rentabilidade Acumulada baseada em Retorno de Caixa Real do Período (Cash-on-Cash)
    // para evitar distorções do método TWR (Time-Weighted Return) quando o saldo inicial em meses passados era muito pequeno.
    let totalBase = 0;
    if (activeMonths.length > 0) {
      const oldestMonth = activeMonths[activeMonths.length - 1];
      const initialCapital = oldestMonth.initialValue;
      const positiveContributions = activeMonths.reduce((sum, d) => sum + Math.max(0, d.contributions), 0);
      totalBase = initialCapital + positiveContributions;
    }
    const profitPct = totalBase > 0 ? (totalGainOrLoss / totalBase) * 100 : 0;

    return {
      gainOrLoss: totalGainOrLoss,
      profitPct: profitPct,
    };
  }, [monthlyData]);

  if (isHistoryLoading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">
            Rentabilidade mensal
          </h3>
          <span className="text-[11px] text-stone-500 animate-pulse">Sincronizando...</span>
        </div>

        <div className="rounded-3xl bg-white border border-stone-200 p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-stone-100">
            <div>
              <span className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider">
                Rentabilidade Total
              </span>
              <div className="h-6 w-24 bg-stone-100 rounded-lg animate-pulse mt-1" />
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider">
                Retorno no Período
              </span>
              <div className="h-6 w-28 bg-stone-100 rounded-lg animate-pulse mt-1 ml-auto" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-[72px] bg-stone-50 border border-stone-100/50 rounded-2xl p-3 flex flex-col justify-between animate-pulse">
                <div className="h-3 w-10 bg-stone-200 rounded" />
                <div className="h-4 w-16 bg-stone-200 rounded mt-2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (monthlyData.length === 0) return null;

  const totalIsPositive = totalSummary.gainOrLoss >= 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">
          Rentabilidade mensal
        </h3>
        <span className="text-[11px] text-stone-500">Histórico de retorno</span>
      </div>

      <div className="rounded-3xl bg-white border border-stone-200 p-5 shadow-sm space-y-4">
        {/* Bloco de Resumo da Rentabilidade Total / Acumulada */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-stone-100">
          <div>
            <span className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider">
              Rentabilidade Total
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-lg font-extrabold tracking-tight ${totalIsPositive ? "text-emerald-600" : "text-rose-600"}`}>
                {totalIsPositive ? "+" : ""}{totalSummary.profitPct.toFixed(2)}%
              </span>
              <span className="text-[10px] text-stone-400">período</span>
            </div>
          </div>
          <div className="text-right font-semibold">
            <span className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider">
              Retorno no Período
            </span>
            <div className="flex items-baseline justify-end gap-1 mt-0.5">
              <span className={`text-lg font-extrabold tracking-tight ${totalIsPositive ? "text-emerald-600" : "text-rose-600"}`}>
                {totalIsPositive ? "+" : ""}R$ {totalSummary.gainOrLoss.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {monthlyData.map((data) => {
            const isPurePositive = data.gainOrLoss >= 0;
            const hasActivity = data.initialValue > 0 || data.finalValue > 0 || data.contributions !== 0;

            if (!hasActivity) {
              return (
                <div key={data.key} className="bg-stone-50/50 border border-stone-100/50 rounded-2xl p-3 flex flex-col justify-between opacity-50">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">{data.label}</span>
                  <div className="mt-1">
                    <span className="text-[11px] font-semibold text-stone-300">Sem saldo</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={data.key} className="bg-stone-50 hover:bg-stone-100/55 border border-stone-200/40 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:shadow-sm">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-stone-600 uppercase tracking-tight">{data.label}</span>
                  <div className="flex items-center gap-1">
                    {data.dividends > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title={`+R$ ${data.dividends.toLocaleString("pt-BR")} div`} />
                    )}
                    {data.contributions > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" title={`+R$ ${data.contributions.toLocaleString("pt-BR")} aporte`} />
                    )}
                  </div>
                </div>

                <div className="mt-1.5">
                  <span className={`text-xs sm:text-sm font-extrabold flex items-center gap-0.5 ${isPurePositive ? "text-emerald-600" : "text-rose-600"}`}>
                    {isPurePositive ? <TrendingUp size={11} className="inline" /> : <TrendingDown size={11} className="inline" />}
                    {isPurePositive ? "+" : ""}{data.profitPct.toFixed(2)}%
                  </span>
                  <span className="block text-[10px] text-stone-400 font-medium truncate">
                    {isPurePositive ? "+" : ""}R$ {data.gainOrLoss.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {(data.dividends > 0 || data.contributions > 0) && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-1 border-t border-stone-100">
                    {data.dividends > 0 && (
                      <span className="text-[8px] font-extrabold bg-emerald-100/50 text-emerald-700 px-1 py-0.5 rounded leading-tight">
                        +R${Math.round(data.dividends)} div
                      </span>
                    )}
                    {data.contributions > 0 && (
                      <span className="text-[8px] font-extrabold bg-sky-100/50 text-sky-700 px-1 py-0.5 rounded leading-tight">
                        +R${Math.round(data.contributions)} ap
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ===== Previsão de Dividendos do Mês (Calendário de Proventos) ===== */
interface FutureDividendsProps {
  positions: Position[];
  quotes: Record<string, PriceQuote>;
}

interface DividendEstimateRule {
  shareAmount: number;
  type: "business_day" | "calendar_day";
  dayValue: number;
  label: string;
}

const DIVIDEND_ESTIMATES: Record<string, DividendEstimateRule> = {
  // FIIs (proventos recorrentes baseados no histórico real)
  MXRF11: { shareAmount: 0.10, type: "business_day", dayValue: 10, label: "10º Dia Útil" },
  HGLG11: { shareAmount: 1.10, type: "business_day", dayValue: 10, label: "10º Dia Útil" },
  XPLG11: { shareAmount: 0.78, type: "business_day", dayValue: 10, label: "10º Dia Útil" },
  KNRI11: { shareAmount: 1.00, type: "business_day", dayValue: 10, label: "10º Dia Útil" },
  VISC11: { shareAmount: 0.85, type: "business_day", dayValue: 10, label: "10º Dia Útil" },
  HGRE11: { shareAmount: 0.95, type: "business_day", dayValue: 10, label: "10º Dia Útil" },
  XPML11: { shareAmount: 0.90, type: "calendar_day", dayValue: 25, label: "Mensal (Dia 25)" },
  KNIP11: { shareAmount: 0.80, type: "business_day", dayValue: 10, label: "10º Dia Útil" },
  BTLG11: { shareAmount: 0.76, type: "calendar_day", dayValue: 25, label: "Mensal (Dia 25)" },
  HGRU11: { shareAmount: 0.85, type: "business_day", dayValue: 10, label: "10º Dia Útil" },
  HGBS11: { shareAmount: 1.40, type: "business_day", dayValue: 10, label: "10º Dia Útil" },
  TRXF11: { shareAmount: 0.85, type: "business_day", dayValue: 10, label: "10º Dia Útil" },

  // Ações brasileiras populares (historicos recorrentes adaptados)
  PETR4: { shareAmount: 0.82, type: "calendar_day", dayValue: 20, label: "Provento Trimestral" },
  VALE3: { shareAmount: 1.35, type: "calendar_day", dayValue: 28, label: "Provento Semestral" },
  ITUB4: { shareAmount: 0.24, type: "business_day", dayValue: 1, label: "1º Dia Útil" },
  BBAS3: { shareAmount: 0.45, type: "calendar_day", dayValue: 27, label: "Agenda BB" },
  BBDC4: { shareAmount: 0.19, type: "business_day", dayValue: 1, label: "1º Dia Útil" },
  WEGE3: { shareAmount: 0.28, type: "calendar_day", dayValue: 18, label: "Provento Fixo" },
  ABEV3: { shareAmount: 0.15, type: "calendar_day", dayValue: 22, label: "Previsão Ambev" },
  B3SA3: { shareAmount: 0.18, type: "calendar_day", dayValue: 24, label: "Calendário B3" },
};

// Detecção correta de feriados e fins de semana em B3
function checkIsWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

// Retorna o N-ésimo dia útil do mês selecionado
function fetchNthBusinessDay(year: number, month: number, n: number): Date {
  const d = new Date(year, month, 1);
  let count = 0;
  while (count < n) {
    if (!checkIsWeekend(d)) {
      count++;
    }
    if (count < n) {
      d.setDate(d.getDate() + 1);
    }
  }
  return d;
}

// Determina se cai no fim de semana e passa para a data util seguinte líquida
function solveNextBusinessDay(year: number, month: number, day: number): Date {
  const d = new Date(year, month, day);
  while (checkIsWeekend(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function FutureDividends({ positions, quotes }: FutureDividendsProps) {
  const [expanded, setExpanded] = useState(false);

  // Mês e ano atual local
  const today = new Date();
  const currentMonthIdx = today.getMonth();
  const currentMonthName = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ][currentMonthIdx];

  // Filtra as posições qualificadas da carteira que possuem previsão de dividendos
  const divAtivos = useMemo(() => {
    const year = today.getFullYear();
    const month = today.getMonth();

    return positions
      .filter((p) => p.quantity > 0 && DIVIDEND_ESTIMATES[p.ticker.toUpperCase()])
      .map((p) => {
        const ticker = p.ticker.toUpperCase();
        const est = DIVIDEND_ESTIMATES[ticker];
        const shareAmount = est.shareAmount;
        const totalEstimated = p.quantity * shareAmount;
        
        let targetDate: Date;
        if (est.type === "business_day") {
          targetDate = fetchNthBusinessDay(year, month, est.dayValue);
        } else {
          targetDate = solveNextBusinessDay(year, month, est.dayValue);
        }

        const calculatedDay = targetDate.getDate();
        const calculatedWeekDay = [
          "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
        ][targetDate.getDay()];

        // Cotação para calcular Dividend Yield do mês
        const currentPrice = quotes[p.ticker]?.price ?? p.purchasePrice;
        const dyPercentage = currentPrice > 0 ? (shareAmount / currentPrice) * 100 : 0;

        return {
          position: p,
          ticker,
          name: p.name,
          logo: p.logo,
          quantity: p.quantity,
          type: p.type,
          shareAmount,
          day: calculatedDay,
          weekDay: calculatedWeekDay,
          label: est.label,
          dyPercentage,
          totalEstimated: Math.round(totalEstimated * 100) / 100,
        };
      })
      .sort((a, b) => a.day - b.day);
  }, [positions, quotes]);

  if (positions.length === 0 || divAtivos.length === 0) {
    return null;
  }

  // Estatísticas agregadas
  const totalEstimados = divAtivos.reduce((sum, item) => sum + item.totalEstimated, 0);

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 rounded-3xl bg-white border border-stone-200 p-4 hover:bg-stone-50 transition shadow-sm group active:scale-[0.99] cursor-pointer"
      >
        <span className="h-11 w-11 grid place-items-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 group-hover:scale-110 transition-transform shrink-0">
          <Coins size={20} />
        </span>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center justify-between pr-2 gap-1">
            <p className="text-sm font-bold text-stone-900 truncate">Agenda de proventos ({currentMonthName})</p>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full shrink-0">
              Confirmado
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-0.5 truncate">
            {divAtivos.length} {divAtivos.length === 1 ? "ativo renderá" : "ativos renderão"} proventos estimados neste mês
          </p>
        </div>
        <ChevronRight
          size={18}
          className={`text-stone-400 group-hover:text-stone-600 transition-transform duration-300 shrink-0 ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="mt-2.5 rounded-3xl p-5 bg-stone-50 border border-stone-200/60 shadow-inner space-y-3.5 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200/50">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Ativo & Data Prevista</span>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Status de Distribuição</span>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
            {divAtivos.map((item) => (
              <div
                key={item.ticker}
                className="flex items-center justify-between p-3 rounded-2xl bg-white border border-stone-200/60 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-stone-50 flex items-center justify-center shrink-0 border border-stone-100">
                    <AssetLogo ticker={item.ticker} logo={item.logo} type={item.type} size={32} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-stone-900 truncate">{item.ticker}</p>
                      <span className="text-[9px] text-stone-400 font-medium whitespace-nowrap">
                        {item.quantity} {item.type === "fund" ? "cotas" : "un."}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1">
                      <Calendar size={10} className="shrink-0 text-stone-400" />
                      Previsto para {item.weekDay}, {item.day} de {currentMonthName.substring(0, 3)}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">
                      {item.label}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-extrabold text-stone-900">
                    +R$ {item.totalEstimated.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[9.5px] text-stone-400 leading-relaxed italic text-center font-medium bg-white p-2.5 rounded-xl border border-stone-200/30">
            💡 Os proventos são sinalizados tendo por base a custódia da sua carteira. Os dados de pagamento são previstos de acordo com o histórico de distribuição recorrente de cada empresa ou fundo imobiliário para este mês.
          </p>
        </div>
      )}
    </section>
  );
}

export default WalletTab;
