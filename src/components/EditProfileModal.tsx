import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Camera, ImageIcon, User as UserIcon, Trash2, Check } from "lucide-react";
import {
  BANNER_PRESETS,
  readImageAsDataUrl,
  type UserProfile,
} from "../services/userProfile";
import { uploadDataUrlToSupabase } from "../services/supabaseSync";

type Props = {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (updates: Partial<UserProfile>) => void;
};

type Tab = "info" | "photo" | "banner";

export default function EditProfileModal({ open, onClose, profile, onSave }: Props) {
  const [tab, setTab] = useState<Tab>("info");
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [photo, setPhoto] = useState<string | null>(profile.photo);
  const [banner, setBanner] = useState(profile.banner);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Bloqueio de scroll do body ao abrir e suporte à tecla Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalStyle;
    };
  }, [open, onClose]);

  // Sincroniza ao abrir
  useEffect(() => {
    if (open) {
      setName(profile.name);
      setBio(profile.bio);
      setPhoto(profile.photo);
      setBanner(profile.banner);
      setTab("info");
      setError(null);
    }
  }, [open, profile]);

  if (!open) return null;

  const handlePhotoUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file, 400);
      try {
        const publicUrl = await uploadDataUrlToSupabase("avatars", dataUrl, `avatar_${Date.now()}.jpg`);
        setPhoto(publicUrl);
      } catch (uploadErr) {
        console.warn("Storage upload failed, fallback to local:", uploadErr);
        setPhoto(dataUrl);
      }
    } catch {
      setError("Erro ao carregar imagem. Tente outra.");
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file, 800);
      try {
        const publicUrl = await uploadDataUrlToSupabase("banners", dataUrl, `banner_${Date.now()}.jpg`);
        setBanner(`custom:${publicUrl}`);
      } catch (uploadErr) {
        console.warn("Storage upload failed, fallback to local:", uploadErr);
        setBanner(`custom:${dataUrl}`);
      }
    } catch {
      setError("Erro ao carregar imagem. Tente outra.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    onSave({ name: name.trim() || profile.name, bio: bio.trim(), photo, banner });
    onClose();
  };

  const hasChanges =
    name !== profile.name || bio !== profile.bio || photo !== profile.photo || banner !== profile.banner;

  const initials = (name || "U")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const customBannerUrl = banner.startsWith("custom:") ? banner.slice(7) : null;
  const bannerPreset = !customBannerUrl ? BANNER_PRESETS.find((b) => b.id === banner) ?? BANNER_PRESETS[0] : null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-[460px] rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl animate-slide-up flex flex-col"
        style={{ height: "85vh", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-3 border-b border-stone-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-stone-900">Editar perfil</h3>
              <p className="text-xs text-stone-500 mt-0.5">Personalize seu perfil</p>
            </div>
            <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-3 mt-4 rounded-2xl bg-stone-100 p-1">
            {[
              { id: "info" as Tab, label: "Informações", Icon: UserIcon },
              { id: "photo" as Tab, label: "Foto", Icon: Camera },
              { id: "banner" as Tab, label: "Banner", Icon: ImageIcon },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition ${
                  tab === t.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                }`}
              >
                <t.Icon size={12} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-5 py-4 space-y-4">
          {/* Preview no topo de qualquer tab */}
          <div className="relative rounded-3xl overflow-hidden border border-stone-200">
            {/* Banner */}
            <div
              className={`relative h-24 ${bannerPreset ? bannerPreset.className : ""}`}
              style={customBannerUrl ? { backgroundImage: `url(${customBannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/30" />
            </div>
            {/* Avatar */}
            <div className="relative -mt-10 px-5 pb-4 flex flex-col items-center">
              <div className="relative h-20 w-20 rounded-full border-4 border-solid border-white overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 grid place-items-center shadow-md">
                {photo ? (
                  <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-white">{initials}</span>
                )}
              </div>
              <p className="text-sm font-bold text-stone-900 mt-2">{name || "Seu nome"}</p>
              {bio && <p className="text-[10px] text-stone-500 text-center line-clamp-2 mt-0.5">{bio}</p>}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              ⚠️ {error}
            </div>
          )}

          {/* === Tab: Informações === */}
          {tab === "info" && (
            <>
              <div>
                <label className="text-[11px] text-stone-500 mb-1.5 block font-medium">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 40))}
                  placeholder="Seu nome"
                  maxLength={40}
                  className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-base text-stone-900 focus:outline-none focus:border-emerald-400 focus:bg-white"
                />
                <p className="text-[10px] text-stone-400 mt-1 text-right">{name.length}/40</p>
              </div>

              <div>
                <label className="text-[11px] text-stone-500 mb-1.5 block font-medium">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 120))}
                  placeholder="Conte um pouco sobre você..."
                  rows={3}
                  maxLength={120}
                  className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-400 focus:bg-white resize-none"
                />
                <p className="text-[10px] text-stone-400 mt-1 text-right">{bio.length}/120</p>
              </div>
            </>
          )}

          {/* === Tab: Foto === */}
          {tab === "photo" && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-stone-50 border border-stone-200 p-5 text-center">
                <div className="relative inline-block">
                  <div className="h-32 w-32 rounded-full border-4 border-solid border-white overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 grid place-items-center shadow-lg">
                    {photo ? (
                      <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl font-bold text-white">{initials}</span>
                    )}
                  </div>
                  {photo && (
                    <button
                      onClick={() => setPhoto(null)}
                      className="absolute -bottom-1 -right-1 h-8 w-8 grid place-items-center rounded-full bg-rose-500 text-white hover:bg-rose-600 transition shadow-md"
                      title="Remover foto"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 mt-3">
                  {photo ? "Foto atual" : "Sem foto — usando iniciais"}
                </p>
              </div>

              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition shadow-md shadow-emerald-500/30 disabled:opacity-50"
              >
                <Camera size={16} />
                {uploading ? "Carregando..." : photo ? "Trocar foto" : "Escolher foto"}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoUpload(f);
                  e.target.value = "";
                }}
              />

              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3 text-[11px] text-blue-800">
                💡 Recomendamos uma foto quadrada para melhor resultado. A imagem será redimensionada automaticamente.
              </div>
            </div>
          )}

          {/* === Tab: Banner === */}
          {tab === "banner" && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-stone-500 mb-2 font-medium">Escolha um gradiente</p>
                <div className="grid grid-cols-2 gap-2">
                  {BANNER_PRESETS.map((b) => {
                    const isActive = banner === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => setBanner(b.id)}
                        className={`relative h-20 rounded-2xl overflow-hidden border-2 transition ${
                          isActive ? "border-emerald-500 ring-2 ring-emerald-200" : "border-stone-200 hover:border-stone-300"
                        }`}
                      >
                        <div className={`absolute inset-0 ${b.className}`} />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/20" />
                        <span className="absolute bottom-1.5 left-2 text-[10px] font-semibold text-white drop-shadow">
                          {b.name}
                        </span>
                        {isActive && (
                          <span className="absolute top-1.5 right-1.5 h-5 w-5 grid place-items-center rounded-full bg-emerald-500 text-white shadow">
                            <Check size={11} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[11px] text-stone-500 mb-2 font-medium">Ou envie uma foto personalizada</p>
                <button
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-stone-100 border border-stone-200 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition disabled:opacity-50"
                >
                  <ImageIcon size={16} />
                  {uploading ? "Carregando..." : customBannerUrl ? "Trocar banner" : "Escolher imagem"}
                </button>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleBannerUpload(f);
                    e.target.value = "";
                  }}
                />
                {customBannerUrl && (
                  <button
                    onClick={() => setBanner("emerald")}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold hover:bg-rose-100 transition"
                  >
                    <Trash2 size={12} /> Remover banner personalizado
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-stone-100 bg-white px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="py-3.5 rounded-2xl bg-stone-100 text-sm font-semibold text-stone-700 hover:bg-stone-200 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || uploading}
              className="py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-500/30"
            >
              ✓ Salvar alterações
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
