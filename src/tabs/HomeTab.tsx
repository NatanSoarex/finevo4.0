import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Wallet, TrendingUp, TrendingDown,
  CheckCircle2, X, Plus, Trash2, PiggyBank,
  SlidersHorizontal, ChevronDown, LifeBuoy,
  Calendar, DollarSign, BarChart3, Shield
} from "lucide-react";
import SupportModal from "../components/SupportModal";
import Progress from "../components/Progress";
import { usePortfolio, seedDemoIfEmpty } from "../services/portfolio";
import { getHistory, getQuote, getCachedQuotes, getCachedHistories, type HistoryPoint, type PriceQuote } from "../services/marketApi";
import { getPortfolioValueAt } from "../services/valueCalc";
import { useTransactions } from "../services/transactions";
import { localTs, todayISO, hasClosedTradingDayInMonth, shouldShowInEvolutionChart } from "../services/dateUtils";
import { useAuth } from "../services/auth";
import {
  useGoals, addGoal as addGoalService, removeGoal as removeGoalService,
  updateGoalTarget as updateGoalTargetService,
  GOAL_CATEGORIES, type GoalCategory,
} from "../services/goals";
import { seedXpIfEmpty } from "../services/gamification";

interface PortfolioHistoryPoint {
  date: string;
  close: number;
  aplicado: number;
  ganho: number;
}

const periods = [
  { id: 30, label: "1M" },
  { id: 90, label: "3M" },
  { id: 180, label: "6M" },
  { id: 365, label: "1A" },
  { id: 1825, label: "MÁX" },
];
const GOAL_KEYS: GoalCategory[] = ["money", "stock", "fund", "etf", "crypto"];
const GOAL_SHORT_LABELS: Record<GoalCategory, string> = {
  money: "Geral 💰",
  stock: "Ações 📈",
  fund: "FIIs 🏢",
  etf: "ETFs 📊",
  crypto: "Cripto ₿",
};

