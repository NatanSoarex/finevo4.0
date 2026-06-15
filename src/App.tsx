import { useEffect, useRef, useState } from "react";
import BottomNav, { type TabId } from "./components/BottomNav";
import WalletTab from "./tabs/WalletTab";
import OfficeTab from "./tabs/OfficeTab";
import ProfileTab from "./tabs/ProfileTab";
import AcademyTab from "./tabs/AcademyTab";
import AuthScreen from "./components/AuthScreen";
import { useAuth, getCurrentUser, loginTelegramUser } from "./services/auth";
import { useProfile } from "./services/userProfile";
import { safeStorage } from "./services/safeStorage";
import { Headphones, X, Shield, Users, Wallet, User, Lock, KeyRound, Tv } from "lucide-react";
import SupportModal from "./components/SupportModal";
import { pushAllDataToSupabase } from "./services/supabaseSync";
import { motion } from "motion/react";
import { supabase } from "./services/supabaseClient";
import TelegramSimulator from "./components/TelegramSimulator";
import { 
  isTelegramModeActive, 
  isTelegramSimulated, 
  getTelegramUser, 
  isRealTelegramMiniApp,
  triggerHapticFeedback,
  setTelegramSimulation
} from "./services/telegramService";

const tabOrder: TabId[] = ["office", "wallet", "academy", "profile"];
const CLIENT_VERSION = "2.3.1";

