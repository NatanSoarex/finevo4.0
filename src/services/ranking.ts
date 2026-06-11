// Sistema de ranking semanal determinístico contendo usuários reais.
// Reseta automaticamente nas transições de semana (Domingo 23:59 -> Segunda 00:00).

import { useEffect, useState } from "react";
import { safeStorage } from "./safeStorage";
import { getMondayOfCurrentWeek, parseLocalDate } from "./dateUtils";
import { supabase } from "./supabaseClient";

export type RankUser = {
  id: string;
  name: string;
  avatar: string; // iniciais
  xp: number;
  avatarColor: string; // gradiente Tailwind classes
  trend: "up" | "down" | "same";
  lastChange: number;
};

const listeners = new Set<() => void>();

function getUserProfile(userId: string, defaultName: string) {
  try {
    const raw = safeStorage.getItem(`finevo:profile:${userId}`);
    if (!raw) return { name: defaultName, photo: null };
    const p = JSON.parse(raw);
    return { name: p.name || defaultName, photo: p.photo || null };
  } catch {
    return { name: defaultName, photo: null };
  }
}

function getUserWeeklyXp(userId: string): number {
  const mondayStr = getMondayOfCurrentWeek();
  const mondayTs = parseLocalDate(mondayStr).getTime();
  const rawEvents = safeStorage.getItem(`finevo:xp-events:${userId}`);
  if (!rawEvents) return 0;
  try {
    const events = JSON.parse(rawEvents);
    if (!Array.isArray(events)) return 0;
    return events
      .filter((e) => e.ts >= mondayTs && e.source !== "admin_level_set")
      .reduce((a, e) => a + e.amount, 0);
  } catch {
    return 0;
  }
}

function getUserPrevWeekXpForUser(userId: string, lastResetWeek: string, currentMondayStr: string): number {
  try {
    const raw = safeStorage.getItem(`finevo:xp-events:${userId}`);
    if (!raw) return 0;
    const events = JSON.parse(raw);
    if (!Array.isArray(events)) return 0;
    
    const startTs = parseLocalDate(lastResetWeek).getTime();
    const endTs = parseLocalDate(currentMondayStr).getTime();
    
    return events
      .filter((e) => e.ts >= startTs && e.ts < endTs && e.source !== "admin_level_set")
      .reduce((a, e) => a + e.amount, 0);
  } catch {
    return 0;
  }
}

