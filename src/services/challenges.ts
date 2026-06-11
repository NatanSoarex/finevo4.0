// Sistema de desafios com regras rígidas:
// - Daily: só 1 check-in por dia
// - Monthly: só 1 check-in por mês
// - Evolução: ao completar, sobe para próxima etapa (ex: 30 → 60 → 90 dias)
// - resetOnMiss: se passar 1 dia sem check-in, zera o progresso

import { useEffect, useState } from "react";
import { safeStorage } from "./safeStorage";
import { todayISO } from "./dateUtils";

import { pushChallengesToSupabase, registerSyncListener } from "./supabaseSync";

export type Challenge = {
  id: string;
  title: string;
  desc: string;
  rewardXp: number; // XP por check-in
  frequency: "daily" | "monthly";
  target: number; // total de check-ins necessários
  current: number; // check-ins concluídos na etapa atual
  lastCheckinDate: string | null; // YYYY-MM-DD (daily) ou YYYY-MM (monthly)
  lastCheckinTs: number | null;
  // Para desafios com evolução por etapas (30 → 60 → 90 dias)
  evolutionStage: number; // 0, 1, 2...
  evolutionTargets?: number[]; // ex: [30, 60, 90]
  evolutionRewards?: number[]; // bonus XP ao completar cada etapa
  resetOnMiss: boolean; // se zera ao perder 1 dia
  iconKey: "target" | "zap" | "flame" | "trophy" | "shield";
  gradient: string;
  participants: number;
  active: boolean; // false quando abandonado
};

const KEY = "finevo:challenges";
const listeners = new Set<() => void>();

registerSyncListener(() => {
  listeners.forEach((fn) => fn());
});

function todayKey(): string {
  return todayISO();
}

