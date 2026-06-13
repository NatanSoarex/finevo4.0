import { memo, useState, useMemo } from "react";
import {
  Settings, Share2, Pencil, LogOut, ChevronRight,
  LineChart, Wallet, Briefcase, Landmark
} from "lucide-react";
import { useAuth } from "../services/auth";
import Modal from "../components/Modal";
import { useTransactions } from "../services/transactions";
import { usePortfolio } from "../services/portfolio";
import LeagueAvatar from "../components/LeagueAvatar";
import { useProfile, BANNER_PRESETS } from "../services/userProfile";
import EditProfileModal from "../components/EditProfileModal";

const ProfileTab = memo(function ProfileTab() {
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // === Perfil persistente (nome, bio, foto, banner) ===
  const [profile, updateProfile] = useProfile();
  // Sessão de autenticação
  const auth = useAuth();
  const isAdmin = auth.user?.usernameLower === "adm_evo";
  const customBannerUrl = profile.banner.startsWith("custom:") ? profile.banner.slice(7) : null;
  const bannerPreset = !customBannerUrl
    ? BANNER_PRESETS.find((b) => b.id === profile.banner) ?? BANNER_PRESETS[0]
    : null;
  const initials = (profile.name || "U")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // === Stats REAIS do portfólio ===
  const { transactions } = useTransactions();
  const positions = usePortfolio();
  
  const realStats = useMemo(() => {
    const aportes = transactions.filter((t) => t.kind === "buy").length;
    const ativos = new Set(positions.map((p) => p.ticker)).size;
    const totalInvested = positions.reduce((sum, p) => sum + (p.invested ?? 0), 0);
    const transacoesCount = transactions.length;
    
    return {
      aportes,
      ativos,
      totalInvested,
      transacoesCount,
    };
  }, [transactions, positions]);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 2200);
  };

  const copyProfile = () => {
    const url = `${window.location.origin}/u/${profile.name.toLowerCase().replace(/\s+/g, "")}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast("Link do perfil copiado!");
    } else {
      showToast("Link de compartilhamento dinâmico disponível");
    }
  };

  return (
    <div className="pb-28 md:pb-12">
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] animate-slide-up">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 backdrop-blur-xl px-4 py-2 text-xs text-emerald-800 font-medium shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* Banner — dinâmico (gradiente ou foto custom) */}
      <div className="relative h-32 overflow-hidden">
        <div
          className={`absolute inset-0 ${bannerPreset ? bannerPreset.className : ""}`}
          style={customBannerUrl ? { backgroundImage: `url(${customBannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
        {!customBannerUrl && (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.6),transparent_60%),radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.4),transparent_60%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/40" />
          </>
        )}
        {customBannerUrl && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-white/30" />
        )}
        <div className="absolute top-4 left-5 right-5 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-white/90 uppercase drop-shadow">Perfil</span>
          <div className="flex items-center gap-2">
            <button
              onClick={copyProfile}
              className="h-8 w-8 grid place-items-center rounded-full bg-white/30 backdrop-blur border border-white/40 text-white hover:bg-white/40 transition cursor-pointer"
              title="Copiar link do perfil"
            >
              <Share2 size={14} />
            </button>
            <button
              onClick={() => setEditProfileOpen(true)}
              className="h-8 w-8 grid place-items-center rounded-full bg-white/30 backdrop-blur border border-white/40 text-white hover:bg-white/40 transition cursor-pointer"
              title="Editar perfil"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Avatar */}
      <div className="relative -mt-12 px-5 flex flex-col items-center">
        <button
          onClick={() => setEditProfileOpen(true)}
          className="relative group cursor-pointer"
          title="Editar perfil"
        >
          <LeagueAvatar
            size={96}
            photo={profile.photo}
            initials={initials}
          />
          {/* Overlay hover sutil */}
          <span className="absolute inset-1 rounded-full bg-stone-900/0 group-hover:bg-stone-900/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Pencil size={18} className="text-white" />
          </span>
        </button>

        <button
          onClick={() => setEditProfileOpen(true)}
          className="group mt-2.5 inline-flex items-center justify-center gap-1.5 relative cursor-pointer"
          title="Editar nome"
        >
          <h2 className="text-xl font-semibold tracking-tight text-stone-900 text-center flex items-center justify-center gap-1.5">
            {profile.name}
            {isAdmin && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-rose-500 text-white shadow-sm shadow-rose-500/20 shrink-0">
                🛡️ ADM
              </span>
            )}
          </h2>
          <Pencil size={11} className="opacity-0 group-hover:opacity-100 text-stone-400 transition absolute -right-4" />
        </button>

        {profile.bio && (
          <p className="mt-1 text-xs text-stone-500 text-center max-w-[280px] line-clamp-2">
            {profile.bio}
          </p>
        )}
      </div>

      {/* Resumo de Investimentos Prominente (Bento-styled) */}
      <section className="px-5 mt-6 space-y-3">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/20 p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Landmark size={80} className="text-emerald-900" />
          </div>
          
          <div className="flex items-center gap-2 text-emerald-800 font-semibold text-[10px] uppercase tracking-wider">
            <Briefcase size={12} strokeWidth={2.5} />
            Patrimônio Aplicado
          </div>
          
          <p className="text-2xl font-black text-stone-900 mt-1 tracking-tight">
            R$ {realStats.totalInvested.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-stone-500 mt-1">
            Valor financeiro consolidado de aportes ativos
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm flex flex-col justify-between">
            <div>
              <span className="h-8 w-8 grid place-items-center rounded-xl bg-sky-50 text-sky-600 mb-3">
                <LineChart size={16} />
              </span>
              <p className="text-xs text-stone-500 font-medium">Ativos Diferentes</p>
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-stone-900">{realStats.ativos}</span>
              <span className="text-[10px] text-stone-400 font-medium">monitorados</span>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm flex flex-col justify-between">
            <div>
              <span className="h-8 w-8 grid place-items-center rounded-xl bg-orange-50 text-orange-600 mb-3">
                <Wallet size={16} />
              </span>
              <p className="text-xs text-stone-500 font-medium font-sans">Aportes Realizados</p>
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-stone-900">{realStats.aportes}</span>
              <span className="text-[10px] text-stone-400 font-medium">sucessos</span>
            </div>
          </div>
        </div>
      </section>

      {/* Histórico e Métricas Simplificadas */}
      <section className="px-5 mt-5">
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-800">Total de Lançamentos</span>
            <span className="text-xs font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-full">
              {realStats.transacoesCount}
            </span>
          </div>
          <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
            Todas as ordens de compra, venda e proventos consolidadas na planilha de investimento.
          </p>
        </div>
      </section>

      {/* Conta + Sair */}
      <section className="px-5 mt-5 mb-4">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-white p-3.5 hover:bg-rose-50 transition shadow-sm active:scale-[0.99] group cursor-pointer"
        >
          <span className="h-10 w-10 grid place-items-center rounded-xl bg-rose-100 text-rose-600 group-hover:scale-105 transition-transform">
            <LogOut size={18} />
          </span>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-900">Sair da conta</p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {auth.user ? `@${auth.user.username}` : "Encerrar sessão"}
            </p>
          </div>
          <ChevronRight size={16} className="text-stone-400" />
        </button>
      </section>

      {/* Modals */}
      <Modal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Sair da Conta"
        subtitle="Confirmar encerramento de sessão"
      >
        <div className="py-2 text-center text-stone-900">
          <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 scale-110">
            <LogOut size={24} />
          </div>
          <p className="text-sm text-stone-600 font-medium leading-relaxed">
            Deseja mesmo sair da sua conta?
          </p>
          <p className="text-xs text-stone-400 mt-1 max-w-[280px] mx-auto">
            Sua conta continuará segura, e você poderá voltar quando desejar com seu e-mail/usuário e senha.
          </p>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="py-3 px-4 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                setShowLogoutConfirm(false);
                auth.logout();
              }}
              className="py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition shadow-sm shadow-rose-500/10 cursor-pointer"
            >
              Sim, Sair
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal completo de edição (nome, bio, foto, banner) */}
      <EditProfileModal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        profile={profile}
        onSave={(updates) => {
          updateProfile(updates);
          showToast("Perfil atualizado! ✨");
        }}
      />
    </div>
  );
});

export default ProfileTab;
