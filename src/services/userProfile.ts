// Perfil do usuário com persistência em localStorage.
// Suporta nome, bio, foto de perfil e banner customizados.

import { useEffect, useState } from "react";
import { safeStorage } from "./safeStorage";

import { pushProfileToSupabase, registerSyncListener } from "./supabaseSync";
import { updateCachedUserUsername } from "./auth";

export type UserProfile = {
  name: string;
  bio: string;
  // photo: data URL (base64) ou null (usa iniciais)
  photo: string | null;
  // banner: tipo (gradiente nomeado) ou data URL custom
  banner: string; // ex: "emerald", "violet", "sunset", "ocean", "custom:dataUrl"
  updatedAt?: number;
};

const KEY = "finevo:profile";
const listeners = new Set<() => void>();

registerSyncListener(() => {
  listeners.forEach((fn) => fn());
});

const DEFAULT_PROFILE: UserProfile = {
  name: "Novo usuário",
  bio: "",
  photo: null,
  banner: "emerald",
};

export const BANNER_PRESETS = [
  { id: "emerald", name: "Esmeralda", className: "bg-gradient-to-br from-emerald-300 via-teal-300 to-sky-300" },
  { id: "violet", name: "Violeta", className: "bg-gradient-to-br from-violet-300 via-fuchsia-300 to-pink-300" },
  { id: "sunset", name: "Pôr do sol", className: "bg-gradient-to-br from-orange-300 via-rose-300 to-pink-400" },
  { id: "ocean", name: "Oceano", className: "bg-gradient-to-br from-sky-300 via-blue-400 to-indigo-400" },
  { id: "forest", name: "Floresta", className: "bg-gradient-to-br from-lime-300 via-emerald-400 to-teal-500" },
  { id: "midnight", name: "Meia-noite", className: "bg-gradient-to-br from-slate-700 via-violet-700 to-fuchsia-700" },
  { id: "gold", name: "Dourado", className: "bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-400" },
  { id: "rose", name: "Rosé", className: "bg-gradient-to-br from-rose-200 via-pink-300 to-fuchsia-300" },
];

function read(): UserProfile {
  try {
    const raw = safeStorage.getItem(KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function write(profile: UserProfile) {
  const updatedProfile = { ...profile, updatedAt: profile.updatedAt || Date.now() };
  safeStorage.setItem(KEY, JSON.stringify(updatedProfile));
  listeners.forEach((fn) => fn());
  if (profile.name) {
    try {
      updateCachedUserUsername(profile.name);
    } catch (e) {
      console.warn("Could not sync cache user username:", e);
    }
  }
  // Push changes to Supabase
  pushProfileToSupabase().catch((e) => console.error("Error syncing profile:", e));
}

export function getProfile(): UserProfile {
  return read();
}

export function updateProfile(updates: Partial<UserProfile>) {
  const current = read();
  write({ ...current, ...updates, updatedAt: Date.now() });
}

/**
 * Lê uma imagem como data URL (base64) e redimensiona para economizar espaço.
 */
export function readImageAsDataUrl(file: File, maxSize = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.onload = () => {
        // Redimensiona para no máximo maxSize × maxSize
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = (height / width) * maxSize;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas não suportado"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Hook React reativo
export function useProfile(): [UserProfile, (updates: Partial<UserProfile>) => void] {
  const [profile, setProfile] = useState<UserProfile>(() => read());
  useEffect(() => {
    const fn = () => setProfile(read());
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return [profile, updateProfile];
}
