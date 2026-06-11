// Sistema de conquistas e títulos REAIS — baseados no estado do usuário.
// Cada conquista tem uma função `check` que valida se foi desbloqueada.

import { getXpTotal, getStreak, getLevelFromXp } from "./gamification";
import { getPositions } from "./portfolio";
import { getTransactions } from "./transactions";
import { getCachedQuotes, getCachedHistories } from "./marketApi";
import { getPortfolioValueAt } from "./valueCalc";
import { localTs } from "./dateUtils";
import { getRankingTop1Count } from "./ranking";

export type AchievementCategory = "fin" | "disc" | "study" | "social";

export type Achievement = {
  id: string;
  name: string;
  desc: string; // requisito visível
  icon: string;
  category: AchievementCategory;
  rare: boolean;
  secret?: boolean;
  /** Retorna true se foi desbloqueado, ou um objeto com progresso atual/meta */
  check: () => { done: boolean; progress?: number; target?: number };
};

export type Title = {
  id: string;
  name: string;
  desc: string; // requisito
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legend";
  /** Retorna true se o usuário desbloqueou este título */
  check: () => boolean;
};

// ===== CONQUISTAS =====
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_buy",
    name: "Primeiro aporte",
    desc: "Faça seu primeiro aporte",
    icon: "💎",
    category: "fin",
    rare: false,
    check: () => ({ done: getTransactions().filter((t) => t.kind === "buy").length >= 1 }),
  },
  {
    id: "buy_5",
    name: "5 aportes",
    desc: "Faça 5 aportes",
    icon: "💰",
    category: "fin",
    rare: false,
    check: () => {
      const n = getTransactions().filter((t) => t.kind === "buy").length;
      return { done: n >= 5, progress: n, target: 5 };
    },
  },
  {
    id: "buy_20",
    name: "Investidor ativo",
    desc: "Faça 20 aportes",
    icon: "📈",
    category: "fin",
    rare: false,
    check: () => {
      const n = getTransactions().filter((t) => t.kind === "buy").length;
      return { done: n >= 20, progress: n, target: 20 };
    },
  },
  {
    id: "buy_100",
    name: "100 aportes",
    desc: "Faça 100 aportes",
    icon: "🚀",
    category: "fin",
    rare: true,
    check: () => {
      const n = getTransactions().filter((t) => t.kind === "buy").length;
      return { done: n >= 100, progress: n, target: 100 };
    },
  },
  {
    id: "buy_500",
    name: "Investidor obstinado",
    desc: "Faça 500 aportes",
    icon: "🏛️",
    category: "fin",
    rare: true,
    check: () => {
      const n = getTransactions().filter((t) => t.kind === "buy").length;
      return { done: n >= 500, progress: n, target: 500 };
    },
  },
  {
    id: "buy_1000",
    name: "Lenda dos aportes",
    desc: "Faça 1000 aportes",
    icon: "🎖️",
    category: "fin",
    rare: true,
    check: () => {
      const n = getTransactions().filter((t) => t.kind === "buy").length;
      return { done: n >= 1000, progress: n, target: 1000 };
    },
  },
  {
    id: "diversified",
    name: "Diversificado",
    desc: "Tenha 5 ativos diferentes na carteira",
    icon: "🎯",
    category: "fin",
    rare: false,
    check: () => {
      const n = new Set(getPositions().map((p) => p.ticker)).size;
      return { done: n >= 5, progress: n, target: 5 };
    },
  },
  {
    id: "portfolio_10k",
    name: "Primeiro 10k",
    desc: "Acumule R$ 10.000 investidos",
    icon: "🌟",
    category: "fin",
    rare: false,
    check: () => {
      const total = getPositions().reduce((s, p) => s + p.invested, 0);
      return { done: total >= 10000, progress: total, target: 10000 };
    },
  },
  {
    id: "portfolio_50k",
    name: "Marco dos 50k",
    desc: "Acumule R$ 50.000 investidos",
    icon: "👑",
    category: "fin",
    rare: true,
    check: () => {
      const total = getPositions().reduce((s, p) => s + p.invested, 0);
      return { done: total >= 50000, progress: total, target: 50000 };
    },
  },
  {
    id: "portfolio_100k",
    name: "Investidor 100k",
    desc: "Acumule R$ 100.000 investidos",
    icon: "💼",
    category: "fin",
    rare: true,
    check: () => {
      const total = getPositions().reduce((s, p) => s + p.invested, 0);
      return { done: total >= 100000, progress: total, target: 100000 };
    },
  },
  {
    id: "portfolio_500k",
    name: "Patrimônio de meio milhão",
    desc: "Acumule R$ 500.000 investidos",
    icon: "🏰",
    category: "fin",
    rare: true,
    secret: true,
    check: () => {
      const total = getPositions().reduce((s, p) => s + p.invested, 0);
      return { done: total >= 500000, progress: total, target: 500000 };
    },
  },
  {
    id: "portfolio_1m",
    name: "Clube do Milhão",
    desc: "Acumule R$ 1.000.000 investidos",
    icon: "🏦",
    category: "fin",
    rare: true,
    check: () => {
      const total = getPositions().reduce((s, p) => s + p.invested, 0);
      return { done: total >= 1000000, progress: total, target: 1000000 };
    },
  },
  {
    id: "profit_20",
    name: "Rentabilidade de 20%",
    desc: "Alcance uma rentabilidade total de pelo menos 20% na carteira",
    icon: "📈",
    category: "fin",
    rare: true,
    secret: true,
    check: () => {
      const positions = getPositions();
      const quotes = getCachedQuotes();
      let totalInvested = 0;
      let totalCurrent = 0;
      for (const p of positions) {
        const q = quotes[p.ticker.toUpperCase()];
        const price = q ? q.price : p.purchasePrice;
        totalInvested += p.invested;
        totalCurrent += price * p.quantity;
      }
      const profit = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;
      return { done: profit >= 20, progress: Math.max(0, Number(profit.toFixed(2))), target: 20 };
    },
  },
  {
    id: "positive_3_months",
    name: "Consistência de Ouro",
    desc: "Alcance 3 meses consecutivos de rentabilidade positiva na carteira",
    icon: "📈",
    category: "fin",
    rare: true,
    check: () => {
      const txs = getTransactions();
      const positions = getPositions();
      const histories = getCachedHistories();
      const quotes = getCachedQuotes();

      if (txs.length === 0) {
        return { done: false, progress: 0, target: 3 };
      }

      const dates = txs.map((t) => t.date).concat(positions.map((p) => p.purchaseDate));
      if (dates.length === 0) {
        return { done: false, progress: 0, target: 3 };
      }

      dates.sort();
      const oldestDateStr = dates[0];
      const parts = oldestDateStr.split("-").map(Number);
      if (parts.length < 2) return { done: false, progress: 0, target: 3 };
      const startYear = parts[0];
      const startMonth = parts[1];

      const today = new Date();
      const curYear = today.getFullYear();
      const curMonth = today.getMonth() + 1;

      // Lista de meses consecutivos a testar
      const monthsToTest: { y: number; m: number }[] = [];
      let y = startYear;
      let m = startMonth;
      while (y < curYear || (y === curYear && m <= curMonth)) {
        monthsToTest.push({ y, m });
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }

      const monthPositives: boolean[] = [];

      for (const item of monthsToTest) {
        const firstDayMs = new Date(item.y, item.m - 1, 1).getTime();
        const nextMonthY = item.m === 12 ? item.y + 1 : item.y;
        const nextMonthM = item.m === 12 ? 1 : item.m + 1;
        const endDayMs = new Date(nextMonthY, nextMonthM - 1, 1).getTime();

        const initial = getPortfolioValueAt(positions, firstDayMs, histories, quotes, txs);
        const endTargetTs = Math.min(endDayMs - 1, Date.now());
        const end = getPortfolioValueAt(positions, endTargetTs, histories, quotes, txs);

        const segmentTx = txs.filter((t) => {
          const ts = localTs(t.date);
          return ts >= firstDayMs && ts < endDayMs && ts <= Date.now();
        });

        const buys = segmentTx.filter((t) => t.kind === "buy").reduce((sum, t) => sum + t.total, 0);
        const sells = segmentTx.filter((t) => t.kind === "sell").reduce((sum, t) => sum + t.total, 0);
        const contributions = buys - sells;
        const dividends = segmentTx.filter((t) => t.kind === "dividend").reduce((sum, t) => sum + t.total, 0);

        const profit = end.value - initial.value - contributions + dividends;
        // Considera positivo apenas se o usuário tinha alguma posição ativa ou investiu nesse período
        const active = initial.value > 0 || end.value > 0 || buys > 0;
        const isPositive = active && profit > 0.01;
        monthPositives.push(isPositive);
      }

      // Procura a maior sequência consecutiva de meses positivos
      let maxStreak = 0;
      let currentStreak = 0;
      for (const pos of monthPositives) {
        if (pos) {
          currentStreak++;
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
        } else {
          currentStreak = 0;
        }
      }

      return { done: maxStreak >= 3, progress: maxStreak, target: 3 };
    },
  },
  {
    id: "streak_7",
    name: "Streak de 7 dias",
    desc: "Mantenha 7 dias consecutivos ganhando XP",
    icon: "🔥",
    category: "disc",
    rare: false,
    check: () => {
      const s = getStreak();
      return { done: s >= 7, progress: s, target: 7 };
    },
  },
  {
    id: "streak_30",
    name: "Streak de 30 dias",
    desc: "Mantenha 30 dias consecutivos ganhando XP",
    icon: "⚡",
    category: "disc",
    rare: true,
    check: () => {
      const s = getStreak();
      return { done: s >= 30, progress: s, target: 30 };
    },
  },
  {
    id: "streak_60",
    name: "Streak de 60 dias",
    desc: "Mantenha 60 dias consecutivos ganhando XP",
    icon: "🔥",
    category: "disc",
    rare: true,
    check: () => {
      const s = getStreak();
      return { done: s >= 60, progress: s, target: 60 };
    },
  },
  {
    id: "streak_100",
    name: "Centurião",
    desc: "100 dias consecutivos ganhando XP",
    icon: "🏆",
    category: "disc",
    rare: true,
    check: () => {
      const s = getStreak();
      return { done: s >= 100, progress: s, target: 100 };
    },
  },
  {
    id: "streak_120",
    name: "Streak de 120 dias",
    desc: "Mantenha 120 dias consecutivos ganhando XP",
    icon: "⚡",
    category: "disc",
    rare: true,
    secret: true,
    check: () => {
      const s = getStreak();
      return { done: s >= 120, progress: s, target: 120 };
    },
  },
  {
    id: "streak_365",
    name: "Streak de 365 dias",
    desc: "Mantenha 365 dias consecutivos ganhando XP",
    icon: "👑",
    category: "disc",
    rare: true,
    secret: true,
    check: () => {
      const s = getStreak();
      return { done: s >= 365, progress: s, target: 365 };
    },
  },
  {
    id: "level_5",
    name: "Aprendiz",
    desc: "Alcance o nível 5",
    icon: "📘",
    category: "study",
    rare: false,
    check: () => {
      const lvl = getLevelFromXp(getXpTotal()).level;
      return { done: lvl >= 5, progress: lvl, target: 5 };
    },
  },
  {
    id: "level_10",
    name: "Veterano",
    desc: "Alcance o nível 10",
    icon: "🧠",
    category: "study",
    rare: false,
    check: () => {
      const lvl = getLevelFromXp(getXpTotal()).level;
      return { done: lvl >= 10, progress: lvl, target: 10 };
    },
  },
  {
    id: "level_25",
    name: "Mestre dos juros",
    desc: "Alcance o nível 25",
    icon: "🎓",
    category: "study",
    rare: true,
    check: () => {
      const lvl = getLevelFromXp(getXpTotal()).level;
      return { done: lvl >= 25, progress: lvl, target: 25 };
    },
  },
  // ===== CONQUISTAS SOCIAIS / FUNDADORES =====
  {
    id: "founder_30",
    name: "Pioneiro",
    desc: "Entre os 30 primeiros usuários cadastrados do FinEvo",
    icon: "🚩",
    category: "social",
    rare: true,
    check: () => {
      try {
        const rawSession = localStorage.getItem("finevo:session");
        if (!rawSession) return { done: false };
        const session = JSON.parse(rawSession);
        const currentUserId = session?.userId;
        if (!currentUserId) return { done: false };

        const rawUsers = localStorage.getItem("finevo:users");
        if (!rawUsers) return { done: false };
        const users = JSON.parse(rawUsers);
        if (!Array.isArray(users)) return { done: false };

        // Ordena por data de criação crescente
        const sorted = [...users].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const top30Ids = sorted.slice(0, 30).map((u) => u.id);

        return { done: top30Ids.includes(currentUserId) };
      } catch {
        return { done: false };
      }
    },
  },
  {
    id: "early_contributor",
    name: "Ajudante Inicial",
    desc: "Conquistado por ajudar nos testes e início do aplicativo (Concedido pelo ADM)",
    icon: "🛠️",
    category: "social",
    rare: true,
    check: () => {
      try {
        const rawSession = localStorage.getItem("finevo:session");
        if (!rawSession) return { done: false };
        const session = JSON.parse(rawSession);
        const currentUserId = session?.userId;
        if (!currentUserId) return { done: false };

        const rawUsers = localStorage.getItem("finevo:users");
        if (!rawUsers) return { done: false };
        const users = JSON.parse(rawUsers);
        if (!Array.isArray(users)) return { done: false };

        const u = users.find((usr) => usr.id === currentUserId);
        return { done: !!u?.isTester };
      } catch {
        return { done: false };
      }
    },
  },
  {
    id: "ranking_first",
    name: "Estreante no ranking",
    desc: "Participe do ranking pela primeira vez",
    icon: "🏁",
    category: "social",
    rare: false,
    // Basta ter pelo menos 1 XP para aparecer no ranking
    check: () => ({ done: getXpTotal() > 0 }),
  },
  {
    id: "ranking_top_1_3",
    name: "Soberano das Ligas",
    desc: "Alcance o 1º lugar no ranking semanal 3 vezes",
    icon: "👑",
    category: "social",
    rare: true,
    secret: true,
    check: () => {
      const count = getRankingTop1Count();
      return { done: count >= 3, progress: count, target: 3 };
    },
  },
];