export default function App() {
  const { isAuthenticated, loading, user } = useAuth();
  const [profile, updateProfile] = useProfile();

  const [tgActive, setTgActive] = useState(isTelegramModeActive());
  const [tgUser, setTgUser] = useState(getTelegramUser());
  const [isTgLoggingIn, setIsTgLoggingIn] = useState(() => isRealTelegramMiniApp() && !isAuthenticated);

  const handleRefreshTelegramSession = () => {
    setTgActive(isTelegramModeActive());
    setTgUser(getTelegramUser());
    const currentUser = getCurrentUser();
    if (currentUser) {
      updateProfile({ name: currentUser.username });
    }
  };

  // Real Telegram environment boot integration
  useEffect(() => {
    if (isRealTelegramMiniApp()) {
      const initTgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (initTgUser) {
        setIsTgLoggingIn(true);
        loginTelegramUser(initTgUser).then(() => {
          handleRefreshTelegramSession();
        }).catch((e) => {
          console.error("Auto Telegram native login failed:", e);
        }).finally(() => {
          setIsTgLoggingIn(false);
        });
      } else {
        setIsTgLoggingIn(false);
      }
      try {
        window.Telegram?.WebApp?.ready();
        window.Telegram?.WebApp?.expand();
      } catch (e) {
        console.warn("Telegram WebApp API initialization failed:", e);
      }
    } else {
      setIsTgLoggingIn(false);
    }
  }, []);

  // Sync background login when simulator activates and user is logged out
  useEffect(() => {
    if (tgActive && !isAuthenticated) {
      const activeTgUser = getTelegramUser();
      if (activeTgUser) {
        loginTelegramUser(activeTgUser).then(() => {
          handleRefreshTelegramSession();
        }).catch((e) => {
          console.error("Auto Telegram simulated login failed in background:", e);
        });
      }
    }
  }, [tgActive, isAuthenticated]);

  // Se for a rota de callback do Google, renderiza tela de sucesso e fecha o popup
  const isCallbackPath = window.location.pathname.startsWith("/auth/callback");
  
  useEffect(() => {
    if (isCallbackPath) {
      const t = setTimeout(() => {
        if (window.opener) {
          window.opener.postMessage({ type: "OAUTH_AUTH_SUCCESS" }, "*");
          window.close();
        } else {
          window.location.href = "/";
        }
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [isCallbackPath]);

  if (isCallbackPath) {
    return (
      <div className="min-h-screen w-full bg-[#05070d] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-6">
          <div className="absolute -inset-4 rounded-full bg-emerald-500/30 blur-2xl animate-pulse" />
          <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-lg">FE</span>
          </div>
        </div>
        <h3 className="text-xl font-bold mb-2">Autenticação bem-sucedida!</h3>
        <p className="text-sm text-white/60 max-w-xs leading-relaxed">
          Sincronizando suas informações... Esta janela será fechada automaticamente em instantes.
        </p>
      </div>
    );
  }

  const isAdmin = user?.usernameLower === "adm_evo";
  const [supportOpen, setSupportOpen] = useState(false);
  const [active, setActive] = useState<TabId>(() => {
    try {
      const saved = safeStorage.getItem("finevo:active-tab");
      if (saved && tabOrder.includes(saved as TabId)) {
        return saved as TabId;
      }
    } catch {
      /* noop */
    }
    return "office";
  });
  const [direction, setDirection] = useState(0);
  const [pendingAporte, setPendingAporte] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showSupportConfirm, setShowSupportConfirm] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Estados para troca forçada de senha
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [savingReset, setSavingReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Lazy tab rendering: only mount tabs as the user visits them
  const [visitedTabs, setVisitedTabs] = useState<Record<TabId, boolean>>(() => {
    const defaultTab = "office";
    let initialTab: TabId = defaultTab;
    try {
      const saved = safeStorage.getItem("finevo:active-tab");
      if (saved && tabOrder.includes(saved as TabId)) {
        initialTab = saved as TabId;
      }
    } catch {
      /* noop */
    }
    return {
      office: initialTab === "office",
      wallet: initialTab === "wallet",
      academy: initialTab === "academy",
      profile: initialTab === "profile",
    };
  });

  // Keep visited list updated when switching tabs
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev[active]) return prev;
      return { ...prev, [active]: true };
    });
  }, [active]);

  const checkVersion = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/version?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.version && data.version !== CLIENT_VERSION) {
          setShowUpdate(true);
          setChecking(false);
          return;
        }
      }
    } catch (e) {
      // Ignore first error and try fallback static file
    }

    try {
      const resStatic = await fetch(`/version.json?_t=${Date.now()}`);
      if (resStatic.ok) {
        const data = await resStatic.json();
        if (data && data.version && data.version !== CLIENT_VERSION) {
          setShowUpdate(true);
        }
      }
    } catch (e) {
      // Ignore
    } finally {
      setChecking(false);
    }
  };

  // Monitora transição de login para forçar a aba office e rodar a checagem
  const prevAuthRef = useRef(isAuthenticated);
  useEffect(() => {
    if (isAuthenticated && !prevAuthRef.current) {
      setActive("office");
      try {
        safeStorage.setItem("finevo:active-tab", "office");
      } catch {
        /* noop */
      }
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Toda vez que decola ou carrega
  useEffect(() => {
    if (!isAuthenticated) return;
    checkVersion();
    const interval = setInterval(checkVersion, 200000); // 3.3 minutos para atualização quase em tempo real
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Sincronização automatizada e invisível de modo contínuo em segundo plano (backup em nuvem garantido)
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(async () => {
      try {
        console.log("[Finevo Cloud Sync] Realizando salvamento em nuvem silencioso e automático...");
        await pushAllDataToSupabase();
      } catch (e) {
        console.warn("[Finevo Cloud Sync Exception] Sincronização em segundo plano postergada:", e);
      }
    }, 60000); // a cada 60 segundos realiza um check de sincronização em silêncio
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Toda vez que troca de aba, rola a página de volta para o topo
  useEffect(() => {
    if (!isAuthenticated) return;
    // Scroll do main interno (se for scrollável)
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: "auto" });
    // Scroll da janela (caso a página inteira esteja rolando)
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [active, isAuthenticated]);

  const handleTabChange = (newTab: TabId) => {
    setPendingAporte(false);
    const currentIndex = tabOrder.indexOf(active);
    const newIndex = tabOrder.indexOf(newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActive(newTab);
    try {
      safeStorage.setItem("finevo:active-tab", newTab);
    } catch {
      /* noop */
    }
  };

  // Se a sessão está carregando do Supabase, mostra tela de logo/carregamento
  if (loading || isTgLoggingIn) {
    return (
      <div className="min-h-screen w-full bg-[#05070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-emerald-500/30 blur-2xl animate-pulse" />
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-white font-extrabold text-lg tracking-wide">FE</span>
            </div>
          </div>
          <p className="text-[12px] font-bold text-emerald-400 animate-pulse uppercase tracking-wider">
            {isRealTelegramMiniApp() ? "Autenticando via Telegram..." : "Sincronizando nuvem..."}
          </p>
          {isRealTelegramMiniApp() && (
            <span className="text-[10px] text-white/40 max-w-xs text-center px-4 leading-relaxed">
              Carregando a sua mesa de operações 3D oficial de forma segura...
            </span>
          )}
        </div>
      </div>
    );
  }

  // Se não autenticado, mostra a tela de login/registro
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (tgActive) {
    return (
      <div className="min-h-screen w-full bg-[#14151a] flex flex-col overflow-x-hidden text-stone-900 select-none">
        {/* Simulador Telegram no topo para desenvolvimento */}
        <TelegramSimulator onRefreshSession={handleRefreshTelegramSession} activeTab={active} />
        
        {/* Área de conteúdo do simulador */}
        <div className="flex-1 w-full flex items-center justify-center bg-[#07080a] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] p-0 md:p-6 lg:p-8 animate-fade-in">
          
          {/* Smartphone Mockup Container (on mobile screens, browser already simulates mobile, so nested wrapping turns off border) */}
          <div className="w-full h-full md:h-[820px] max-w-[420px] bg-stone-950 md:rounded-[44px] border-4 border-stone-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col relative">
            
            {/* Mock Telegram Header */}
            <header className="bg-[#17212b] border-b border-[#10171e] px-4 py-3 pb-2.5 flex items-center justify-between shrink-0 text-white select-none">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <h4 className="text-xs font-bold leading-none flex items-center gap-1">
                    FinEvo App
                    <span className="text-[#0088cc] font-extrabold text-[10px]">✓</span>
                  </h4>
                  <span className="text-[9px] text-stone-400">bot</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => triggerHapticFeedback('light')}
                  className="p-1 text-stone-400 hover:text-white transition duration-150 active:scale-95"
                >
                  <span className="text-sm font-bold tracking-widest leading-none">⋮</span>
                </button>
                <button 
                  onClick={() => {
                    setTelegramSimulation(false);
                    handleRefreshTelegramSession();
                  }}
                  className="p-1 text-stone-400 hover:text-rose-400 transition"
                  title="Fechar App"
                >
                  <X size={14} />
                </button>
              </div>
            </header>

            {/* App Internal Client Frame Area */}
            <div className={`flex-1 relative overflow-hidden flex flex-col ${active === "office" ? "bg-[#090514]" : "bg-gradient-to-br from-[#fbfaf6] via-[#f6f5f0] to-[#f3f1ea]"}`}>
              
              <main ref={mainRef} className={`flex-1 relative ${active === "office" ? "h-full overflow-hidden pb-0" : "pb-24 h-full overflow-y-auto"}`}>
                
                {/* Wallet Tab */}
                {visitedTabs.wallet && (
                  <div style={{ display: active === "wallet" ? "block" : "none" }} className="min-h-full animate-fade-in">
                    <WalletTab
                      autoOpenAporte={pendingAporte}
                      onConsumedAporte={() => setPendingAporte(false)}
                    />
                  </div>
                )}

                {/* Office Tab */}
                {visitedTabs.office && (
                  <div style={{ display: active === "office" ? "flex" : "none", flexDirection: "column", height: "100%", width: "100%" }}>
                    <OfficeTab isActive={active === "office"} />
                  </div>
                )}

                {/* Academy Tab */}
                {visitedTabs.academy && (
                  <div style={{ display: active === "academy" ? "block" : "none" }} className="min-h-full animate-fade-in">
                    <AcademyTab />
                  </div>
                )}

                {/* Profile Tab */}
                {visitedTabs.profile && (
                  <div style={{ display: active === "profile" ? "block" : "none" }} className="animate-fade-in">
                    <ProfileTab />
                  </div>
                )}
              </main>

              {/* BottomNav inside Mock */}
              <BottomNav active={active} onChange={handleTabChange} />

              {/* Mini-app version badge */}
              <div className="absolute top-4 right-3 pointer-events-none select-none z-30 opacity-70">
                <span className="text-[7.5px] bg-[#0088cc]/10 text-[#0088cc] border border-[#0088cc]/20 font-bold px-1.5 py-0.2 rounded-md font-mono">
                  TG MINI APP
                </span>
              </div>

              {/* Update notifier inside Mock */}
              {showUpdate && (
                <div className="absolute bottom-[84px] inset-x-3 z-50">
                  <div className="rounded-2xl border border-emerald-100 bg-white/95 backdrop-blur-md p-3.5 shadow-xl flex flex-col gap-2.5 transition animate-fade-up">
                    <p className="text-[10px] font-bold text-stone-900">✨ Nova atualização disponível!</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-500 text-white font-bold text-[10px] text-center"
                    >
                      Atualizar Agora
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Simulated home indicator */}
            <div className="hidden md:block absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-stone-700/60 rounded-full z-50 pointer-events-none" />
          </div>

        </div>

        {/* Modal de Suporte para Admin ou Usuário Comum dentro do Simulador */}
        <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />

        {/* Custom Force Password Change Overlay */}
        {isAuthenticated && profile.bio && profile.bio.includes("[require_reset:true]") && (
          <div data-modal="force-password-change" className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-md animate-fade-in select-none">
            <div className="w-full max-w-[360px] rounded-3xl bg-white border border-stone-200 p-6 shadow-2xl space-y-5 text-stone-900 animate-scale-in">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner relative">
                  <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 top-1 right-1 animate-ping" />
                  <KeyRound size={26} />
                </div>
                <h3 className="text-base font-extrabold text-stone-900 tracking-tight uppercase">Defina sua Nova Senha</h3>
                <p className="text-[11px] leading-relaxed text-stone-500">
                  Sua conta foi redefinida no banco de dados por um Administrador. Configure sua nova senha pessoal antes de continuar.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase font-mono tracking-wider">Nova Senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres (letras e números)"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setResetError("");
                      }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 bg-stone-50 text-stone-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase font-mono tracking-wider">Confirmar Nova Senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="password"
                      placeholder="Repita sua nova senha"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setResetError("");
                      }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 bg-stone-50 text-stone-900"
                    />
                  </div>
                </div>

                {resetError && (
                  <p className="text-[10px] text-rose-600 font-semibold bg-rose-50 border border-rose-100 p-2 rounded-lg text-center leading-snug animate-fade-up">
                    ⚠️ {resetError}
                  </p>
                )}

                {resetSuccess && (
                  <p className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-center animate-fade-up">
                    ✅ Senha cadastrada! Acessando sua conta...
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  disabled={savingReset || resetSuccess}
                  onClick={async () => {
                    const pass = newPassword.trim();
                    const conf = confirmPassword.trim();
                    if (!pass || !conf) {
                      setResetError("Por favor, preencha todos os campos.");
                      return;
                    }
                    if (pass !== conf) {
                      setResetError("As senhas informadas não coincidem.");
                      return;
                    }

                    if (pass.length < 6) {
                      setResetError("A senha precisa ter no mínimo 6 caracteres.");
                      return;
                    }
                    if (!/[a-zA-Z]/.test(pass)) {
                      setResetError("A senha deve conter pelo menos 1 letra.");
                      return;
                    }
                    if (!/\d/.test(pass)) {
                      setResetError("A senha deve conter pelo menos 1 número.");
                      return;
                    }

                    setSavingReset(true);
                    setResetError("");

                    try {
                      const { error: authErr } = await supabase.auth.updateUser({ password: pass });
                      if (authErr) {
                        console.warn("Supabase auth updateUser failed:", authErr);
                      }

                      const cleanBio = (profile.bio || "").replace(/\[pw:.*?\]/g, "").replace(/\[require_reset:.*?\]/g, "").trim();
                      const updatedBio = `${cleanBio} [pw:${pass}]`.trim();

                      updateProfile({ bio: updatedBio });

                      setResetSuccess(true);
                      setTimeout(() => {
                        setNewPassword("");
                        setConfirmPassword("");
                        setResetSuccess(false);
                      }, 1800);
                    } catch (err: any) {
                      console.error("Erro ao aplicar redefinição de senha:", err);
                      setResetError("Erro ao salvar senha no banco de dados.");
                    } finally {
                      setSavingReset(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs transition shadow-md shadow-emerald-500/10 active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                >
                  {savingReset ? "Salvando..." : "Concluir e Acessar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`h-full w-full ${active === "office" ? "bg-[#090514]" : "bg-[#f6f5f0]"} text-stone-900 flex items-center justify-center p-0 md:p-6 lg:p-8 overflow-hidden md:overflow-visible`}>
      <div className={`relative w-full h-full max-w-[460px] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl md:h-[840px] ${
        active === "office" ? "bg-[#090514]" : "bg-gradient-to-br from-[#fbfaf6] via-[#f6f5f0] to-[#f3f1ea]"
      } md:rounded-[32px] md:border md:border-stone-200/80 md:shadow-[0_25px_60px_-15px_rgba(28,25,23,0.15)] overflow-hidden flex flex-col md:flex-row items-stretch`}>
        {/* ambient blobs */}
        {active !== "office" && (
          <>
            <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-emerald-200/30 via-sky-200/20 to-transparent blur-3xl" />
            <div className="pointer-events-none absolute top-1/3 -left-20 w-72 h-72 rounded-full bg-amber-100/40 blur-3xl" />
            <div className="pointer-events-none absolute top-2/3 -right-20 w-72 h-72 rounded-full bg-violet-100/40 blur-3xl" />
          </>
        )}

        {/* Sidebar Desktop */}
        <aside className="hidden md:flex w-72 bg-white/70 border-r border-stone-200/80 backdrop-blur-xl flex-col justify-between p-6 shrink-0 relative z-30">
          <div className="space-y-8">
            {/* Logo e Nome */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                <span className="text-white font-extrabold text-sm tracking-wide">FE</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900 tracking-tight">FinEvo</h2>
                <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Escritório do Investidor</p>
              </div>
            </div>

            {/* Menu de Navegação */}
            <div className="space-y-1.5">
              {[
                { id: "office", label: "Meu Escritório 3D", desc: "Ambiente voxel em tempo real", Icon: Users },
                { id: "wallet", label: "Minha Carteira", desc: "Patrimônio e dividendos", Icon: Wallet },
                { id: "academy", label: "Vídeos Recomendados", desc: "Aulas e canais parceiros", Icon: Tv },
                { id: "profile", label: "Meu Perfil", desc: "Conquistas e níveis", Icon: User },
              ].map(({ id, label, desc, Icon }) => {
                const isActive = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleTabChange(id as TabId)}
                    className={`w-full group relative flex items-center gap-3.5 p-3 rounded-2xl transition duration-150 text-left cursor-pointer ${
                      isActive 
                        ? "text-stone-900 font-bold animate-pulse-subtle" 
                        : "text-stone-500 hover:text-stone-800 hover:bg-stone-100/50"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="desktopActiveTabBg"
                        className="absolute inset-0 bg-stone-100/80 rounded-2xl -z-10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className={`p-2 rounded-xl transition ${
                      isActive ? "bg-white text-emerald-600 shadow-sm border border-stone-200/40" : "bg-stone-50 text-stone-400 group-hover:text-stone-600"
                    }`}>
                      <Icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{label}</p>
                      <p className="text-[9px] text-stone-400 font-medium truncate mt-0.5">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {/* Bloco de Perfil Simples */}
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/50 flex items-center gap-3">
              {profile.photo ? (
                <img
                  src={profile.photo}
                  alt=""
                  className="h-9 w-9 rounded-xl object-cover shrink-0 select-none shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 font-extrabold text-[13px] flex items-center justify-center shrink-0 uppercase select-none">
                  {(profile.name || "U").split(" ").filter(Boolean).map(p => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-stone-800 truncate">{profile.name || `@${user?.usernameLower || "investidor"}`}</p>
                <p className="text-[9px] text-stone-400 truncate mt-0.5">{user?.email || "Parceiro Finevo"}</p>
              </div>
            </div>

            {/* Suporte Técnico */}
            {active === "office" && (
              isAdmin ? (
                <button
                  onClick={() => setSupportOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 transition flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer active:scale-95"
                >
                  <Shield size={14} className="text-rose-500 animate-pulse" />
                  <span>Painel de ADM</span>
                </button>
              ) : (
                <a
                  href="https://t.me/natansoarex"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 transition flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer active:scale-95 text-center"
                >
                  <Headphones size={14} className="text-emerald-500" />
                  <span>Suporte Técnico</span>
                </a>
              )
            )}

            {/* Versão */}
            <div className="text-center">
              <span className="text-[9px] text-stone-400 font-medium">Finevo Desktop v{CLIENT_VERSION}</span>
            </div>
          </div>
        </aside>

        <main ref={mainRef} className={`flex-1 relative ${active === "office" ? "h-full overflow-hidden pb-0" : "pb-24 md:pb-8 h-full overflow-y-auto"}`}>
          {/* Wallet Tab */}
          {visitedTabs.wallet && (
            <div style={{ display: active === "wallet" ? "block" : "none" }} className="min-h-full">
              <WalletTab
                autoOpenAporte={pendingAporte}
                onConsumedAporte={() => setPendingAporte(false)}
              />
            </div>
          )}

          {/* Office Tab */}
          {visitedTabs.office && (
            <div style={{ display: active === "office" ? "flex" : "none", flexDirection: "column", height: "100%", width: "100%" }}>
              <OfficeTab isActive={active === "office"} />
            </div>
          )}

          {/* Academy Tab */}
          {visitedTabs.academy && (
            <div style={{ display: active === "academy" ? "block" : "none" }} className="min-h-full">
              <AcademyTab />
            </div>
          )}

          {/* Profile Tab */}
          {visitedTabs.profile && (
            <div style={{ display: active === "profile" ? "block" : "none" }}>
              <ProfileTab />
            </div>
          )}
        </main>

        {showUpdate && (
          <div className="absolute bottom-[84px] md:bottom-4 inset-x-4 md:left-auto md:right-4 md:w-80 z-50">
            <div className="rounded-2xl border border-emerald-100 bg-white/95 backdrop-blur-md p-4 shadow-xl shadow-emerald-950/10 flex flex-col gap-3 transition">
              <div className="flex items-start gap-2.5">
                <span className="grid place-items-center h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 shrink-0 relative">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
                  ✨
                </span>
                <div className="text-xs">
                  <p className="font-bold text-stone-900">Nova atualização disponível!</p>
                  <p className="text-stone-500 mt-0.5">Uma versão mais rápida e estável foi instalada no servidor. Recarregue para aplicar.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Recarrega forçando descarte do cache
                    window.location.reload();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] transition shadow-md shadow-emerald-500/10"
                >
                  Atualizar Agora (Rápido)
                </button>
                <button
                  onClick={() => setShowUpdate(false)}
                  className="py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-semibold text-[11px] transition"
                >
                  Mais tarde
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Support floating button - Hidden on desktop sidebar, visible only on the fixed main office tab on mobile */}
        {active === "office" && (
          isAdmin ? (
            <button
              onClick={() => setSupportOpen(true)}
              className={`absolute top-4 right-4 z-40 p-2.5 rounded-2xl border backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 md:hidden bg-[#0c0817]/85 border-stone-800/80 text-rose-400 hover:text-rose-300 hover:bg-[#150f26]/90 shadow-rose-950/20 animate-fade-in`}
              title="Painel de Controle ADM"
            >
              <Shield size={16} className="animate-pulse text-rose-500" />
            </button>
          ) : (
            <a
              href="https://t.me/natansoarex"
              target="_blank"
              rel="noopener noreferrer"
              className={`absolute top-4 right-4 z-40 p-2.5 rounded-2xl border backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 md:hidden bg-[#0c0817]/85 border-stone-800/80 text-emerald-400 hover:text-emerald-300 hover:bg-[#150f26]/90 shadow-emerald-950/20 animate-fade-in flex items-center justify-center`}
              title="Suporte Técnico"
            >
              <Headphones size={16} />
            </a>
          )
        )}

        {/* Modal de Suporte para Admin ou Usuário Comum */}
        <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
        {/* Custom Force Password Change Overlay */}
        {isAuthenticated && profile.bio && profile.bio.includes("[require_reset:true]") && (
          <div data-modal="force-password-change" className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-md animate-fade-in select-none">
            <div className="w-full max-w-[360px] rounded-3xl bg-white border border-stone-200 p-6 shadow-2xl space-y-5 text-stone-900 animate-scale-in">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner relative">
                  <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 top-1 right-1 animate-ping" />
                  <KeyRound size={26} />
                </div>
                <h3 className="text-base font-extrabold text-stone-900 tracking-tight uppercase">Defina sua Nova Senha</h3>
                <p className="text-[11px] leading-relaxed text-stone-500">
                  Sua conta foi redefinida no banco de dados por um Administrador. Configure sua nova senha pessoal antes de continuar.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Campo Nova Senha */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase font-mono tracking-wider">Nova Senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres (letras e números)"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setResetError("");
                      }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 bg-stone-50 text-stone-900"
                    />
                  </div>
                </div>

                {/* Confirmar Nova Senha */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase font-mono tracking-wider">Confirmar Nova Senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="password"
                      placeholder="Repita sua nova senha"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setResetError("");
                      }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 bg-stone-50 text-stone-900"
                    />
                  </div>
                </div>

                {resetError && (
                  <p className="text-[10px] text-rose-600 font-semibold bg-rose-50 border border-rose-100 p-2 rounded-lg text-center leading-snug animate-fade-up">
                    ⚠️ {resetError}
                  </p>
                )}

                {resetSuccess && (
                  <p className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-center animate-fade-up">
                    ✅ Senha cadastrada! Acessando sua conta...
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  disabled={savingReset || resetSuccess}
                  onClick={async () => {
                    const pass = newPassword.trim();
                    const conf = confirmPassword.trim();
                    if (!pass || !conf) {
                      setResetError("Por favor, preencha todos os campos.");
                      return;
                    }
                    if (pass !== conf) {
                      setResetError("As senhas informadas não coincidem.");
                      return;
                    }

                    if (pass.length < 6) {
                      setResetError("A senha precisa ter no mínimo 6 caracteres.");
                      return;
                    }
                    if (!/[a-zA-Z]/.test(pass)) {
                      setResetError("A senha deve conter pelo menos 1 letra.");
                      return;
                    }
                    if (!/\d/.test(pass)) {
                      setResetError("A senha deve conter pelo menos 1 número.");
                      return;
                    }

                    setSavingReset(true);
                    setResetError("");

                    try {
                      const { error: authErr } = await supabase.auth.updateUser({ password: pass });
                      if (authErr) {
                        console.warn("Supabase auth updateUser failed:", authErr);
                      }

                      const cleanBio = (profile.bio || "").replace(/\[pw:.*?\]/g, "").replace(/\[require_reset:.*?\]/g, "").trim();
                      const updatedBio = `${cleanBio} [pw:${pass}]`.trim();

                      updateProfile({ bio: updatedBio });

                      setResetSuccess(true);
                      setTimeout(() => {
                        setNewPassword("");
                        setConfirmPassword("");
                        setResetSuccess(false);
                      }, 1800);
                    } catch (err: any) {
                      console.error("Erro ao aplicar redefinição de senha:", err);
                      setResetError("Erro ao salvar senha no banco de dados.");
                    } finally {
                      setSavingReset(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs transition shadow-md shadow-emerald-500/10 active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                >
                  {savingReset ? "Salvando..." : "Concluir e Acessar"}
                </button>
              </div>
            </div>
          </div>
        )}

        <BottomNav active={active} onChange={handleTabChange} />
      </div>
    </div>
  );
}
