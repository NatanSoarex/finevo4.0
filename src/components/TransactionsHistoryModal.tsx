import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, ArrowDownLeft, ArrowUpRight, TrendingUp, Search, Filter, Trash2,
  History, Calendar,
} from "lucide-react";
import { useTransactions, removeTransaction, type Transaction, type TransactionKind } from "../services/transactions";
import { ASSET_TYPE_LABEL, ASSET_TYPE_STYLE } from "../services/assetsCatalog";
import { parseLocalDate, formatBR } from "../services/dateUtils";
import AssetLogo from "./AssetLogo";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Filter = "all" | TransactionKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "buy", label: "Aportes" },
  { id: "sell", label: "Vendas" },
];

const kindIcon = (k: TransactionKind) => {
  if (k === "buy") return ArrowUpRight;
  if (k === "sell") return ArrowDownLeft;
  return TrendingUp;
};

const kindStyle = (k: TransactionKind) => {
  if (k === "buy") return "bg-emerald-100 text-emerald-600";
  if (k === "sell") return "bg-rose-100 text-rose-600";
  return "bg-sky-100 text-sky-600";
};

const kindLabel = (k: TransactionKind) => {
  if (k === "buy") return "Aporte";
  if (k === "sell") return "Venda";
  return "Dividendo";
};

