import { safeStorage } from "./safeStorage";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface TelegramThemeParams {
  bg_color: string;
  text_color: string;
  hint_color: string;
  link_color: string;
  button_color: string;
  button_text_color: string;
  secondary_bg_color: string;
}

// Declaração de tipos para a API nativa do Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        initData: string;
        initDataUnsafe: {
          query_id?: string;
          user?: TelegramUser;
          auth_date?: number;
          hash?: string;
        };
        themeParams: TelegramThemeParams;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        showPopup: (params: { title?: string; message: string; buttons?: any[] }, callback?: (id?: string) => void) => void;
        showAlert: (message: string, callback?: () => void) => void;
      };
    };
  }
}

// Verifica se está rodando no Telegram de verdade
export function isRealTelegramMiniApp(): boolean {
  return typeof window !== "undefined" && !!window.Telegram?.WebApp?.initData;
}

// Verifica se está no modo simulador do Telegram
export function isTelegramSimulated(): boolean {
  if (typeof window === "undefined") return false;
  return safeStorage.getItem("finevo:telegram-simulated-active") === "true";
}

// Verifica se o aplicativo deve se comportar como Telegram (real ou simulado)
export function isTelegramModeActive(): boolean {
  return isRealTelegramMiniApp() || isTelegramSimulated();
}

// Retorna o usuário do Telegram ativo (real ou simulado)
export function getTelegramUser(): TelegramUser | null {
  if (isRealTelegramMiniApp()) {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  }
  if (isTelegramSimulated()) {
    try {
      const raw = safeStorage.getItem("finevo:telegram-simulated-user");
      if (raw) return JSON.parse(raw);
    } catch {
      /* noop */
    }
    // Usuário mock padrão se nada configurado
    return {
      id: 715563999,
      first_name: "Nathan",
      last_name: "Soares",
      username: "natansoarex",
      language_code: "pt-br",
    };
  }
  return null;
}

// Ativa ou desativa a simulação do Telegram
export function setTelegramSimulation(active: boolean, user?: TelegramUser) {
  if (active) {
    safeStorage.setItem("finevo:telegram-simulated-active", "true");
    if (user) {
      safeStorage.setItem("finevo:telegram-simulated-user", JSON.stringify(user));
    }
  } else {
    safeStorage.removeItem("finevo:telegram-simulated-active");
    safeStorage.removeItem("finevo:telegram-simulated-user");
  }
}

// Dispara feedback tátil de vibração integrado
export function triggerHapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') {
  if (isRealTelegramMiniApp()) {
    try {
      if (type === 'success' || type === 'error' || type === 'warning') {
        window.Telegram?.WebApp?.HapticFeedback.notificationOccurred(type);
      } else {
        window.Telegram?.WebApp?.HapticFeedback.impactOccurred(type);
      }
    } catch (e) {
      console.warn("Haptic trigger failed on actual Telegram:", e);
    }
  } else {
    // Simulador visual de haptics no navegador
    const event = new CustomEvent("tg-haptic-trigger", { detail: { type } });
    if (typeof window !== "undefined") {
      window.dispatchEvent(event);
    }
  }
}
