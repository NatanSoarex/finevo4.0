// Sistema de XP, nível e streak persistente em localStorage.
// XP vem de eventos (check-in de desafio, conclusão de meta, etc).
// Streak = dias consecutivos com PELO MENOS 1 evento de XP.

import { useEffect, useState } from "react";
import { safeStorage } from "./safeStorage";
import { todayISO, getMondayOfCurrentWeek, parseLocalDate } from "./dateUtils";

import { pushProfileToSupabase, registerSyncListener } from "./supabaseSync";

export type XpEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  source: string; // "challenge", "goal", etc
  label: string; // descrição curta
  ts: number; // timestamp
};

const XP_KEY = "finevo:xp-events";
const listeners = new Set<() => void>();

// Register sync listener of gamification
registerSyncListener(() => {
  listeners.forEach((fn) => fn());
});

function getToday(): string {
  return todayISO();
}

function readEvents(): XpEvent[] {
  try {
    const raw = safeStorage.getItem(XP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: XpEvent[]) {
  safeStorage.setItem(XP_KEY, JSON.stringify(events));
  listeners.forEach((fn) => fn());
  // Push updated statistics to profile inside Supabase
  pushProfileToSupabase().catch((e) => console.error("Error syncing xp-events:", e));
}

/**
 * Reservado para futuro: semear eventos iniciais.
 * Atualmente NÃO faz nada — o XP/streak começa do zero,
 * só sobe quando o usuário realmente completar desafios.
 *
 * Adicionalmente: limpa seeds antigos (de versões anteriores)
 * que estavam dando falso streak de 14 dias sem XP correspondente.
 */
export function seedXpIfEmpty() {
  const events = readEvents();
  // Remove eventos antigos com prefixo "seed_" (limpeza de versão antiga)
  const cleaned = events.filter((e) => !e.id.startsWith("seed_"));
  if (cleaned.length !== events.length) {
    writeEvents(cleaned);
  }
}

/**
 * Adiciona um ganho de XP. Retorna o evento criado.
 */
export function addXp(amount: number, source: string, label: string): XpEvent {
  const event: XpEvent = {
    id: `xp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: getToday(),
    amount,
    source,
    label,
    ts: Date.now(),
  };
  const list = readEvents();
  list.push(event);
  writeEvents(list);
  return event;
}

/**
 * Remove o ÚLTIMO evento de XP com determinado source+label (para "desfazer").
 */
export function undoLastXp(source: string, label: string) {
  const list = readEvents();
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].source === source && list[i].label === label && list[i].date === getToday()) {
      list.splice(i, 1);
      writeEvents(list);
      return;
    }
  }
}

export function getXpTotal(): number {
  return readEvents().reduce((a, e) => a + e.amount, 0);
}

export function clearAllXp(): void {
  writeEvents([]);
}

export function getWeeklyXp(): number {
  const mondayStr = getMondayOfCurrentWeek();
  const mondayTs = parseLocalDate(mondayStr).getTime();
  return readEvents()
    .filter((e) => e.ts >= mondayTs && e.source !== "admin_level_set")
    .reduce((a, e) => a + e.amount, 0);
}

export function getTodayXp(): number {
  const today = getToday();
  return readEvents()
    .filter((e) => e.date === today && e.source !== "admin_level_set")
    .reduce((a, e) => a + e.amount, 0);
}

export function setLevel(targetLvl: number): void {
  const currentTotal = getXpTotal();
  const targetTotal = getXpRequiredForLevel(targetLvl);
  const diff = targetTotal - currentTotal;
  if (diff !== 0) {
    const list = readEvents();
    const event: XpEvent = {
      id: `xp_lvl_set_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: getToday(),
      amount: diff,
      source: "admin_level_set",
      label: `Ajuste Administrativo de Nível ${targetLvl}`,
      ts: Date.now(),
    };
    list.push(event);
    writeEvents(list);
  }
}

/**
 * Streak = dias consecutivos com pelo menos 1 evento de XP.
 * - Se HOJE ainda não houve evento, considera ontem como último dia.
 * - Quebra ao passar um dia inteiro sem nenhum evento.
 */
export function getStreak(): number {
  const events = readEvents();
  if (events.length === 0) return 0;

  // Conjunto de datas com pelo menos 1 evento
  const datesWithXp = new Set(events.map((e) => e.date));
  const todayKey = getToday();
  const todayHasXp = datesWithXp.has(todayKey);

  let streak = 0;
  const startDay = new Date();
  if (!todayHasXp) startDay.setDate(startDay.getDate() - 1);

  for (let i = 0; i < 365; i++) {
    const d = new Date(startDay);
    d.setDate(d.getDate() - i);
    // Formato YYYY-MM-DD no FUSO LOCAL (não UTC)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (datesWithXp.has(key)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Sistema de níveis repensado para que a escalada seja lenta, recompensadora e emblemática:
 * - Média diária realista do usuário ativo: ~25 XP/dia.
 * - Objetivo: Nível 25 (Mestre) em aproximadamente 3 anos de consistência real (~1100 dias).
 * - Fórmula Quadrática: XP(Nível) = 45 * n^2 + 100 * n, com n = level - 1.
 *
 * Tabela de progressão estimada (a 25 XP/dia):
 * - Nível 2 (Iniciante): 145 XP (~5 a 6 dias)
 * - Nível 3: 380 XP (~15 dias, desbloqueia múltiplas metas)
 * - Nível 5: 1.120 XP (~1.5 meses, Selo Aprendiz)
 * - Nível 10: 4.545 XP (~6 meses, Selo Veterano)
 * - Nível 15: 10.220 XP (~1.1 anos, Insígnia Premium)
 * - Nível 20: 18.145 XP (~2.0 anos)
 * - Nível 25 (Lenda / Mestre): 28.320 XP (~3.1 anos de pura consistência e conquistas)
 */
export function getXpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 45 * n * n + 100 * n;
}

export function getLevelFromXp(xp: number): { level: number; xpInLevel: number; xpForNext: number; progress: number } {
  let level = 1;
  while (getXpRequiredForLevel(level + 1) <= xp) {
    level++;
    if (level > 100) break; // proteção
  }
  const xpForCurrent = getXpRequiredForLevel(level);
  const xpForNext = getXpRequiredForLevel(level + 1);
  const xpInLevel = xp - xpForCurrent;
  const xpNeeded = xpForNext - xpForCurrent;
  return {
    level,
    xpInLevel,
    xpForNext: xpForNext - xp, // quanto falta
    progress: xpNeeded > 0 ? (xpInLevel / xpNeeded) * 100 : 100,
  };
}

/**
 * Retorna histórico de evolução de níveis com base nos eventos REAIS de XP.
 * Calcula em qual momento o usuário cruzou cada nível.
 */
export type LevelMilestone = {
  level: number;
  date: string; // formato DD/MM/AAAA
  xp: number; // XP acumulado quando atingiu
  xpGained: number; // XP ganho desde o nível anterior
  isCurrent: boolean;
};

export function getLevelHistory(maxEntries = 6): LevelMilestone[] {
  const events = readEvents().slice().sort((a, b) => a.ts - b.ts);
  const milestones: LevelMilestone[] = [];

  let cumulativeXp = 0;
  let lastLevel = 1;

  for (const event of events) {
    cumulativeXp += event.amount;
    const currentLevel = getLevelFromXp(cumulativeXp).level;
    if (currentLevel > lastLevel) {
      // Cruzou um ou mais níveis com este evento
      for (let lvl = lastLevel + 1; lvl <= currentLevel; lvl++) {
        const xpAtMilestone = getXpRequiredForLevel(lvl);
        const previous = milestones[milestones.length - 1];
        const xpGained = previous ? xpAtMilestone - previous.xp : xpAtMilestone;
        const d = new Date(event.ts);
        milestones.push({
          level: lvl,
          date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
          xp: xpAtMilestone,
          xpGained,
          isCurrent: false,
        });
      }
      lastLevel = currentLevel;
    }
  }

  // Adiciona o nível atual como entrada "Hoje"
  const totalXp = getXpTotal();
  const currentInfo = getLevelFromXp(totalXp);
  const lastMilestone = milestones[milestones.length - 1];
  // Se o nível atual ainda não tem milestone (estamos no meio dele), adiciona como "atual"
  if (!lastMilestone || lastMilestone.level !== currentInfo.level) {
    const previousLevelXp = getXpRequiredForLevel(currentInfo.level);
    milestones.push({
      level: currentInfo.level,
      date: "Hoje",
      xp: totalXp,
      xpGained: totalXp - previousLevelXp,
      isCurrent: true,
    });
  } else {
    // Marca o último como atual
    lastMilestone.isCurrent = true;
    lastMilestone.date = "Hoje";
    lastMilestone.xp = totalXp;
  }

  // Retorna do mais recente para o mais antigo, limitado
  return milestones.reverse().slice(0, maxEntries);
}

// Hook React reativo
export function useGamification() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const xpTotal = getXpTotal();
  const levelInfo = getLevelFromXp(xpTotal);

  return {
    xpTotal,
    weeklyXp: getWeeklyXp(),
    todayXp: getTodayXp(),
    streak: getStreak(),
    level: levelInfo.level,
    xpInLevel: levelInfo.xpInLevel,
    xpForNext: levelInfo.xpForNext,
    levelProgress: levelInfo.progress,
    addXp,
    undoLastXp,
    clearAllXp,
    setLevel,
    _tick: tick,
  };
}
