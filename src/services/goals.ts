// Sistema de Metas sincronizado com aportes da carteira.
// O `current` é sempre calculado AUTOMATICAMENTE a partir das posições.
// O usuário só define a categoria e o `target` (valor a alcançar).

import { useEffect, useState } from "react";
import { safeStorage } from "./safeStorage";
import { getPositions, subscribeToPortfolio } from "./portfolio";
import type { AssetType } from "./assetsCatalog";

// Quando portfolio muda, notifica também listeners de goals
// (assim metas se atualizam ao adicionar/remover aporte)
subscribeToPortfolio(() => {
  // Notifica todos os componentes que usam useGoals
  // Pequeno delay para garantir que o portfolio já gravou
  setTimeout(() => {
    listenersRef.forEach((fn) => fn());
  }, 0);
});

export type GoalCategory =
  | "money"   // dinheiro total investido (qualquer tipo)
  | "stock"   // só ações
  | "fund"    // só FIIs
  | "etf"     // só ETFs
  | "crypto"; // só criptos

export type Goal = {
  id: string;
  category: GoalCategory;
  target: number; // valor objetivo em R$
  createdAt: number;
};

const KEY = "finevo:goals";
const listeners = new Set<() => void>();
// referência separada usada no callback de portfolio (acima)
const listenersRef = listeners;

// Metadata visual de cada categoria
export const GOAL_CATEGORIES: Record<GoalCategory, {
  label: string;
  description: string;
  icon: string;
  gradient: string;
  textColor: string;
  borderColor: string;
  bgSoft: string;
}> = {
  money: {
    label: "Dinheiro investido",
    description: "Total investido em todos os ativos",
    icon: "💰",
    gradient: "from-emerald-400 to-teal-500",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    bgSoft: "bg-emerald-50",
  },
  stock: {
    label: "Ações",
    description: "Investimento em ações brasileiras",
    icon: "📈",
    gradient: "from-sky-400 to-blue-500",
    textColor: "text-sky-700",
    borderColor: "border-sky-200",
    bgSoft: "bg-sky-50",
  },
  fund: {
    label: "FIIs",
    description: "Fundos imobiliários",
    icon: "🏢",
    gradient: "from-violet-400 to-fuchsia-500",
    textColor: "text-violet-700",
    borderColor: "border-violet-200",
    bgSoft: "bg-violet-50",
  },
  etf: {
    label: "ETFs",
    description: "Fundos de índice",
    icon: "📊",
    gradient: "from-amber-400 to-orange-500",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    bgSoft: "bg-amber-50",
  },
  crypto: {
    label: "Criptomoedas",
    description: "Bitcoin, Ethereum e outras",
    icon: "₿",
    gradient: "from-orange-400 to-rose-500",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
    bgSoft: "bg-orange-50",
  },
};

function read(): Goal[] {
  try {
    const raw = safeStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(goals: Goal[]) {
  safeStorage.setItem(KEY, JSON.stringify(goals));
  listeners.forEach((fn) => fn());
}

export function addGoal(category: GoalCategory, target: number): Goal | null {
  if (target <= 0) return null;
  const list = read();
  // Não permite 2 metas da mesma categoria
  if (list.some((g) => g.category === category)) return null;
  const goal: Goal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    category,
    target,
    createdAt: Date.now(),
  };
  list.push(goal);
  write(list);
  return goal;
}

export function updateGoalTarget(id: string, target: number) {
  if (target <= 0) return;
  const list = read();
  const idx = list.findIndex((g) => g.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], target };
  write(list);
}

export function removeGoal(id: string) {
  write(read().filter((g) => g.id !== id));
}

export function getGoals(): Goal[] {
  return read();
}

/**
 * Calcula o valor ATUAL de uma meta com base nas posições da carteira.
 * - money: soma de TODOS os ativos
 * - stock/fund/etf/crypto: soma só dos ativos daquele tipo
 */
export function calculateCurrent(category: GoalCategory): number {
  const positions = getPositions();
  if (category === "money") {
    return positions.reduce((sum, p) => sum + p.invested, 0);
  }
  // Mapeamento categoria → tipo de ativo
  const typeMap: Record<Exclude<GoalCategory, "money">, AssetType> = {
    stock: "stock",
    fund: "fund",
    etf: "etf",
    crypto: "crypto",
  };
  const assetType = typeMap[category];
  return positions
    .filter((p) => p.type === assetType)
    .reduce((sum, p) => sum + p.invested, 0);
}

/**
 * Retorna lista de metas COM o `current` calculado automaticamente.
 */
export function getGoalsWithProgress(): Array<Goal & { current: number; progress: number; completed: boolean }> {
  return read().map((g) => {
    const current = calculateCurrent(g.category);
    const progress = g.target > 0 ? Math.min(100, (current / g.target) * 100) : 0;
    return {
      ...g,
      current: Math.round(current * 100) / 100,
      progress,
      completed: current >= g.target,
    };
  });
}

// Hook React reativo (reage tanto a mudanças de metas quanto de posições)
export function useGoals() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { goals: getGoalsWithProgress(), _tick: tick };
}