// ===== TÍTULOS (cada um requer condição real) =====
export const TITLES: Title[] = [
  {
    id: "iniciante",
    name: "Investidor Iniciante",
    desc: "Realizou o primeiro aporte",
    icon: "🌱",
    tier: "bronze",
    check: () => getTransactions().filter((t) => t.kind === "buy").length >= 1,
  },
  {
    id: "estudante",
    name: "Estudante Dedicado",
    desc: "Alcance o nível 5",
    icon: "📚",
    tier: "bronze",
    check: () => getLevelFromXp(getXpTotal()).level >= 5,
  },
  {
    id: "disciplina",
    name: "Mestre da Disciplina",
    desc: "Mantenha 30 dias de streak",
    icon: "🔥",
    tier: "silver",
    check: () => getStreak() >= 30,
  },
  {
    id: "guardiao",
    name: "Guardião do Futuro",
    desc: "Tenha 5 ativos diferentes na carteira",
    icon: "🛡️",
    tier: "silver",
    check: () => new Set(getPositions().map((p) => p.ticker)).size >= 5,
  },
  {
    id: "estrategista",
    name: "Estrategista",
    desc: "Alcance o nível 12",
    icon: "♟️",
    tier: "gold",
    check: () => getLevelFromXp(getXpTotal()).level >= 12,
  },
  {
    id: "veterano",
    name: "Veterano dos Mercados",
    desc: "Faça 20 aportes",
    icon: "🏅",
    tier: "gold",
    check: () => getTransactions().filter((t) => t.kind === "buy").length >= 20,
  },
  {
    id: "lenda",
    name: "Lenda Financeira",
    desc: "Alcance o nível 25",
    icon: "👑",
    tier: "legend",
    check: () => getLevelFromXp(getXpTotal()).level >= 25,
  },
];

