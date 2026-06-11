// Histórico de lançamentos da carteira: aportes, vendas, criação de posição.
// Persistido em localStorage com hook reativo.

import { useEffect, useState } from "react";
import { safeStorage } from "./safeStorage";
import type { AssetType } from "./assetsCatalog";
import { parseLocalDate } from "./dateUtils";
import { getPositions, updatePosition, removePosition, addPosition } from "./portfolio";

import { pushTransactionsToSupabase, registerSyncListener } from "./supabaseSync";

export type TransactionKind = "buy" | "sell" | "dividend";

export type Transaction = {
  id: string;
  kind: TransactionKind;
  ticker: string;
  assetName: string;
  assetType: AssetType;
  assetLogo: string;
  quantity: number;
  unitPrice: number;
  total: number; // quantity * unitPrice
  date: string; // YYYY-MM-DD (data da operação informada pelo usuário)
  ts: number; // timestamp de quando foi registrado no app
  note?: string;
};

const KEY = "finevo:transactions";
const listeners = new Set<() => void>();

let cachedTransactions: Transaction[] | null = null;

// Register sync listener of transactions
registerSyncListener(() => {
  cachedTransactions = null;
  listeners.forEach((fn) => fn());
});

function read(): Transaction[] {
  if (cachedTransactions !== null) return cachedTransactions;
  try {
    const raw = safeStorage.getItem(KEY);
    if (!raw) {
      cachedTransactions = [];
      return cachedTransactions;
    }
    const parsed = JSON.parse(raw);
    cachedTransactions = Array.isArray(parsed) ? parsed : [];
    return cachedTransactions;
  } catch {
    cachedTransactions = [];
    return cachedTransactions;
  }
}

function write(list: Transaction[]) {
  cachedTransactions = list;
  safeStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((fn) => fn());
  // Push transactions update automatically to Supabase
  pushTransactionsToSupabase().catch((e) => console.error("Error syncing transactions:", e));
}

export function addTransaction(tx: Omit<Transaction, "id" | "ts">): Transaction {
  const created: Transaction = {
    ...tx,
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
  };
  const list = read();
  list.push(created);
  write(list);
  return created;
}

export function removeTransaction(id: string) {
  const list = read();
  const tx = list.find((t) => t.id === id);
  if (!tx) return;

  // Atualiza a lista de transações
  const newList = list.filter((t) => t.id !== id);
  write(newList);

  // Ajusta a posição correspondente no portfolio para manter sincronizado
  const positions = getPositions();
  const pos = positions.find((p) => p.ticker.toUpperCase() === tx.ticker.toUpperCase());

  if (tx.kind === "buy") {
    if (pos) {
      const newQty = Math.max(0, pos.quantity - tx.quantity);
      const newInvested = Math.max(0, pos.invested - tx.total);
      
      if (newQty <= 1e-8 || newInvested <= 0.01) {
        removePosition(pos.id);
      } else {
        const newAvg = newQty > 0 ? newInvested / newQty : 0;
        updatePosition(pos.id, {
          quantity: newQty,
          invested: Math.round(newInvested * 100) / 100,
          purchasePrice: Math.round(newAvg * 100) / 100,
        });
      }
    }
  } else if (tx.kind === "sell") {
    if (pos) {
      // Se era uma venda, excluir a transação de venda adiciona a quantidade de volta
      const newQty = pos.quantity + tx.quantity;
      const newInvested = newQty * pos.purchasePrice;
      updatePosition(pos.id, {
        quantity: newQty,
        invested: Math.round(newInvested * 100) / 100,
      });
    } else {
      // Re-cria a posição se ela tinha sido totalmente encerrada
      addPosition({
        ticker: tx.ticker,
        name: tx.assetName,
        type: tx.assetType,
        logo: tx.assetLogo,
        purchaseDate: tx.date,
        purchasePrice: tx.unitPrice,
        quantity: tx.quantity,
        invested: tx.total,
      });
    }
  }
}

export function removeTransactionsForTicker(ticker: string) {
  const cleanTarget = ticker.trim().toUpperCase();
  write(read().filter((t) => t.ticker.trim().toUpperCase() !== cleanTarget));
}

export function getTransactions(): Transaction[] {
  return read();
}

/**
 * Agrupa transações por mês (chave YYYY-MM).
 * Retorna ordenado do mais recente para o mais antigo.
 */
export function getTransactionsByMonth(): {
  monthKey: string;
  monthLabel: string;
  items: Transaction[];
  totalIn: number;
  totalOut: number;
}[] {
  const list = read().slice().sort((a, b) => b.ts - a.ts);
  const groups: Record<string, Transaction[]> = {};
  for (const tx of list) {
    const d = parseLocalDate(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return Object.entries(groups)
    .sort((a, b) => (a[0] > b[0] ? -1 : 1))
    .map(([key, items]) => {
      const [y, m] = key.split("-");
      const label = `${monthNames[Number(m) - 1]}. de ${y}`;
      const totalIn = items.filter((t) => t.kind === "buy" || t.kind === "dividend").reduce((s, t) => s + t.total, 0);
      const totalOut = items.filter((t) => t.kind === "sell").reduce((s, t) => s + t.total, 0);
      return { monthKey: key, monthLabel: label, items, totalIn, totalOut };
    });
}

/**
 * Anteriormente populava transações demo. Agora não faz nada — o usuário
 * começa com histórico vazio e gera transações conforme faz aportes.
 * Mantida exportada para compatibilidade e para limpar seeds antigos.
 */
export function seedTransactionsIfEmpty() {
  const list = read();
  // Limpa seeds antigos (ids começando com "tx_seed_")
  const cleaned = list.filter((t) => !t.id.startsWith("tx_seed_"));
  if (cleaned.length !== list.length) {
    write(cleaned);
  }
}

// Hook reativo
export function useTransactions() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { transactions: read(), _tick: tick };
}
