import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, TrendingUp, TrendingDown, Trash2, Calendar, ShoppingCart, Plus,
  BarChart3, LineChart, Loader2,
} from "lucide-react";
import { ASSET_TYPE_LABEL, ASSET_TYPE_STYLE } from "../services/assetsCatalog";
import { getHistory, getPriceOnDate, type HistoryPoint, type PriceQuote } from "../services/marketApi";
import { removePosition, updatePosition, type Position } from "../services/portfolio";
import { addTransaction, removeTransactionsForTicker } from "../services/transactions";
import { todayISO } from "../services/dateUtils";
import AssetLogo from "./AssetLogo";
import InteractiveChart from "./InteractiveChart";
import AssetAnalysis from "./AssetAnalysis";

type Props = {
  open: boolean;
  onClose: () => void;
  position: Position | null;
  quote: PriceQuote | null;
  onRemoved: (msg: string) => void;
  onAddMore?: () => void;
};

type Tab = "overview" | "analysis";

const PERIODS = [
  { id: 30, label: "1M" },
  { id: 90, label: "3M" },
  { id: 180, label: "6M" },
  { id: 365, label: "1A" },
];

export default function PositionDetailModal({ open, onClose, position, quote, onRemoved, onAddMore }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [period, setPeriod] = useState<number>(90);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Estados de venda
  const [isSelling, setIsSelling] = useState(false);
  const [sellDate, setSellDate] = useState(todayISO());
  const [sellMode, setSellMode] = useState<"value" | "quantity">("quantity");
  const [sellValueInput, setSellValueInput] = useState("");
  const [sellQuantityInput, setSellQuantityInput] = useState("");
  const [historicalSellPrice, setHistoricalSellPrice] = useState<number | null>(null);
  const [loadingSellPrice, setLoadingSellPrice] = useState(false);
  const [sellingSubmitting, setSellingSubmitting] = useState(false);

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
    if (!open || !position) return;
    setLoading(true);
    setConfirmDelete(false);
    setIsSelling(false);
    setTab("overview");
    getHistory(position.ticker, period)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [open, position, period]);

  // Busca preço histórico ao mudar data de venda
  useEffect(() => {
    if (!open || !position || !isSelling || !sellDate) return;
    setLoadingSellPrice(true);
    getPriceOnDate(position.ticker, sellDate)
      .then((p) => setHistoricalSellPrice(p))
      .catch(() => setHistoricalSellPrice(quote?.price ?? position.purchasePrice))
      .finally(() => setLoadingSellPrice(false));
  }, [sellDate, position, open, isSelling, quote]);

  // Cálculos automáticos para venda
  const sellCalculated = useMemo(() => {
    if (!position) return null;
    const price = historicalSellPrice ?? quote?.price ?? position.purchasePrice;
    if (!price) return null;

    const isCrypto = position.type === "crypto";
    const roundQty = (q: number) => {
      return isCrypto ? Math.round(q * 1e8) / 1e8 : Math.floor(q);
    };

    if (sellMode === "value") {
      const v = parseFloat(sellValueInput.replace(",", "."));
      if (!v || v <= 0) return null;
      const qty = roundQty(v / price);
      if (qty <= 0) {
        return { quantity: 0, total: 0, unitPrice: price, exceeds: false };
      }
      const total = Math.round(qty * price * 100) / 100;
      const exceeds = qty > position.quantity;
      return { quantity: qty, total, unitPrice: price, exceeds };
    } else {
      const q = parseFloat(sellQuantityInput.replace(",", "."));
      if (!q || q <= 0) return null;
      const qty = roundQty(q);
      if (qty <= 0) return null;
      const total = Math.round(qty * price * 100) / 100;
      const exceeds = qty > position.quantity;
      return { quantity: qty, total, unitPrice: price, exceeds };
    }
  }, [sellMode, sellValueInput, sellQuantityInput, historicalSellPrice, quote, position]);

  if (!open || !position) return null;

  const currentPrice = quote?.price ?? position.purchasePrice;
  // Arredonda para 2 casas (corrige erros de ponto flutuante)
  const rawValue = position.quantity * currentPrice;
  const currentValue = Math.round(rawValue * 100) / 100;
  // Considera "sem variação" se diferença < 1 centavo (evita lucro fantasma)
  const rawProfit = currentValue - position.invested;
  const profit = Math.abs(rawProfit) < 0.02 ? 0 : Math.round(rawProfit * 100) / 100;
  const profitPct = position.invested > 0 ? (profit / position.invested) * 100 : 0;
  const positive = profit >= 0;
  // Só mostra variação do dia se quote real retornou valor não-zero
  const hasRealDayChange = quote && quote.changePercent !== 0;
  const dayUp = quote ? quote.changePercent >= 0 : true;

  const daysSince = Math.max(
    1,
    Math.floor((Date.now() - new Date(position.purchaseDate).getTime()) / 86400000)
  );

  const handleDelete = () => {
    // ⚠️ REQUISITO: "Quando eu vou remover um ativo, não pode entrar como venda não viu, se eu remove tem que sumir apenas"
    // REMOÇÃO DIRETA E SILENCIOSA sem cadastrar nova transação de venda!
    removeTransactionsForTicker(position.ticker);
    removePosition(position.id);
    onRemoved(`${position.ticker} removido com sucesso`);
    onClose();
  };

  const handleConfirmSell = async () => {
    if (!position || !sellCalculated || sellCalculated.exceeds || sellCalculated.quantity <= 0 || sellingSubmitting) return;
    setSellingSubmitting(true);
    try {
      const qtySold = sellCalculated.quantity;
      const sellPrice = sellCalculated.unitPrice;
      const totalReceived = sellCalculated.total;

      // Adiciona transação de venda para manter o histórico correto
      addTransaction({
        kind: "sell",
        ticker: position.ticker,
        assetName: position.name,
        assetType: position.type,
        assetLogo: position.logo,
        quantity: qtySold,
        unitPrice: sellPrice,
        total: totalReceived,
        date: sellDate,
        note: Math.abs(position.quantity - qtySold) < 1e-6 ? "Posição encerrada via venda" : "Venda parcial",
      });

      if (Math.abs(position.quantity - qtySold) < 1e-6) {
        // Vendeu tudo -> remove do portfólio
        removePosition(position.id);
        onRemoved(`Toda a posição em ${position.ticker} foi vendida! 📉`);
      } else {
        // Venda parcial -> reduz quantidade e valor investido de forma proporcional
        const newQty = position.quantity - qtySold;
        const newInvested = Math.max(0, Math.round(position.invested * (newQty / position.quantity) * 100) / 100);
        updatePosition(position.id, {
          quantity: newQty,
          invested: newInvested,
        });
        onRemoved(`Venda de ${qtySold.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} de ${position.ticker} registrada! 📉`);
      }
      onClose();
    } finally {
      setSellingSubmitting(false);
      setIsSelling(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-[460px] rounded-t-3xl sm:rounded-3xl bg-stone-50 shadow-2xl animate-slide-up flex flex-col overflow-hidden"
        style={{ height: "85vh", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* === Indicador de arrastar (drag handle) === */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 w-12 h-1 rounded-full bg-stone-300" />

        {/* === Header Fixo (Garante botão fechar X e cotação 100% visíveis em qualquer dispositivo) === */}
        <div className="px-5 pt-5 pb-4 bg-white border-b border-stone-100 flex items-center justify-between shrink-0 rounded-t-3xl shadow-sm z-30">
          <div className="flex items-center gap-3 pr-4 min-w-0">
            <AssetLogo ticker={position.ticker} logo={position.logo} type={position.type} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-base font-bold text-stone-900 truncate">{position.ticker}</p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ASSET_TYPE_STYLE[position.type]}`}>
                  {ASSET_TYPE_LABEL[position.type]}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 truncate">{position.name}</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="h-10 w-10 grid place-items-center rounded-full bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-600 border border-stone-200/50 transition shrink-0 shadow-sm"
            aria-label="Fechar"
            id="close-asset-detail-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* === TUDO SCROLLÁVEL === */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide overscroll-contain">
          {/* Hero — valor atual (rola junto) */}
          <div className="px-5 pt-4 pb-4 bg-white">
            <div className={`rounded-2xl p-4 ${positive ? "bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200" : "bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200"}`}>
              <p className="text-[10px] text-stone-500 uppercase tracking-wider font-medium">Valor atual</p>
              <p className="text-2xl font-bold text-stone-900 mt-0.5">
                R$ {currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              {/* Só mostra lucro/% se houver variação real */}
              {profit !== 0 ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${positive ? "text-emerald-700" : "text-rose-700"}`}>
                    {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {positive ? "+" : ""}R$ {Math.abs(profit).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`text-xs font-semibold ${positive ? "text-emerald-700" : "text-rose-700"}`}>
                    ({positive ? "+" : ""}{profitPct.toFixed(2)}%)
                  </span>
                </div>
              ) : (
                <p className="text-xs text-stone-500 mt-1.5">
                  Sem variação ainda
                </p>
              )}

            </div>
          </div>

          {/* Tabs STICKY — gruda no topo ao rolar, mas começam no body */}
          {!isSelling && (
            <div className="sticky top-0 z-20 px-5 py-3 bg-stone-50/95 backdrop-blur-md border-b border-stone-100">
              <div className="grid grid-cols-2 rounded-2xl bg-white border border-stone-200 p-1 shadow-sm">
                {[
                  { id: "overview" as Tab, label: "Visão geral", Icon: LineChart },
                  { id: "analysis" as Tab, label: "Análise", Icon: BarChart3 },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition ${
                      tab === t.id ? "bg-emerald-500 text-white shadow-sm" : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    <t.Icon size={12} /> {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conteúdo das abas ou form de venda */}
          <div className="px-5 py-4 space-y-4">
          {isSelling ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingDown size={14} /> Registrar Venda (Vender)
                </h4>
                <button
                  type="button"
                  onClick={() => setIsSelling(false)}
                  className="text-[10px] font-bold text-stone-500 hover:text-stone-700 bg-stone-100 px-2 py-1 rounded-lg transition"
                >
                  ← Voltar
                </button>
              </div>

              {/* Data da venda */}
              <div>
                <label className="text-[11px] text-stone-500 mb-1.5 block font-medium flex items-center gap-1">
                  <Calendar size={11} /> Data da venda
                </label>
                <input
                  type="date"
                  value={sellDate}
                  max={todayISO()}
                  onChange={(e) => setSellDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-stone-200 text-base text-stone-900 focus:outline-none focus:border-amber-400 font-bold"
                />
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-stone-500">Preço na data selecionada:</span>
                  <span className="font-bold text-amber-700">
                    {loadingSellPrice ? (
                      <Loader2 size={11} className="inline animate-spin" />
                    ) : historicalSellPrice ? (
                      `R$ ${historicalSellPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>

              {/* Mode toggle para venda */}
              <div>
                <label className="text-[11px] text-stone-500 mb-1.5 block font-medium">Como deseja informar?</label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-stone-100">
                  {[
                    { id: "value", label: "Valor recebido" },
                    { id: "quantity", label: "Quantidade" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSellMode(m.id as "value" | "quantity")}
                      className={`py-2 rounded-xl text-xs font-semibold transition ${
                        sellMode === m.id ? "bg-white text-stone-900 shadow-sm font-bold" : "text-stone-500"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inputs para venda */}
              {sellMode === "value" ? (
                <div>
                  <label className="text-[11px] text-stone-500 mb-1.5 block font-medium">Valor recebido</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-base font-semibold">R$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={sellValueInput}
                      onChange={(e) => setSellValueInput(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-stone-200 text-2xl font-bold text-stone-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {[100, 500, 1000, 5000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSellValueInput(String(v))}
                        className="py-2 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                      >
                        R$ {v >= 1000 ? `${v / 1000}k` : v}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] text-stone-500 mb-1.5 block font-medium">
                    Quantidade a vender (Você possui {position.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })})
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={sellQuantityInput}
                    onChange={(e) => setSellQuantityInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-4 rounded-2xl bg-white border border-stone-200 text-2xl font-bold text-stone-900 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setSellQuantityInput(String(position.quantity))}
                    className="mt-1.5 text-[10px] text-rose-600 font-bold hover:underline tracking-wide bg-rose-50 px-2 py-1 rounded-md"
                  >
                    Vender posição inteira ({position.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })})
                  </button>
                </div>
              )}

              {/* Detalhes do cálculo de venda */}
              {sellCalculated && sellCalculated.exceeds && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-bold animate-fade-up">
                  ⚠️ Quantidade insuficiente. Você possui apenas {position.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} unidades.
                </div>
              )}

              {sellCalculated && !sellCalculated.exceeds && sellCalculated.quantity > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2 animate-fade-up">
                  <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider font-mono">Resumo da venda</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">Quantidade vendida</span>
                    <span className="font-bold text-stone-900">
                      {position.type === "crypto"
                        ? sellCalculated.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })
                        : sellCalculated.quantity.toLocaleString("pt-BR")}{" "}
                      {position.type === "fund" ? "cotas" : position.type === "crypto" ? position.ticker : "ações"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">Preço de venda</span>
                    <span className="font-bold text-stone-900">
                      R$ {sellCalculated.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t border-amber-200 pt-2">
                    <span className="text-stone-600">Total a receber</span>
                    <span className="font-bold text-amber-700">
                      R$ {sellCalculated.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {Math.abs(position.quantity - sellCalculated.quantity) < 1e-6 && (
                    <p className="text-[10px] text-amber-800 font-bold pt-1">
                      📉 Obs: Essa operação zerará e removerá o ativo automaticamente.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <>
                  {/* Period selector */}
                  <div className="flex items-center gap-1.5">
                    {PERIODS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPeriod(p.id)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${
                          period === p.id
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Chart interativo */}
                  <div className="rounded-2xl bg-gradient-to-br from-white to-stone-50 border border-stone-200 p-4">
                    {loading ? (
                      <div className="h-36 flex items-center justify-center">
                        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : history.length > 1 ? (
                      <>
                        <InteractiveChart data={history} height={140} color="#10b981" />
                        <p className="text-[10px] text-stone-400 text-center mt-2">
                          👆 Deslize o dedo no gráfico para ver os valores
                        </p>
                      </>
                    ) : (
                      <p className="text-center text-sm text-stone-400 py-8">Sem dados históricos</p>
                    )}
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <InfoCard label="Quantidade" value={position.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} />
                    <InfoCard label="Preço médio" value={`R$ ${position.purchasePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    <InfoCard label="Valor investido" value={`R$ ${position.invested.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    <InfoCard label="Preço atual" value={`R$ ${currentPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  </div>

                  {/* Purchase info */}
                  <div className="rounded-2xl bg-white border border-stone-200 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-stone-600">
                      <Calendar size={12} className="text-stone-400" />
                      <span>Investidor desde:</span>
                      <span className="ml-auto font-semibold text-stone-900">
                        {position.purchaseDate.split("-").reverse().join("/")} ({daysSince}d)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-600">
                      <ShoppingCart size={12} className="text-stone-400" />
                      <span>Total investido:</span>
                      <span className="ml-auto font-semibold text-stone-900">
                        R$ {position.invested.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {tab === "analysis" && (
                <AssetAnalysis ticker={position.ticker} assetName={position.name} />
              )}

              {/* Confirmação de exclusão */}
              {confirmDelete && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 space-y-2 animate-fade-up">
                  <p className="text-xs text-rose-800 font-medium">⚠️ Tem certeza? Esta ação removerá o ativo silenciosamente sem cadastrar uma venda.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="py-2.5 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDelete}
                      className="py-2.5 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition shadow-sm"
                    >
                      Sim, remover
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
          {/* fim do conteúdo das abas */}
        </div>
        {/* fim do body scrollável */}

        {/* Footer */}
        {!confirmDelete && !isSelling && (
          <div className="shrink-0 border-t border-stone-100 bg-white px-5 py-4">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition active:scale-95"
              >
                <Trash2 size={15} />
                <span className="text-[10px] font-bold">Remover</span>
              </button>
              <button
                onClick={() => {
                  setIsSelling(true);
                  setSellDate(todayISO());
                  setSellValueInput("");
                  setSellQuantityInput("");
                }}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 hover:bg-amber-100 transition active:scale-95"
              >
                <TrendingDown size={15} />
                <span className="text-[10px] font-bold">Vender</span>
              </button>
              <button
                onClick={() => { onClose(); onAddMore?.(); }}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 transition shadow-md shadow-emerald-500/20 active:scale-95"
              >
                <Plus size={15} />
                <span className="text-[10px] font-bold">Aportar mais</span>
              </button>
            </div>
          </div>
        )}

        {isSelling && (
          <div className="shrink-0 border-t border-stone-100 bg-white px-5 py-4 mt-auto">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsSelling(false)}
                className="py-3.5 rounded-2xl bg-stone-100 text-xs font-bold text-stone-700 hover:bg-stone-200 transition"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmSell}
                disabled={!sellCalculated || sellCalculated.exceeds || sellCalculated.quantity <= 0 || sellingSubmitting}
                className="py-3.5 rounded-2xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20"
              >
                {sellingSubmitting ? "Gravando..." : "Confirmar Venda 📉"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white border border-stone-200 p-3">
      <p className="text-[10px] text-stone-500 font-medium">{label}</p>
      <p className="text-sm font-semibold text-stone-900 mt-0.5">{value}</p>
    </div>
  );
}
