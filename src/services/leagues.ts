// Sistema de Ligas (tiers) baseado em XP — estilo Diamante, Mestre, etc.
// Cada liga tem cores próprias usadas no anel ao redor do avatar.

export type League = {
  id: "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";
  name: string;
  minXp: number;
  // Gradiente Tailwind classes para o anel (from-X via-Y to-Z)
  ringGradient: string;
  // Cor sólida para badges/textos
  textColor: string;
  bgSoft: string;
  borderColor: string;
  // Emoji representativo
  icon: string;
};

export const LEAGUES: League[] = [
  {
    id: "bronze",
    name: "Bronze",
    minXp: 0, // Nível 1+ (Inicia imediato)
    ringGradient: "from-amber-700 via-orange-600 to-amber-800",
    textColor: "text-amber-700",
    bgSoft: "bg-amber-50",
    borderColor: "border-amber-300",
    icon: "🥉",
  },
  {
    id: "silver",
    name: "Prata",
    minXp: 380, // Nível 3+ (Aproximadamente 15 dias de consistência)
    ringGradient: "from-stone-300 via-slate-400 to-stone-500",
    textColor: "text-stone-600",
    bgSoft: "bg-stone-100",
    borderColor: "border-stone-400",
    icon: "🥈",
  },
  {
    id: "gold",
    name: "Ouro",
    minXp: 1600, // Nível 6+ (Aproximadamente 2 meses)
    ringGradient: "from-yellow-400 via-amber-500 to-orange-500",
    textColor: "text-amber-600",
    bgSoft: "bg-amber-50",
    borderColor: "border-amber-400",
    icon: "🥇",
  },
  {
    id: "platinum",
    name: "Platina",
    minXp: 5500, // Nível 11+ (Aproximadamente 7 meses)
    ringGradient: "from-cyan-300 via-sky-400 to-teal-400",
    textColor: "text-sky-600",
    bgSoft: "bg-sky-50",
    borderColor: "border-sky-300",
    icon: "🛡️",
  },
  {
    id: "diamond",
    name: "Diamante",
    minXp: 14500, // Nível 18+ (Aproximadamente 1.6 anos)
    ringGradient: "from-cyan-200 via-blue-400 to-indigo-500",
    textColor: "text-indigo-600",
    bgSoft: "bg-indigo-50",
    borderColor: "border-indigo-300",
    icon: "💎",
  },
  {
    id: "master",
    name: "Mestre",
    minXp: 28000, // Nível 25+ (Aproximadamente 3 anos de dedicação real)
    ringGradient: "from-fuchsia-500 via-violet-600 to-purple-700",
    textColor: "text-violet-700",
    bgSoft: "bg-violet-50",
    borderColor: "border-violet-300",
    icon: "👑",
  },
];

/**
 * Retorna a liga atual com base no XP total.
 */
export function getLeagueByXp(xp: number): League {
  // Percorre de trás pra frente — primeira que tem minXp <= xp
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (xp >= LEAGUES[i].minXp) return LEAGUES[i];
  }
  return LEAGUES[0];
}

/**
 * Retorna a próxima liga e quanto XP falta.
 */
export function getNextLeague(xp: number): { next: League | null; xpToNext: number } {
  const current = getLeagueByXp(xp);
  const idx = LEAGUES.findIndex((l) => l.id === current.id);
  if (idx === LEAGUES.length - 1) return { next: null, xpToNext: 0 };
  const next = LEAGUES[idx + 1];
  return { next, xpToNext: next.minXp - xp };
}
