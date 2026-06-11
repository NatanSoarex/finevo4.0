// Sistema de suporte / reportar bug.
// Salva tickets em localStorage para uso futuro (painel de admin, etc).

import { useEffect, useState } from "react";
import { safeStorage } from "./safeStorage";

export type SupportCategory = "bug" | "suggestion" | "doubt" | "other";

export type SupportTicket = {
  id: string;
  category: SupportCategory;
  subject: string;
  message: string;
  // metadados úteis para debug
  userAgent: string;
  appPath: string;
  createdAt: number;
  // status (preparado para o painel futuro)
  status: "open" | "in_progress" | "resolved" | "closed";
};

const KEY = "finevo:support-tickets";
const listeners = new Set<() => void>();

function read(): SupportTicket[] {
  try {
    const raw = safeStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(tickets: SupportTicket[]) {
  safeStorage.setItem(KEY, JSON.stringify(tickets));
  listeners.forEach((fn) => fn());
}

export function createTicket(input: {
  category: SupportCategory;
  subject: string;
  message: string;
}): SupportTicket {
  const ticket: SupportTicket = {
    id: `tk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    category: input.category,
    subject: input.subject.trim(),
    message: input.message.trim(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    appPath: typeof window !== "undefined" ? window.location.pathname : "/",
    createdAt: Date.now(),
    status: "open",
  };
  const list = read();
  list.unshift(ticket); // mais recente primeiro
  write(list);
  return ticket;
}

export function getTickets(): SupportTicket[] {
  return read();
}

export function useTickets() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { tickets: read(), _tick: tick };
}
