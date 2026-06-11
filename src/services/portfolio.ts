// Store do portfólio com persistência em localStorage
import { useEffect, useState } from "react";
import type { AssetType } from "./assetsCatalog";
import { safeStorage } from "./safeStorage";

import { pushPortfolioToSupabase, registerSyncListener } from "./supabaseSync";

export type Position = {
  id: string;
  ticker: string;
  name: string;
  type: AssetType;
  logo: string;
  purchaseDate: string; // ISO yyyy-mm-dd
  purchasePrice: number; // preço unitário na data da compra
  quantity: number;
  invested: number; // purchasePrice * quantity
  createdAt: number;
  updatedAt?: number;
};

const KEY = "finevo:portfolio";

const listeners = new Set<() => void>();

let cachedPositions: Position[] | null = null;

// Register sync listener to update react states when pulled from Supabase
registerSyncListener(() => {
  cachedPositions = null;
  listeners.forEach((fn) => fn());
});

/**
 * Permite outros services se inscrever para receber notificações
 * quando o portfolio mudar (sem precisar de hook React).
 */
export function subscribeToPortfolio(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function read(): Position[] {
  if (cachedPositions !== null) return cachedPositions;
  try {
    const raw = safeStorage.getItem(KEY);
    if (!raw) {
      cachedPositions = [];
      return cachedPositions;
    }
    const arr = JSON.parse(raw);
    cachedPositions = Array.isArray(arr) ? arr : [];
    return cachedPositions;
  } catch {
    cachedPositions = [];
    return cachedPositions;
  }
}

function write(positions: Position[]) {
  const now = Date.now();
  const withTimestamps = positions.map((p) => ({
    ...p,
    updatedAt: p.updatedAt || now,
  }));
  cachedPositions = withTimestamps;
  safeStorage.setItem(KEY, JSON.stringify(withTimestamps));
  listeners.forEach((fn) => fn());
  // Push update automatically to Supabase
  pushPortfolioToSupabase().catch((e) => console.error("Error syncing portfolio:", e));
}

export function getPositions(): Position[] {
  return read();
}

export function addPosition(p: Omit<Position, "id" | "createdAt" | "updatedAt">): Position {
  const list = read();
  const created: Position = {
    ...p,
    id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  // Se já existe posição do mesmo ticker, agrega (preço médio)
  const existingIdx = list.findIndex((x) => x.ticker === created.ticker);
  if (existingIdx >= 0) {
    const ex = list[existingIdx];
    const totalQty = ex.quantity + created.quantity;
    const totalInvested = ex.invested + created.invested;
    const avgPrice = totalInvested / totalQty;
    list[existingIdx] = {
      ...ex,
      quantity: totalQty,
      invested: totalInvested,
      purchasePrice: Math.round(avgPrice * 100) / 100,
      // mantém data mais antiga para mostrar "investidor desde"
      purchaseDate: ex.purchaseDate < created.purchaseDate ? ex.purchaseDate : created.purchaseDate,
      updatedAt: Date.now(),
    };
    write(list);
    return list[existingIdx];
  }
  list.push(created);
  write(list);
  return created;
}

export function removePosition(id: string) {
  write(read().filter((p) => p.id !== id));
}

export function updatePosition(id: string, updatedFields: Partial<Position>) {
  const list = read();
  const idx = list.findIndex((p) => p.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updatedFields, updatedAt: Date.now() };
    write(list);
  }
}

export function clearAll() {
  write([]);
}

// React hook
export function usePortfolio() {
  const [positions, setPositions] = useState<Position[]>(() => read());
  useEffect(() => {
    const fn = () => setPositions(read());
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return positions;
}

/**
 * Anteriormente populava posições demo. Agora não faz nada — o usuário
 * começa com carteira vazia e adiciona seus próprios ativos.
 * Mantemos a função exportada para compatibilidade com chamadas existentes
 * e também para limpar seeds antigos que possam ter ficado em localStorage.
 */
export function seedDemoIfEmpty() {
  const list = read();
  // Limpa seeds antigos (ids começando com "pos_demo_")
  const cleaned = list.filter((p) => !p.id.startsWith("pos_demo_"));
  if (cleaned.length !== list.length) {
    write(cleaned);
  }
}