function getCohortColor(userId: string): string {
  const colors = [
    "from-indigo-400 to-violet-500",
    "from-rose-400 to-pink-500",
    "from-emerald-400 to-teal-500",
    "from-amber-400 to-orange-500",
    "from-sky-400 to-blue-500",
    "from-fuchsia-400 to-rose-500",
    "from-violet-400 to-purple-500",
    "from-cyan-400 to-blue-500",
    "from-orange-400 to-red-500",
    "from-purple-400 to-indigo-500",
  ];
  const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function getInitials(name: string): string {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Contador de conquistas de Pódio / Top 1 do usuário.
 */
export function getRankingTop1Count(): number {
  const v = safeStorage.getItem("finevo:ranking-top1-count");
  return v ? Number(v) : 0;
}

export function setRankingTop1Count(count: number): void {
  safeStorage.setItem("finevo:ranking-top1-count", String(count));
  listeners.forEach((fn) => fn());
}

/**
 * Checa automaticamente se mudou a semana e executa o encerramento determinístico com resumos.
 */
export function checkAndPerformWeeklyRollover() {
  const currentMondayStr = getMondayOfCurrentWeek();
  const lastResetWeek = safeStorage.getItem("finevo:ranking-last-reset-week");
  
  if (!lastResetWeek) {
    safeStorage.setItem("finevo:ranking-last-reset-week", currentMondayStr);
    return;
  }
  
  if (lastResetWeek !== currentMondayStr) {
    // Pegando ID logado
    const sessionRaw = safeStorage.getItem("finevo:session");
    const activeUserId = sessionRaw ? JSON.parse(sessionRaw)?.userId : null;
    
    if (activeUserId) {
      const userPrevXp = getUserPrevWeekXpForUser(activeUserId, lastResetWeek, currentMondayStr);
      
      const rawUsers = safeStorage.getItem("finevo:users");
      const registeredUsers: any[] = rawUsers ? JSON.parse(rawUsers) : [];
      const otherRealUsers = registeredUsers.filter((u) => u.id !== activeUserId);
      
      const otherScores = otherRealUsers.map((u) => {
        const xp = getUserPrevWeekXpForUser(u.id, lastResetWeek, currentMondayStr);
        return { id: u.id, name: u.username, xp };
      });
      
      const maxCompetitorXp = otherScores.reduce((max, c) => c.xp > max ? c.xp : max, 0);
      
      // Só ganha se tiver XP > 0 e for maior do que os outros usuários reais
      if (userPrevXp > 0 && userPrevXp > maxCompetitorXp) {
        const prevCount = getRankingTop1Count();
        setRankingTop1Count(prevCount + 1);
      }
    }
    
    // Conclui rollover no banco
    safeStorage.setItem("finevo:ranking-last-reset-week", currentMondayStr);
  }
}

/**
 * Retorna os outros concorrentes reais ordenados/calculados.
 */
export function getRanking(): RankUser[] {
  checkAndPerformWeeklyRollover();
  
  const rawUsers = safeStorage.getItem("finevo:users");
  const registeredUsers: any[] = rawUsers ? JSON.parse(rawUsers) : [];
  
  const sessionRaw = safeStorage.getItem("finevo:session");
  const activeUserId = sessionRaw ? JSON.parse(sessionRaw)?.userId : null;
  
  const otherRealUsers = registeredUsers.filter((u) => u.id !== activeUserId);
  
  return otherRealUsers.map((u) => {
    const profile = getUserProfile(u.id, u.username);
    const xp = getUserWeeklyXp(u.id);
    const avatar = getInitials(profile.name);
    const color = getCohortColor(u.id);
    return {
      id: u.id,
      name: profile.name,
      avatar,
      xp,
      avatarColor: color,
      trend: "same" as const,
      lastChange: 0,
    };
  });
}

/**
 * Baixa assincronamente todos os usuários do banco (Supabase) para o ranking local e perfis em cache.
 * Garante que novos usuários cadastrados apareçam no ranking e na pesquisa imediatamente.
 */
export async function syncUsersFromSupabase() {
  try {
    const { data: profiles, error } = await supabase
      .from("profile")
      .select("*");

    if (!error && profiles && profiles.length > 0) {
      const localUsersStr = safeStorage.getItem("finevo:users");
      const localUsers = localUsersStr ? JSON.parse(localUsersStr) : [];

      const mapped = profiles.map((p: any) => {
        const foundLocal = localUsers.find((lu: any) => lu.id === p.id);
        return {
          id: p.id,
          username: p.nome || p.email?.split("@")[0] || "Usuário",
          usernameLower: (p.nome || "").toLowerCase(),
          email: p.email || "",
          createdAt: p.criado_em ? new Date(p.criado_em).getTime() : Date.now(),
          isBanned: p.is_banned ?? foundLocal?.isBanned ?? false,
          isTester: p.is_tester ?? foundLocal?.isTester ?? false,
          photo: p.foto_perfil || null,
          banner: p.banner_perfil || "emerald"
        };
      });

      safeStorage.setItem("finevo:users", JSON.stringify(mapped));

      // Garante que cada perfil baixado possua cache offline correto
      profiles.forEach((p: any) => {
        const key = `finevo:profile:${p.id}`;
        const hasCachedProf = safeStorage.getItem(key);
        if (!hasCachedProf) {
          safeStorage.setItem(key, JSON.stringify({
            name: p.nome || "Usuário",
            bio: p.bio || "",
            photo: p.foto_perfil || null,
            banner: p.banner_perfil || "emerald"
          }));
        }
      });

      // Avisa os ouvintes do ranking a se atualizarem
      listeners.forEach((fn) => fn());
    }
  } catch (err) {
    console.error("Erro ao sincronizar usuários do Supabase no ranking:", err);
  }
}

/**
 * Hook para sincronizar e prover os dados reativos de ranking.
 */
export function useRanking() {
  const [users, setUsers] = useState<RankUser[]>(() => getRanking());

  useEffect(() => {
    const fn = () => setUsers(getRanking());
    listeners.add(fn);

    // Faz a sincronização assim que o ranking carrega pela primeira vez
    syncUsersFromSupabase().catch((err) => {
      console.error("Erro na carga inicial do useRanking:", err);
    });

    const interval = window.setInterval(() => {
      fn();
    }, 60 * 1000);

    return () => {
      listeners.delete(fn);
      window.clearInterval(interval);
    };
  }, []);

  return {
    users,
    nextUpdateInMs: 0,
  };
}