const HomeTab = memo(function HomeTab() {
  // === USUÁRIO ATUAL ===
  const { user } = useAuth();
  const firstName = user?.username?.split(/[\s._]/)[0] || "investidor";
  const isAdmin = user?.usernameLower === "adm_evo";

  // === DADOS REAIS DO PORTFOLIO ===
  const positions = usePortfolio();
  const { transactions } = useTransactions();
  const [quotes, setQuotes] = useState<Record<string, PriceQuote>>(() => getCachedQuotes());
  const [histories, setHistories] = useState<Record<string, HistoryPoint[]>>(() => getCachedHistories());

  useEffect(() => {
    seedDemoIfEmpty();
    seedXpIfEmpty();
  }, []);

  // Loading do gráfico — aparece enquanto carrega os dados
  const [loadingChart, setLoadingChart] = useState(false);

  // Carrega cotações + histórico de cada ativo
  // Hash baseado nos tickers, datas de compra e quantidades para detectar adições, edições ou mudanças de datas
  const positionsTickersKey = positions.map((p) => `${p.ticker}_${p.purchaseDate}_${p.quantity}`).sort().join(",");
  useEffect(() => {
    if (positions.length === 0) {
      setLoadingChart(false);
      return;
    }
    
    const tickers: string[] = Array.from(new Set(positions.map((p) => p.ticker)));
    
    // Verifica cache para evitar flash de "loading..." se os dados já estiverem disponíveis
    const cachedQuotes = getCachedQuotes();
    const cachedHistories = getCachedHistories();
    const allCached = tickers.every((t) => cachedQuotes[t] !== undefined && cachedHistories[t] !== undefined);
    
    if (!allCached) {
      setLoadingChart(true);
    } else {
      setLoadingChart(false);
    }

    let cancelled = false;

    const oldestPurchaseTs = positions.length > 0
      ? Math.min(...positions.map((p) => localTs(p.purchaseDate)))
      : Date.now();
    const daysSinceOldest = Math.ceil((Date.now() - oldestPurchaseTs) / 86400000);
    const fetchDays = Math.max(365, daysSinceOldest + 30);

    // Carrega tudo de forma independente e progressiva
    const run = async () => {
      const qPromises = tickers.map((t) =>
        getQuote(t)
          .then((q) => {
            if (!cancelled) setQuotes((prev) => ({ ...prev, [t]: q }));
          })
          .catch(() => {
            if (!cancelled) {
              const purchasePrice = positions.find((p) => p.ticker === t)?.purchasePrice ?? 0;
              setQuotes((prev) => {
                if (prev[t] && prev[t].price > 0) return prev; // Mantém a que já existia
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
            }
          })
      );
      const hPromises = tickers.map((t) =>
        getHistory(t, fetchDays)
          .then((h) => {
            if (!cancelled) setHistories((prev) => ({ ...prev, [t]: h }));
          })
          .catch(() => {
            if (!cancelled) setHistories((prev) => ({ ...prev, [t]: [] }));
          })
      );

      // Desliga o spinner assim que as informações chave terminarem
      await Promise.allSettled([...qPromises, ...hPromises]);
      if (!cancelled) setLoadingChart(false);
    };

    // Safety: força sair do loading rápido se nada travar
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setLoadingChart(false);
    }, 4000);

    run();

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsTickersKey]);

  // Cálculos agregados em tempo real
  const portfolioSummary = useMemo(() => {
    let totalInvested = 0;
    let totalCurrent = 0;
    let totalDayChange = 0;
    for (const p of positions) {
      const q = quotes[p.ticker];
      const price = q?.price ?? p.purchasePrice;
      totalInvested += p.invested;
      totalCurrent += price * p.quantity;
      if (q) totalDayChange += q.change * p.quantity;
    }
    const profit = totalCurrent - totalInvested;
    const profitPct = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
    return { totalInvested, totalCurrent, profit, profitPct, totalDayChange };
  }, [positions, quotes]);

  // Mês atual: aportes e rendimentos
  // - aportesMes: soma de TODAS as transações tipo "buy" do mês atual
  // - rendimentoMes: só aparece se já houve pelo menos UM pregão útil fechado
  //   no mês corrente (regra: B3 fecha às 18h em dias úteis).
  const monthStats = useMemo(() => {
    const now = new Date();
    const firstDayMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const todayMs = Date.now();
    const podeMostrarRendimento = hasClosedTradingDayInMonth(now);

    // 1) APORTES DO MÊS — soma das transações "buy" do mês corrente
    // Usa parser de data LOCAL (não UTC) para evitar bug do "31/05 vira 01/06" reverso
    const aportesMes = transactions
      .filter((t) => {
        if (t.kind !== "buy") return false;
        const ts = localTs(t.date);
        return ts >= firstDayMs && ts <= todayMs;
      })
      .reduce((sum, t) => sum + t.total, 0);

    // 2) RENDIMENTO DO MÊS
    // Regras:
    //   - Dia 1: sempre 0 (sem fechamento no novo mês)
    //   - Dia útil mas mercado ainda aberto: 0 (esperando fechar)
    //   - Sábado/domingo no início do mês: 0 (vai contar quando seg fechar)
    //   - Depois do primeiro pregão fechado do mês: variação real
    let rendimentoMes = 0;
    if (podeMostrarRendimento) {
      const { value: initialValue } = getPortfolioValueAt(positions, firstDayMs, histories, quotes, transactions);
      const { value: currentValue } = getPortfolioValueAt(positions, todayMs, histories, quotes, transactions);

      const segmentTx = transactions.filter((t) => {
        const ts = localTs(t.date);
        return ts >= firstDayMs && ts <= todayMs;
      });

      const buys = segmentTx.filter((t) => t.kind === "buy").reduce((sum, t) => sum + t.total, 0);
      const sells = segmentTx.filter((t) => t.kind === "sell").reduce((sum, t) => sum + t.total, 0);
      const contributions = buys - sells;

      const dividends = segmentTx.filter((t) => t.kind === "dividend").reduce((sum, t) => sum + t.total, 0);

      rendimentoMes = currentValue - initialValue - contributions + dividends;
    }

    return { aportesMes, rendimentoMes };
  }, [positions, quotes, histories, transactions]);
  // === DADOS DO GRÁFICO DIÁRIO REAL ===
  const [period, setPeriod] = useState(90);

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

    // Janela de exibição baseado no período selecionado
    const cutoffTs = Date.now() - period * 86400000;
    const todayKey = todayISO();

    let datesInWindow = sortedAll.filter((date) => localTs(date) >= cutoffTs);

    // Garante o ponto "hoje" como último ponto exato
    if (!datesInWindow.includes(todayKey)) datesInWindow.push(todayKey);

    // Se a janela ficou muito pequena, adiciona os últimos pontos
    if (datesInWindow.length < 2) {
      datesInWindow = sortedAll.slice(-Math.min(30, sortedAll.length));
      if (!datesInWindow.includes(todayKey)) datesInWindow.push(todayKey);
    }

    const resPoints = datesInWindow
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

    if (resPoints.length === 1) {
      const single = resPoints[0];
      const prev = new Date(single.date);
      prev.setDate(prev.getDate() - 1);
      const prevISO = prev.toISOString().split("T")[0];
      return [
        {
          date: prevISO,
          close: single.close,
          aplicado: single.aplicado,
          ganho: 0,
        },
        single,
      ];
    }
    return resPoints;
  }, [positions, histories, quotes, period, transactions]);

  // === SISTEMA DE METAS NOVO (por categoria, sincronizado de forma inline) ===
  const { goals } = useGoals();
  const [selectedGoalCat, setSelectedGoalCat] = useState<GoalCategory>("money");
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [inlineGoalTargetInput, setInlineGoalTargetInput] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);

  const [toast, setToast] = useState<{ text: string; xp?: number; type?: "ok" | "miss" } | null>(null);

  const showToast = (text: string, xp?: number, type: "ok" | "miss" = "ok") => {
    setToast({ text, xp, type });
    window.setTimeout(() => setToast(null), 2200);
  };

  const activeGoal = useMemo(() => {
    return goals.find((g) => g.category === selectedGoalCat);
  }, [goals, selectedGoalCat]);

  useEffect(() => {
    if (activeGoal) {
      setInlineGoalTargetInput(String(activeGoal.target));
    } else {
      setInlineGoalTargetInput("");
    }
    setIsEditingGoal(false);
  }, [selectedGoalCat, activeGoal]);

  const handleSaveInlineGoal = () => {
    const val = parseFloat(inlineGoalTargetInput.replace(",", "."));
    if (!val || val <= 0) {
      showToast("Por favor, digite um valor válido", undefined, "miss");
      return;
    }
    if (activeGoal) {
      updateGoalTargetService(activeGoal.id, val);
      showToast(`Meta de ${GOAL_CATEGORIES[selectedGoalCat].label} atualizada! 📈`, undefined, "ok");
    } else {
      const g = addGoalService(selectedGoalCat, val);
      if (g) {
        showToast(`Meta de ${GOAL_CATEGORIES[selectedGoalCat].label} criada! 🎯`, undefined, "ok");
      } else {
        showToast("Erro ao criar meta", undefined, "miss");
      }
    }
    setIsEditingGoal(false);
  };

  const handleRemoveInlineGoal = () => {
    if (activeGoal) {
      removeGoalService(activeGoal.id);
      showToast("Meta removida", undefined, "miss");
    }
    setIsEditingGoal(false);
    setInlineGoalTargetInput("");
  };

  return (
    <div className="px-5 pt-8 pb-6 space-y-6">
      {/* Toast via portal */}
      {toast && createPortal(
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-slide-up">
          <div className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 backdrop-blur-xl shadow-lg ${
            toast.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-white border-stone-200 text-stone-700"
          }`}>
            {toast.type === "ok" ? <CheckCircle2 size={16} /> : <X size={16} />}
            <span className="text-xs font-medium">{toast.text}</span>
            {toast.xp && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">+{toast.xp} XP</span>}
          </div>
        </div>,
        document.body
      )}



      {/* Header com botão de suporte */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-500">Olá, {firstName} 👋</p>
          <h1 className="text-xl font-semibold tracking-tight mt-0.5 text-stone-900">Pronto para evoluir hoje?</h1>
        </div>
        <button
          onClick={() => setSupportOpen(true)}
          className={`h-11 w-11 grid place-items-center rounded-2xl bg-white border transition shadow-sm active:scale-95 ${
            isAdmin
              ? "text-rose-600 border-rose-200 hover:bg-rose-50"
              : "border-stone-200 hover:bg-stone-50 text-emerald-600"
          }`}
          title={isAdmin ? "Painel do Admin" : "Suporte"}
          aria-label={isAdmin ? "Abrir Painel do Admin" : "Abrir suporte"}
        >
          {isAdmin ? <Shield size={20} /> : <LifeBuoy size={20} />}
        </button>
      </header>

      {/* Modal de Suporte */}
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />

      {/* Balance card - hero com dados REAIS do portfolio */}
      {(() => {
        const isProfitPositive = portfolioSummary.profit >= 0;
        const profitBadgeClass = isProfitPositive
          ? "bg-white/20 border border-white/30 text-white"
          : "bg-rose-500/25 border border-rose-450/30 text-rose-100";
        const isRendimentoPositive = monthStats.rendimentoMes >= 0;
        const decimalPlacesAportes = monthStats.aportesMes % 1 === 0 ? 0 : 2;
        const decimalPlacesRendimento = monthStats.rendimentoMes % 1 === 0 ? 0 : 2;

        return (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-600 p-5.5 shadow-lg shadow-emerald-500/15 border border-emerald-400/20">
            {/* Elegant glass blur circles for luxury depth design */}
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -bottom-24 -left-12 w-56 h-56 rounded-full bg-teal-300/25 blur-3xl" />
            <div className="relative text-white">
              <div className="flex items-center gap-1.5 text-xs text-white/85 font-medium tracking-wide">
                <Wallet size={13} className="text-emerald-100" />
                <span>Patrimônio total</span>
              </div>
              
              <div className="mt-2.5 flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight whitespace-nowrap font-sans">
                  R$ {portfolioSummary.totalCurrent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <span className={`inline-flex items-center gap-0.5 text-xs font-bold rounded-full px-2.5 py-0.5 shrink-0 backdrop-blur-md transition-all ${profitBadgeClass}`}>
                  {isProfitPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {isProfitPositive ? "+" : ""}{portfolioSummary.profitPct.toFixed(2)}%
                </span>
              </div>

              <p className="text-[11px] sm:text-xs text-white/85 mt-2 flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isProfitPositive ? "bg-emerald-300" : "bg-rose-400"}`} />
                <span>
                  {isProfitPositive ? "+R$ " : "-R$ "}{Math.abs(portfolioSummary.profit).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de {isProfitPositive ? "lucro total" : "prejuízo total"}
                </span>
              </p>


            </div>
          </section>
        );
      })()}



      {/* Metas Financeiras (Inline & Compacto) */}
      <section className="bg-stone-50/50 rounded-3xl p-4 border border-stone-200">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-stone-900">Metas por Categoria 🎯</h3>
          <p className="text-[11px] text-stone-500 mt-0.5">Acompanhe e ajuste o progresso de seus aportes ao clicar em cada ativo</p>
        </div>

        {/* Category selector capsules */}
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide -mx-1 px-1">
          {GOAL_KEYS.map((cat) => {
            const isSelected = selectedGoalCat === cat;
            const info = GOAL_CATEGORIES[cat];
            const hasGoal = goals.some((g) => g.category === cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedGoalCat(cat)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                  isSelected
                    ? `${info.bgSoft} ${info.textColor} shadow-sm border border-emerald-100 ring-2 ring-emerald-500/10`
                    : "border border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                }`}
              >
                <span>{GOAL_SHORT_LABELS[cat]}</span>
                {hasGoal && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {activeGoal && !isEditingGoal ? (
          <div className={`mt-3.5 rounded-3xl border p-4 shadow-sm bg-white hover:border-stone-300 transition duration-300 ${activeGoal.completed ? "border-emerald-250 bg-emerald-50/10" : GOAL_CATEGORIES[selectedGoalCat].borderColor}`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <span className={`h-10 w-10 grid place-items-center rounded-xl text-xl ${GOAL_CATEGORIES[selectedGoalCat].bgSoft}`}>
                  {GOAL_CATEGORIES[selectedGoalCat].icon}
                </span>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-bold text-stone-900">{GOAL_CATEGORIES[selectedGoalCat].label}</h4>
                    {activeGoal.completed && (
                      <span className="text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">
                        Concluída ✓
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-0.5">
                    R$ {activeGoal.current.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {activeGoal.target.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(true)}
                  className="h-8 px-2.5 text-[10px] font-bold rounded-lg border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 transition active:scale-95"
                >
                  Ajustar
                </button>
                <button
                  type="button"
                  onClick={handleRemoveInlineGoal}
                  className="h-8 w-8 grid place-items-center rounded-lg border border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition active:scale-95"
                  title="Remover meta"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div className="mt-4">
              <Progress value={activeGoal.progress} animated={false} />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px]">
              <span className={`font-bold ${GOAL_CATEGORIES[selectedGoalCat].textColor}`}>
                {activeGoal.progress.toFixed(1)}% completo
              </span>
              {!activeGoal.completed && (
                <span className="text-stone-500">
                  Falta <strong className="text-stone-800 font-semibold">R$ {Math.max(0, activeGoal.target - activeGoal.current).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3.5 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm transition-all duration-300">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <span>{isEditingGoal ? "Ajustar meta de" : "Definir meta para"} {GOAL_CATEGORIES[selectedGoalCat].label}</span>
                  <span className="text-sm">{GOAL_CATEGORIES[selectedGoalCat].icon}</span>
                </h4>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  {GOAL_CATEGORIES[selectedGoalCat].description}
                </p>
              </div>
              {isEditingGoal && (
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(false)}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg text-stone-500 hover:bg-stone-100 transition shrink-0"
                >
                  Cancelar
                </button>
              )}
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">R$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={inlineGoalTargetInput}
                    onChange={(e) => setInlineGoalTargetInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-base font-bold text-stone-900 focus:outline-none focus:border-emerald-400 focus:bg-white transition"
                  />
                </div>

                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[1000, 5000, 10000, 50000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setInlineGoalTargetInput(String(v))}
                      className="py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-[10px] font-bold text-stone-600 hover:bg-stone-100 transition active:scale-95"
                    >
                      R$ {v >= 1000 ? `${v / 1000}k` : v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveInlineGoal}
                  disabled={!inlineGoalTargetInput || parseFloat(inlineGoalTargetInput) <= 0}
                  className="flex-1 py-2 py-2.5 rounded-xl bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 disabled:opacity-40 transition shadow-sm active:scale-95"
                >
                  ✓ Salvar objetivo
                </button>
                {isEditingGoal && (
                  <button
                    type="button"
                    onClick={handleRemoveInlineGoal}
                    className="px-3 rounded-xl border border-rose-150 text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition active:scale-95"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
});

export default HomeTab;
