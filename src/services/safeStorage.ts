// Wrapper seguro para localStorage que NUNCA throwa.
// Cobre: file:// protocol, modo privado, cookies bloqueados, quota cheia, etc.
// Faz fallback para um Map em memória quando o localStorage não está disponível.

const memoryStore = new Map<string, string>();
let warned = false;

function checkLocalStorage(): boolean {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
    const testKey = "__finevo_ls_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const LS_AVAILABLE = checkLocalStorage();

if (!LS_AVAILABLE && typeof console !== "undefined" && !warned) {
  // eslint-disable-next-line no-console
  console.warn("[FinEvo] localStorage não disponível — usando armazenamento em memória");
  warned = true;
}

function getCurrentUserId(): string | null {
  try {
    const raw = LS_AVAILABLE ? localStorage.getItem("finevo:session") : memoryStore.get("finevo:session");
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.userId || null;
  } catch {
    return null;
  }
}

function getScopedKey(key: string): string {
  const userSpecificKeys = [
    "finevo:profile",
    "finevo:portfolio",
    "finevo:transactions",
    "finevo:xp-events",
    "finevo:goals",
    "finevo:challenges",
    "finevo:support"
  ];
  if (userSpecificKeys.includes(key)) {
    const uid = getCurrentUserId();
    if (uid) return `${key}:${uid}`;
  }
  return key;
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      const scopedKey = getScopedKey(key);
      if (LS_AVAILABLE) return localStorage.getItem(scopedKey);
      return memoryStore.get(scopedKey) ?? null;
    } catch {
      const scopedKey = getScopedKey(key);
      return memoryStore.get(scopedKey) ?? null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      const scopedKey = getScopedKey(key);
      if (LS_AVAILABLE) {
        localStorage.setItem(scopedKey, value);
        return;
      }
      memoryStore.set(scopedKey, value);
    } catch {
      const scopedKey = getScopedKey(key);
      memoryStore.set(scopedKey, value);
    }
  },
  removeItem(key: string): void {
    try {
      const scopedKey = getScopedKey(key);
      if (LS_AVAILABLE) {
        localStorage.removeItem(scopedKey);
        return;
      }
      memoryStore.delete(scopedKey);
    } catch {
      const scopedKey = getScopedKey(key);
      memoryStore.delete(scopedKey);
    }
  },
  clear(): void {
    try {
      if (LS_AVAILABLE) localStorage.clear();
    } catch {
      /* noop */
    }
    memoryStore.clear();
  },
  isAvailable(): boolean {
    return LS_AVAILABLE;
  },
};