export default function TransactionsHistoryModal({ open, onClose }: Props) {
  const { transactions } = useTransactions();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    let list = transactions;
    if (filter !== "all") list = list.filter((t) => t.kind === filter);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.ticker.toLowerCase().includes(q) ||
          t.assetName.toLowerCase().includes(q)
      );
    }
    return list.slice().sort((a, b) => b.ts - a.ts);
  }, [transactions, filter, search]);

  // Agrupa por mês para exibição
  const grouped = useMemo(() => {
    const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const groups: Record<string, Transaction[]> = {};
    for (const tx of filtered) {
      const d = parseLocalDate(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }
    return Object.entries(groups)
      .sort((a, b) => (a[0] > b[0] ? -1 : 1))
      .map(([key, items]) => {
        const [y, m] = key.split("-");
        const label = `${monthNames[Number(m) - 1].toUpperCase()}. DE ${y}`;
        const totalIn = items.filter((t) => t.kind === "buy").reduce((s, t) => s + t.total, 0);
        const totalOut = items.filter((t) => t.kind === "sell").reduce((s, t) => s + t.total, 0);
        return { monthKey: key, monthLabel: label, items, totalIn, totalOut };
      });
  }, [filtered]);

  // Totais gerais para o resumo
  const totals = useMemo(() => {
    const buys = transactions.filter((t) => t.kind === "buy").reduce((s, t) => s + t.total, 0);
    const sells = transactions.filter((t) => t.kind === "sell").reduce((s, t) => s + t.total, 0);
    return { buys, sells, count: transactions.length };
  }, [transactions]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-[460px] rounded-t-3xl sm:rounded-3xl bg-stone-50 shadow-2xl animate-slide-up flex flex-col overflow-hidden animate-duration-300"
        style={{ height: "85dvh", maxHeight: "85dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-3 border-b border-stone-100 bg-white">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-10 w-10 grid place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
                <History size={20} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-stone-900">Histórico</h3>
                <p className="text-[11px] text-stone-500">{totals.count} lançamento{totals.count !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Resumo geral */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5">
              <p className="text-[9px] text-emerald-700 font-semibold uppercase">Aportes</p>
              <p className="text-xs font-bold text-stone-900 mt-0.5 truncate">
                R$ {totals.buys.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5">
              <p className="text-[9px] text-rose-700 font-semibold uppercase">Vendas</p>
              <p className="text-xs font-bold text-stone-900 mt-0.5 truncate">
                R$ {totals.sells.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ticker ou nome..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-base placeholder:text-stone-400 text-stone-900 focus:outline-none focus:border-emerald-400 focus:bg-white"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {FILTERS.map((f) => (
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

        {/* Body — lista agrupada por mês */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-5 py-4 space-y-5">
          {grouped.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-stone-100 mb-3">
                <Filter size={28} className="text-stone-300" />
              </div>
              <p className="text-sm font-semibold text-stone-700">Nenhum lançamento encontrado</p>
              <p className="text-[11px] text-stone-400 mt-1">
                {transactions.length === 0
                  ? "Adicione um investimento para começar"
                  : "Tente outro filtro ou termo de busca"}
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.monthKey}>
                {/* Cabeçalho do mês */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[10px] font-bold text-stone-500 tracking-wider">{group.monthLabel}</p>
                  <div className="flex items-center gap-2 text-[10px] font-semibold">
                    {group.totalIn > 0 && (
                      <span className="text-emerald-600">
                        +R$ {group.totalIn.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </span>
                    )}
                    {group.totalOut > 0 && (
                      <span className="text-rose-600">
                        -R$ {group.totalOut.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards de transação */}
                <div className="rounded-2xl bg-white border border-stone-200 divide-y divide-stone-100 overflow-hidden shadow-sm">
                  {group.items.map((tx) => {
                    const Icon = kindIcon(tx.kind);
                    const isConfirming = confirmDelete === tx.id;
                    const isPositive = tx.kind === "buy";

                    return (
                      <div key={tx.id} className="p-3.5 group">
                        {/* Linha 1: Logo + Ticker/Tipo + Valor total */}
                        <div className="flex items-center gap-3">
                          <AssetLogo
                            ticker={tx.ticker}
                            logo={tx.assetLogo}
                            type={tx.assetType}
                            size={40}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-stone-900 truncate">{tx.ticker}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ASSET_TYPE_STYLE[tx.assetType]}`}>
                                {ASSET_TYPE_LABEL[tx.assetType]}
                              </span>
                            </div>
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 ${kindStyle(tx.kind)}`}>
                              <Icon size={9} />
                              {kindLabel(tx.kind)}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold whitespace-nowrap ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                              {isPositive ? "+" : "-"}R$ {tx.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <button
                            onClick={() => setConfirmDelete(tx.id)}
                            className="opacity-0 group-hover:opacity-100 h-7 w-7 grid place-items-center rounded-lg text-stone-300 hover:text-rose-500 hover:bg-rose-50 transition shrink-0"
                            title="Excluir lançamento"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Linha 2: Data + detalhes (separados, organizados) */}
                        <div className="flex items-center justify-between gap-2 mt-2 pl-[52px] text-[10px] text-stone-500">
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={10} className="text-stone-400" />
                            {formatBR(tx.date)}
                          </span>
                          <span className="text-stone-400 truncate">
                            {tx.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} × R$ {tx.unitPrice.toFixed(2)}
                          </span>
                        </div>

                        {/* Nota (se houver — ex: "Posição encerrada") */}
                        {tx.note && (
                          <p className="text-[10px] text-stone-400 italic mt-1 pl-[52px]">
                            {tx.note}
                          </p>
                        )}

                        {isConfirming && (
                          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 animate-fade-up">
                            <p className="text-[11px] text-rose-800 font-medium">
                              Remover este lançamento do histórico?
                            </p>
                            <p className="text-[10px] text-rose-700 mt-0.5">
                              Isso não remove a posição da carteira, apenas o registro do histórico.
                            </p>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="py-1.5 rounded-lg bg-white border border-stone-200 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => {
                                  removeTransaction(tx.id);
                                  setConfirmDelete(null);
                                }}
                                className="py-1.5 rounded-lg bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-600"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Botão de backup acessível para mobile */}
          <div className="pt-2 pb-6">
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-stone-100 hover:bg-stone-200 active:scale-[0.98] text-stone-700 font-bold text-xs transition"
            >
              Fechar histórico
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
