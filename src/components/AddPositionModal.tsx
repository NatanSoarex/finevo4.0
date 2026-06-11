import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, TrendingUp, TrendingDown, Calendar, Loader2, ShoppingCart, BarChart3 } from "lucide-react";
import { ASSET_TYPE_LABEL, ASSET_TYPE_STYLE, type CatalogAsset } from "../services/assetsCatalog";
import { getHistory, getPriceOnDate, type HistoryPoint, type PriceQuote } from "../services/marketApi";
import { addPosition } from "../services/portfolio";
import { addTransaction } from "../services/transactions";
import { todayISO } from "../services/dateUtils";
import AssetLogo from "./AssetLogo";
import Sparkline from "./Sparkline";
import AssetAnalysis from "./AssetAnalysis";

type Props = {
  open: boolean;
  onClose: () => void;
  asset: CatalogAsset | null;
  quote: PriceQuote | null;
  onSuccess: (msg: string) => void;
};

type Mode = "value" | "quantity";
type Tab = "register" | "analysis";

// IMPORTANTE: usamos `todayISO()` de dateUtils que retorna a data no FUSO LOCAL.
// O Date.toISOString() retorna UTC e causava bug de "dia 1 vira dia 31".

export default function AddPositionModal({ open, onClose, asset, quote, onSuccess }: Props) {
  const [tab, setTab] = useState<Tab>("register");
  const [mode, setMode] = useState<Mode>("value");
  const [date, setDate] = useState(todayISO());
  const [value, setValue] = useState("");
  const [quantity, setQuantity] = useState("");
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [historicalPrice, setHistoricalPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // Reset ao abrir
  useEffect(() => {
    if (!open || !asset) return;
    setTab("register");
    setMode("value");
    setDate(todayISO());
    setValue("");
    setQuantity("");
    setHistoricalPrice(null);
    // Carrega histórico para o mini-gráfico
    getHistory(asset.ticker, 90).then(setHistory).catch(() => setHistory([]));
  }, [open, asset]);

  // Busca preço histórico ao mudar data
  useEffect(() => {
    if (!open || !asset || !date) return;
    setLoadingPrice(true);
    getPriceOnDate(asset.ticker, date)
      .then((p) => setHistoricalPrice(p))
      .catch(() => setHistoricalPrice(quote?.price ?? null))
      .finally(() => setLoadingPrice(false));
  }, [date, asset, open, quote]);

  // Cálculos automáticos
  // REGRA: para ações/FIIs/ETFs/BDRs a quantidade é INTEIRA (não tem como comprar 11,8 ações).
  // Para cripto, permite até 8 casas decimais (frações pequenas existem).
  // O valor investido é SEMPRE recalculado como quantity × preço (bate certinho).
  const calculated = useMemo(() => {
    if (!asset) return null;
    const price = historicalPrice ?? quote?.price ?? 0;
    if (!price) return null;

    // Quantos decimais a quantidade aceita?
    const isCrypto = asset.type === "crypto";
    const roundQty = (q: number) => {
      if (isCrypto) {
        // Cripto: até 8 casas decimais
        return Math.round(q * 1e8) / 1e8;
      }
      // Ações/FIIs/ETFs/BDRs: SEMPRE inteiro (não tem fracionário aqui)
      return Math.floor(q);
    };

    if (mode === "value") {
      const v = parseFloat(value.replace(",", "."));
      if (!v || v <= 0) return null;
      const rawQty = v / price;
      const qty = roundQty(rawQty);
      if (qty <= 0) {
        // Valor insuficiente para comprar 1 unidade
        return { quantity: 0, invested: 0, unitPrice: price, insufficient: true };
      }
      // Valor investido = quantidade × preço (recalcula para bater certinho)
      const invested = Math.round(qty * price * 100) / 100;
      return { quantity: qty, invested, unitPrice: price, insufficient: false };
    } else {
      const q = parseFloat(quantity.replace(",", "."));
      if (!q || q <= 0) return null;
      const qty = roundQty(q);
      if (qty <= 0) return null;
      const invested = Math.round(qty * price * 100) / 100;
      return { quantity: qty, invested, unitPrice: price, insufficient: false };
    }
  }, [mode, value, quantity, historicalPrice, quote, asset]);

  // Variação esperada baseada em cotação atual vs preço histórico
  const expectedReturn = useMemo(() => {
    if (!calculated || !quote || calculated.insufficient) return null;
    const currentValue = calculated.quantity * quote.price;
    const profit = currentValue - calculated.invested;
    const pct = calculated.invested > 0 ? (profit / calculated.invested) * 100 : 0;
    return { currentValue, profit, pct };
  }, [calculated, quote]);

  const handleSubmit = async () => {
    if (!asset || !calculated || calculated.insufficient || submitting) return;
    setSubmitting(true);
    try {
      // quantidade já está corretamente arredondada (inteiro para ações, 8 casas para cripto)
      const qty = calculated.quantity;
      const unitPrice = Math.round(calculated.unitPrice * 100) / 100;
      const total = Math.round(calculated.invested * 100) / 100;

      addPosition({
        ticker: asset.ticker,
        name: asset.name,
        type: asset.type,
        logo: asset.logo,
        purchaseDate: date,
        purchasePrice: unitPrice,
        quantity: qty,
        invested: total,
      });

      // ✅ Registra no histórico de lançamentos
      addTransaction({
        kind: "buy",
        ticker: asset.ticker,
        assetName: asset.name,
        assetType: asset.type,
        assetLogo: asset.logo,
        quantity: qty,
        unitPrice,
        total,
        date,
      });

      onSuccess(`${asset.ticker} adicionado à carteira! 🎉`);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !asset) return null;

  const up = quote ? quote.changePercent >= 0 : true;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-[460px] rounded-t-3xl sm:rounded-3xl bg-stone-50 shadow-2xl animate-slide-up flex flex-col overflow-hidden"
        style={{ height: "85vh", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 w-12 h-1 rounded-full bg-stone-300" />

        {/* === Header Fixo (Garante botão fechar X e cotação 100% visíveis em qualquer dispositivo) === */}
        <div className="px-5 pt-5 pb-4 bg-white border-b border-stone-100 flex items-center justify-between shrink-0 rounded-t-3xl shadow-sm z-30">
          <div className="flex items-center gap-3 pr-4 min-w-0">
            <AssetLogo ticker={asset.ticker} logo={asset.logo} type={asset.type} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-base font-bold text-stone-900 truncate">{asset.ticker}</p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ASSET_TYPE_STYLE[asset.type]}`}>
                  {ASSET_TYPE_LABEL[asset.type]}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 truncate">{asset.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right">
              <p className="text-xs font-bold text-stone-900 leading-tight">
                R$ {quote?.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) ?? "—"}
              </p>

            </div>

            <button
              onClick={onClose}
              className="h-10 w-10 grid place-items-center rounded-full bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-600 border border-stone-200/50 transition shrink-0 shadow-sm"
              aria-label="Fechar"
              id="close-add-position-btn"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TUDO SCROLLÁVEL */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide overscroll-contain">
          {/* Mini gráfico */}
          {history.length > 1 && (
            <div className="px-5 pt-4 pb-1 bg-white">
              <div className="rounded-xl bg-stone-50 p-3">
                <Sparkline
                  data={history.map((h) => h.close)}
                  width={400}
                  height={50}
                  color={up ? "#10b981" : "#f43f5e"}
                  fillColor={up ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)"}
                  className="w-full"
                />
                <p className="text-[10px] text-stone-500 mt-1.5 text-center">Últimos 90 dias</p>
              </div>
            </div>
          )}

          {/* Tabs sticky */}
          <div className="sticky top-0 z-20 px-5 py-3 bg-stone-50/95 backdrop-blur-md border-y border-stone-100">
            <div className="grid grid-cols-2 rounded-2xl bg-white border border-stone-200 p-1 shadow-sm">
              {[
                { id: "register" as Tab, label: "Cadastrar", Icon: ShoppingCart },
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

          {/* Conteúdo das abas */}
          <div className="px-5 py-4 space-y-4">
          {tab === "analysis" && (
            <AssetAnalysis ticker={asset.ticker} assetName={asset.name} />
          )}
          {tab === "register" && (<>
          {/* Data */}
          <div>
            <label className="text-[11px] text-stone-500 mb-1.5 block font-medium flex items-center gap-1">
              <Calendar size={11} /> Data da compra
            </label>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-base text-stone-900 focus:outline-none focus:border-emerald-400 focus:bg-white"
            />
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-stone-500">Preço naquela data:</span>
              <span className="font-semibold text-emerald-700">
                {loadingPrice ? (
                  <Loader2 size={11} className="inline animate-spin" />
                ) : historicalPrice ? (
                  `R$ ${historicalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>

          {/* Mode toggle */}
          <div>
            <label className="text-[11px] text-stone-500 mb-1.5 block font-medium">Como deseja informar?</label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-stone-100">
              {[
                { id: "value", label: "Valor investido" },
                { id: "quantity", label: "Quantidade" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id as Mode)}
                  className={`py-2 rounded-xl text-xs font-semibold transition ${
                    mode === m.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Value input */}
          {mode === "value" ? (
            <div>
              <label className="text-[11px] text-stone-500 mb-1.5 block font-medium">Valor investido</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-base font-medium">R$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-stone-50 border border-stone-200 text-2xl font-semibold text-stone-900 focus:outline-none focus:border-emerald-400 focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[100, 500, 1000, 5000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setValue(String(v))}
                    className="py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-100 transition"
                  >
                    R$ {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[11px] text-stone-500 mb-1.5 block font-medium">
                Quantidade de {asset.type === "fund" ? "cotas" : asset.type === "crypto" ? "unidades" : "ações"}
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-4 rounded-2xl bg-stone-50 border border-stone-200 text-2xl font-semibold text-stone-900 focus:outline-none focus:border-emerald-400 focus:bg-white"
              />
            </div>
          )}

          {/* Aviso: valor insuficiente para comprar 1 unidade */}
          {calculated && calculated.insufficient && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 animate-fade-up">
              ⚠️ <strong>Valor insuficiente.</strong> O preço unitário é R${" "}
              {calculated.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Aumente o valor para comprar pelo menos 1 {asset.type === "fund" ? "cota" : "ação"}.
            </div>
          )}

          {/* Resumo calculado */}
          {calculated && !calculated.insufficient && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2 animate-fade-up">
              <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Resumo do aporte</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600">Quantidade</span>
                <span className="font-bold text-stone-900">
                  {asset.type === "crypto"
                    ? calculated.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })
                    : calculated.quantity.toLocaleString("pt-BR")}{" "}
                  {asset.type === "fund" ? "cotas" : asset.type === "crypto" ? asset.ticker : "ações"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600">Preço unitário</span>
                <span className="font-bold text-stone-900">
                  R$ {calculated.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-emerald-200 pt-2">
                <span className="text-stone-600">Valor investido</span>
                <span className="font-bold text-emerald-700">
                  R$ {calculated.invested.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {/* Aviso quando arredonda para baixo (modo valor) */}
              {mode === "value" && parseFloat(value.replace(",", ".")) - calculated.invested >= 0.01 && (
                <p className="text-[10px] text-stone-500 pt-1">
                  💡 Com R$ {value} dá para comprar exatamente{" "}
                  {calculated.quantity} {asset.type === "fund" ? "cotas" : "ações"}.
                  Sobram R$ {(parseFloat(value.replace(",", ".")) - calculated.invested).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.
                </p>
              )}

              {expectedReturn && quote && expectedReturn.profit !== 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-[10px] text-stone-500 mb-1">Se comprasse na data e mantivesse até hoje:</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">Valor atual</span>
                    <span className="font-bold text-stone-900">
                      R$ {expectedReturn.currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">Lucro/Prejuízo</span>
                    <span className={`font-bold ${expectedReturn.profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      {expectedReturn.profit >= 0 ? "+" : ""}R$ {expectedReturn.profit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}{" "}
                      <span className="text-[10px] font-medium">
                        ({expectedReturn.pct >= 0 ? "+" : ""}{expectedReturn.pct.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          </>)}
          {/* fim do conteúdo das abas */}
          </div>
        </div>
        {/* fim do body scrollável */}

        {/* Footer fixo — só aparece na aba Cadastrar */}
        {tab === "register" && (
          <div className="shrink-0 border-t border-stone-100 bg-white px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="py-3.5 rounded-2xl bg-stone-100 text-sm font-semibold text-stone-700 hover:bg-stone-200 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!calculated || calculated.insufficient || submitting}
                className="py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-500/30"
              >
                {submitting ? "Registrando..." : "✓ Adicionar à carteira"}
              </button>
            </div>
          </div>
        )}
        {tab === "analysis" && (
          <div className="shrink-0 border-t border-stone-100 bg-white px-5 py-4">
            <button
              type="button"
              onClick={() => setTab("register")}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition shadow-md shadow-emerald-500/30"
            >
              ← Voltar para cadastrar aporte
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
