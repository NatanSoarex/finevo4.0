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
  return false;
}

// Verifica se está no modo simulador do Telegram
export function isTelegramSimulated(): boolean {
  return false;
}

// Verifica se o aplicativo deve se comportar como Telegram (real ou simulado)
export function isTelegramModeActive(): boolean {
  return false;
}

// Retorna o usuário do Telegram ativo (real ou simulado)
export function getTelegramUser(): TelegramUser | null {
  return null;
}

// Ativa ou desativa a simulação do Telegram
export function setTelegramSimulation(active: boolean, user?: TelegramUser) {
  // Desativado
}

// Dispara feedback tátil de vibração integrado
export function triggerHapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') {
  // Desativado no modo puramente Web
}
