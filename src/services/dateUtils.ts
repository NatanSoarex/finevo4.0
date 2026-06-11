// Utilitários de data evitando o bug clássico de timezone:
// `new Date("2026-06-01")` é interpretado como UTC midnight,
// e ao converter para fuso local (BR = GMT-3) vira "2026-05-31 21:00".
// Sempre que recebemos uma string "YYYY-MM-DD" do <input type="date">,
// devemos interpretar como data LOCAL, não UTC.

/**
 * Recebe "YYYY-MM-DD" e devolve um Date no horário LOCAL (00:00 do dia).
 * Use sempre que vier de input[type=date] ou Transaction.date.
 */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Recebe "YYYY-MM-DD" e devolve o timestamp (ms) no horário local.
 */
export function localTs(isoDate: string): number {
  return parseLocalDate(isoDate).getTime();
}

/**
 * Formata "YYYY-MM-DD" para "DD/MM/AAAA" sem passar por Date (evita timezone).
 */
export function formatBR(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * "YYYY-MM-DD" de hoje, sempre no fuso local.
 */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Retorna a data de segunda-feira da semana corrente (fuso local) no formato "YYYY-MM-DD".
 * É usada de base para reiniciar o ranking semanal de segunda a domingo.
 */
export function getMondayOfCurrentWeek(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  // Diferença para Segunda-feira anterior (se for Domingo, d.getDay() é 0, então voltamos 6 dias)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dayStr = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayStr}`;
}

/** Retorna true se as duas datas ISO são do mesmo mês/ano */
export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Retorna true se a data ISO é hoje (no fuso local) */
export function isToday(isoDate: string): boolean {
  return isoDate.slice(0, 10) === todayISO();
}

/** Retorna o dia do mês atual (1-31), fuso local */
export function todayDayOfMonth(): number {
  return new Date().getDate();
}

/** Retorna true se a data é dia útil (seg-sex) */
export function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Retorna o último dia útil cuja pregão JÁ FECHOU (B3 fecha às 18h horário local).
 * Se hoje é dia útil e já passou das 18h → retorna hoje.
 * Caso contrário → procura o dia útil anterior.
 */
export function getLastClosedTradingDay(now: Date = new Date()): Date {
  const MARKET_CLOSE_HOUR = 18; // B3 fecha às ~17h30/18h
  const d = new Date(now);
  // Se hoje é dia útil e o mercado já fechou → hoje conta
  if (isWeekday(d) && d.getHours() >= MARKET_CLOSE_HOUR) {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // Caso contrário, procura o dia útil anterior
  d.setDate(d.getDate() - 1);
  while (!isWeekday(d)) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Verifica se DEVE mostrar rendimento do mês para uma determinada data de referência.
 * Sempre retorna true para evitar esconder dados em finais de semana ou início de mês.
 */
export function hasClosedTradingDayInMonth(now: Date = new Date()): boolean {
  return true;
}

/**
 * Retorna true se um aporte feito em `purchaseDate` JÁ deve aparecer
 * no gráfico de evolução do patrimônio.
 *
 * Sempre retorna true para que o aporte novo apareça imediatamente no gráfico de evolução.
 */
export function shouldShowInEvolutionChart(purchaseDateISO: string, now: Date = new Date()): boolean {
  return true;
}