// ===== BENEFÍCIOS DE NÍVEL (reais, baseados no level) =====
export type LevelBenefit = {
  level: number; // nível em que desbloqueia
  icon: "shield" | "star" | "target" | "zap" | "crown";
  title: string;
  desc: string;
};

export const LEVEL_BENEFITS: LevelBenefit[] = [
  { level: 3, icon: "target", title: "Múltiplas metas", desc: "Até 10 metas financeiras simultâneas" },
  { level: 5, icon: "star", title: "Selo Aprendiz", desc: "Selo exibido no perfil" },
  { level: 10, icon: "shield", title: "Selo Veterano", desc: "Selo Ouro exibido no perfil" },
  { level: 15, icon: "zap", title: "Insígnia premium", desc: "Aparência exclusiva no ranking" },
  { level: 25, icon: "crown", title: "Lenda Financeira", desc: "Título lendário desbloqueado" },
];

/**
 * Retorna benefícios desbloqueados e o próximo a desbloquear.
 */
export function getBenefitsStatus(currentLevel: number): { benefit: LevelBenefit; done: boolean; isNext: boolean }[] {
  const sortedBenefits = [...LEVEL_BENEFITS].sort((a, b) => a.level - b.level);
  // Encontra o próximo benefício não desbloqueado
  const nextIdx = sortedBenefits.findIndex((b) => b.level > currentLevel);
  return sortedBenefits.map((b, i) => ({
    benefit: b,
    done: currentLevel >= b.level,
    isNext: i === nextIdx,
  }));
}

// Helpers de status
export function getAchievementsStatus() {
  const list = ACHIEVEMENTS.map((a) => {
    const status = a.check();
    return { ...a, ...status };
  });
  const unlocked = list.filter((a) => a.done).length;
  const rareUnlocked = list.filter((a) => a.done && a.rare).length;
  const pct = ACHIEVEMENTS.length > 0 ? Math.round((unlocked / ACHIEVEMENTS.length) * 100) : 0;
  return { list, unlocked, rareUnlocked, pct, total: ACHIEVEMENTS.length };
}

export function getTitlesStatus() {
  return TITLES.map((t) => ({ ...t, unlocked: t.check() }));
}