function monthKey(d?: Date): string {
  const date = d || new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysBetween(dateStr: string): number {
  const d1 = new Date(dateStr).getTime();
  const d2 = new Date(todayKey()).getTime();
  return Math.floor((d2 - d1) / 86400000);
}

const DEFAULT_CHALLENGES: Challenge[] = [
  {
    id: "ch1",
    title: "30 dias sem impulso",
    desc: "Sem compras por impulso. Cada dia conta. Se perder 1, recomeça.",
    rewardXp: 10,
    frequency: "daily",
    target: 30,
    current: 0,
    lastCheckinDate: null,
    lastCheckinTs: null,
    evolutionStage: 0,
    evolutionTargets: [30, 60, 90],
    evolutionRewards: [100, 200, 400],
    resetOnMiss: true,
    iconKey: "target",
    gradient: "from-emerald-50 to-teal-50 border-emerald-100",
    participants: 0,
    active: true,
  },
  {
    id: "ch2",
    title: "Investidor consistente",
    desc: "1 aporte por mês durante 5 meses. Pode marcar 1× por mês.",
    rewardXp: 40,
    frequency: "monthly",
    target: 5,
    current: 0,
    lastCheckinDate: null,
    lastCheckinTs: null,
    evolutionStage: 0,
    resetOnMiss: false,
    iconKey: "zap",
    gradient: "from-violet-50 to-fuchsia-50 border-violet-100",
    participants: 0,
    active: true,
  },
  {
    id: "ch3",
    title: "Maratona de estudos",
    desc: "1 vídeo por dia durante 7 dias. Se perder 1 dia, recomeça do zero.",
    rewardXp: 10,
    frequency: "daily",
    target: 7,
    current: 0,
    lastCheckinDate: null,
    lastCheckinTs: null,
    evolutionStage: 0,
    resetOnMiss: true,
    iconKey: "flame",
    gradient: "from-sky-50 to-blue-50 border-sky-100",
    participants: 0,
    active: true,
  },
];

function read(): Challenge[] {
  try {
    const raw = safeStorage.getItem(KEY);
    if (!raw) return DEFAULT_CHALLENGES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CHALLENGES;

    // MERGE com defaults: garante que TODA propriedade nova
    // (rewardXp, frequency, target, etc) esteja presente, mesmo em dados antigos.
    const merged = DEFAULT_CHALLENGES.map((def) => {
      const stored = parsed.find((s: any) => s && s.id === def.id);
      if (!stored) return def;
      // Mantém os campos de progresso do usuário, força os campos de definição
      return {
        ...def,
        current: typeof stored.current === "number" ? stored.current : 0,
        lastCheckinDate: stored.lastCheckinDate ?? null,
        lastCheckinTs: stored.lastCheckinTs ?? null,
        evolutionStage: typeof stored.evolutionStage === "number" ? stored.evolutionStage : 0,
        active: stored.active !== false,
        // Se já evoluiu para próxima etapa, mantém o target evoluído
        target: stored.evolutionStage > 0 && def.evolutionTargets
          ? def.evolutionTargets[stored.evolutionStage]
          : def.target,
        title: stored.evolutionStage > 0 && def.evolutionTargets
          ? def.title.replace(/\d+/, String(def.evolutionTargets[stored.evolutionStage]))
          : def.title,
      };
    });
    return merged;
  } catch {
    return DEFAULT_CHALLENGES;
  }
}

function write(list: Challenge[]) {
  safeStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((fn) => fn());
  pushChallengesToSupabase().catch((e) => console.error("Error syncing challenges:", e));
}

export function getChallenges(): Challenge[] {
  return read();
}

/**
 * Verifica se um desafio já foi concluído no período atual (dia ou mês).
 */
export function isCompletedInCurrentPeriod(ch: Challenge): boolean {
  if (!ch.lastCheckinDate) return false;
  if (ch.frequency === "daily") {
    return ch.lastCheckinDate === todayKey();
  }
  // monthly
  return ch.lastCheckinDate === monthKey();
}

/**
 * Verifica se passou tempo demais sem check-in (precisa resetar)
 */
export function shouldReset(ch: Challenge): boolean {
  if (!ch.resetOnMiss || !ch.lastCheckinDate || ch.current === 0) return false;
  if (ch.frequency !== "daily") return false;
  // Se passou mais de 1 dia desde o último check-in → resetou
  const days = daysBetween(ch.lastCheckinDate);
  return days > 1;
}

/**
 * Aplica resets automáticos em todos os desafios que precisam
 */
export function applyAutoResets(): { reset: Challenge[]; updated: boolean } {
  const list = read();
  const wasReset: Challenge[] = [];
  let changed = false;
  const updated = list.map((c) => {
    if (shouldReset(c)) {
      wasReset.push(c);
      changed = true;
      return { ...c, current: 0, lastCheckinDate: null, lastCheckinTs: null };
    }
    return c;
  });
  if (changed) write(updated);
  return { reset: wasReset, updated: changed };
}

export type CheckinResult =
  | { kind: "blocked"; reason: "already-today" | "already-month" | "inactive" }
  | { kind: "ok"; xpGained: number; checklistComplete: boolean; evolved: boolean; newStage?: number };

/**
 * Faz check-in em um desafio. Retorna o resultado.
 */
export function checkinChallenge(id: string): CheckinResult {
  // Executa auto-resets antes do checkin para que se o usuário perdeu o dia, resete primeiro
  applyAutoResets();

  const list = read();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1 || !list[idx].active) {
    return { kind: "blocked", reason: "inactive" };
  }
  const ch = list[idx];

  // Bloqueia se já completou no período atual
  if (isCompletedInCurrentPeriod(ch)) {
    return {
      kind: "blocked",
      reason: ch.frequency === "daily" ? "already-today" : "already-month",
    };
  }

  const newCurrent = ch.current + 1;
  // Garante que sempre haja XP (fallback se rewardXp estiver corrompido)
  let xpGained = typeof ch.rewardXp === "number" && ch.rewardXp > 0 ? ch.rewardXp : 20;
  let checklistComplete = false;
  let evolved = false;
  let newStage = ch.evolutionStage;

  const updated: Challenge = {
    ...ch,
    current: newCurrent,
    lastCheckinDate: ch.frequency === "daily" ? todayKey() : monthKey(),
    lastCheckinTs: Date.now(),
  };

  // Verifica se completou a etapa
  if (newCurrent >= ch.target) {
    checklistComplete = true;
    // Bônus de XP ao concluir a etapa
    const bonus = ch.evolutionRewards?.[ch.evolutionStage] ?? ch.target * ch.rewardXp;
    xpGained += bonus;

    // Verifica evolução (próxima etapa)
    if (ch.evolutionTargets && ch.evolutionStage + 1 < ch.evolutionTargets.length) {
      evolved = true;
      newStage = ch.evolutionStage + 1;
      updated.evolutionStage = newStage;
      updated.target = ch.evolutionTargets[newStage];
      updated.current = 0;
      updated.lastCheckinDate = null;
      updated.lastCheckinTs = null;
      updated.title = updated.title.replace(/\d+/, String(ch.evolutionTargets[newStage]));
    }
  }

  list[idx] = updated;
  write(list);
  return { kind: "ok", xpGained, checklistComplete, evolved, newStage };
}

export function quitChallenge(id: string) {
  const list = read();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], active: false };
  write(list);
}

export function restartChallenge(id: string) {
  const list = read();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx] = {
    ...list[idx],
    current: 0,
    lastCheckinDate: null,
    lastCheckinTs: null,
    active: true,
  };
  write(list);
}

// Hook reativo
export function useChallenges() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Aplica auto-resets ao montar
    applyAutoResets();
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return {
    challenges: read(),
    _tick: tick,
  };
}
