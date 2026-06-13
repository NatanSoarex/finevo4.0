import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, LifeBuoy, Bug, Lightbulb, HelpCircle, MessageCircle, Send,
  CheckCircle2, Search, Trash2, Camera, ShieldAlert, Image, Award, KeyRound
} from "lucide-react";
import { createTicket, type SupportCategory } from "../services/support";
import { useAuth, triggerAuthUpdate } from "../services/auth";
import { safeStorage } from "../services/safeStorage";
import { supabase } from "../services/supabaseClient";

type Props = {
  open: boolean;
  onClose: () => void;
};

const CATEGORIES: { id: SupportCategory; label: string; Icon: typeof Bug; color: string; bg: string }[] = [
  { id: "bug", label: "Reportar bug", Icon: Bug, color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
  { id: "suggestion", label: "Sugestão", Icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  { id: "doubt", label: "Dúvida", Icon: HelpCircle, color: "text-sky-600", bg: "bg-sky-50 border-sky-200" },
  { id: "other", label: "Outro", Icon: MessageCircle, color: "text-stone-600", bg: "bg-stone-50 border-stone-200" },
];

export default function SupportModal({ open, onClose }: Props) {
  const { user: currentLoggedUser } = useAuth();
  const isAdmin = currentLoggedUser?.usernameLower === "adm_evo";

  // State para o fluxo de usuário normal
  const [step, setStep] = useState<"ask" | "telegram" | "form">("ask");
  const [category, setCategory] = useState<SupportCategory>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // State para o fluxo de ADM
  const [adminSearch, setAdminSearch] = useState("");
  const [adminUsers, setAdminUsers] = useState<any[]>([]);

  // Toast e Confirmações customizadas em Modal (evita window.confirm/alert sob iframe)
  const [toast, setToast] = useState<{ text: string; type: "ok" | "error" } | null>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [resetPasswordInfo, setResetPasswordInfo] = useState<{ username: string; tempPw: string } | null>(null);

  const showLocalToast = (text: string, type: "ok" | "error" = "ok") => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  // Mantém a lista de administrados atualizada com Supabase + Fallback Local
  useEffect(() => {
    if (isAdmin && open) {
      const loadUsers = async () => {
        try {
          const { data: profiles, error } = await supabase
            .from("profile")
            .select("*");

          if (!error && profiles && profiles.length > 0) {
            const localUsersStr = safeStorage.getItem("finevo:users");
            const localUsers = localUsersStr ? JSON.parse(localUsersStr) : [];
            
            const mapped = profiles.map((p: any) => {
              const foundLocal = localUsers.find((lu: any) => lu.id === p.id);
              return {
                id: p.id,
                username: p.nome || p.email?.split("@")[0] || "Usuário",
                usernameLower: (p.nome || "").toLowerCase(),
                email: p.email || "",
                createdAt: p.criado_em ? new Date(p.criado_em).getTime() : Date.now(),
                isBanned: p.is_banned ?? foundLocal?.isBanned ?? false,
                isTester: p.is_tester ?? foundLocal?.isTester ?? false,
                photo: p.foto_perfil || null,
                banner: p.banner_perfil || "emerald"
              };
            });
            setAdminUsers(mapped);
          } else {
            const raw = safeStorage.getItem("finevo:users");
            const list = raw ? JSON.parse(raw) : [];
            setAdminUsers(list);
          }
        } catch (err) {
          console.error("Erro ao carregar usuários administrativos do Supabase:", err);
          const raw = safeStorage.getItem("finevo:users");
          const list = raw ? JSON.parse(raw) : [];
          setAdminUsers(list);
        }
      };

      loadUsers();
    }
  }, [isAdmin, open]);

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

  if (!open) return null;

  const canSubmit = message.trim().length >= 10 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      createTicket({
        category,
        subject: subject.trim() || CATEGORIES.find((c) => c.id === category)?.label || "Suporte",
        message: message.trim(),
      });
      setSuccess(true);
      window.setTimeout(() => {
        setSuccess(false);
        setSubject("");
        setMessage("");
        setCategory("bug");
        setStep("ask");
        onClose();
      }, 2500);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setSubject("");
    setMessage("");
    setCategory("bug");
    setSuccess(false);
    setStep("ask");
    setAdminSearch("");
    onClose();
  };

  // Funções ADM
  const getUserProfile = (userId: string) => {
    const matched = adminUsers.find((u) => u.id === userId);
    if (matched && (matched.photo !== undefined || matched.banner !== undefined)) {
      return {
        name: matched.username,
        bio: "",
        photo: matched.photo,
        banner: matched.banner
      };
    }
    try {
      const raw = safeStorage.getItem(`finevo:profile:${userId}`);
      if (!raw) return { name: "", bio: "", photo: null, banner: "emerald" };
      return JSON.parse(raw);
    } catch {
      return { name: "", bio: "", photo: null, banner: "emerald" };
    }
  };

  const handleToggleBan = async (targetUser: any) => {
    if (targetUser.usernameLower === "adm_evo") {
      showLocalToast("Você não pode banir a conta ADM principal!", "error");
      return;
    }
    const nextBanned = !targetUser.isBanned;

    try {
      await supabase
        .from("profile")
        .update({ is_banned: nextBanned } as any)
        .eq("id", targetUser.id);
    } catch (e) {
      console.error("Erro ao banir usuário no Supabase:", e);
    }

    const updatedUsers = adminUsers.map((u) => {
      if (u.id === targetUser.id) {
        return { ...u, isBanned: nextBanned };
      }
      return u;
    });
    safeStorage.setItem("finevo:users", JSON.stringify(updatedUsers));
    setAdminUsers(updatedUsers);
    
    // Alerta o sistema que as contas foram alteradas (caso este usuário esteja ativo)
    triggerAuthUpdate();
    
    showLocalToast(`Usuário @${targetUser.username} foi ${nextBanned ? "banido" : "desbanido"}.`, "ok");
  };

  const handleToggleTester = async (targetUser: any) => {
    if (targetUser.usernameLower === "adm_evo") {
      showLocalToast("Você não pode alterar os privilégios do ADM principal!", "error");
      return;
    }
    const nextTester = !targetUser.isTester;

    try {
      await supabase
        .from("profile")
        .update({ is_tester: nextTester } as any)
        .eq("id", targetUser.id);
    } catch (e) {
      console.error("Erro ao alterar privilégios no Supabase:", e);
    }

    const updatedUsers = adminUsers.map((u) => {
      if (u.id === targetUser.id) {
        return { ...u, isTester: nextTester };
      }
      return u;
    });
    safeStorage.setItem("finevo:users", JSON.stringify(updatedUsers));
    setAdminUsers(updatedUsers);
    
    // Alerta o sistema que as contas foram alteradas para atualizar a conquista
    triggerAuthUpdate();
    
    showLocalToast(
      `Conquista 'Ajudante Inicial' ${nextTester ? "concedida" : "removida"} para @${targetUser.username}!`,
      "ok"
    );
  };

  const handleDeleteUser = (targetUser: any) => {
    if (targetUser.usernameLower === "adm_evo") {
      showLocalToast("Você não pode excluir a conta ADM principal!", "error");
      return;
    }
    setDeletingUser(targetUser);
  };

  const handleResetPassword = async (targetUser: any) => {
    if (targetUser.usernameLower === "adm_evo") {
      showLocalToast("Você não pode redefinir a senha do ADM principal!", "error");
      return;
    }

    const tempPw = "EVO-" + Math.floor(1000 + Math.random() * 9000);
    const pKey = `finevo:profile:${targetUser.id}`;

    try {
      // 1. Obter o perfil do Supabase
      const { data: currentProfile, error: getErr } = await supabase
        .from("profile")
        .select("bio")
        .eq("id", targetUser.id)
        .maybeSingle();

      const existingBio = currentProfile?.bio || "";
      const cleanBio = existingBio.replace(/\[pw:.*?\]/g, "").replace(/\[require_reset:.*?\]/g, "").trim();
      const updatedBio = `${cleanBio} [pw:${tempPw}] [require_reset:true]`.trim();

      // 2. Atualizar no banco Supabase
      const { error: updateErr } = await supabase
        .from("profile")
        .update({ bio: updatedBio })
        .eq("id", targetUser.id);

      if (updateErr) throw updateErr;

      // 3. Atualizar no LocalStorage para consistência imediata do ADM ou se simular login local
      try {
        const rawLocal = safeStorage.getItem(pKey);
        const parsedLocal = rawLocal ? JSON.parse(rawLocal) : { name: targetUser.username, bio: "", photo: null, banner: "emerald" };
        parsedLocal.bio = updatedBio;
        safeStorage.setItem(pKey, JSON.stringify(parsedLocal));
      } catch { /* noop */ }

      // 4. Salva a senha gerada para exibir no modal
      setResetPasswordInfo({
        username: targetUser.username,
        tempPw
      });

      showLocalToast(`Senha redefinida para @${targetUser.username}!`, "ok");
    } catch (err: any) {
      console.error("Erro ao resetar senha:", err);
      showLocalToast("Erro ao resetar senha no banco de dados.", "error");
    }
  };

  const executeDeleteUser = async (targetUser: any) => {
    try {
      await supabase.from("aportes").delete().eq("user_id", targetUser.id);
      await supabase.from("carteira").delete().eq("user_id", targetUser.id);
      await supabase.from("desafios").delete().eq("user_id", targetUser.id);
      await supabase.from("conquistas").delete().eq("user_id", targetUser.id);
      await supabase.from("historico_patrimonial").delete().eq("user_id", targetUser.id);
      await supabase.from("profile").delete().eq("id", targetUser.id);
    } catch (err) {
      console.error("Erro ao deletar dados do Supabase:", err);
    }

    const updatedUsers = adminUsers.filter((u) => u.id !== targetUser.id);
    safeStorage.setItem("finevo:users", JSON.stringify(updatedUsers));
    setAdminUsers(updatedUsers);

    // Limpeza de arquivos de dados do usuário deletado
    safeStorage.removeItem(`finevo:profile:${targetUser.id}`);
    safeStorage.removeItem(`finevo:portfolio:${targetUser.id}`);
    safeStorage.removeItem(`finevo:transactions:${targetUser.id}`);
    safeStorage.removeItem(`finevo:xp-events:${targetUser.id}`);
    safeStorage.removeItem(`finevo:goals:${targetUser.id}`);
    safeStorage.removeItem(`finevo:challenges:${targetUser.id}`);
    safeStorage.removeItem(`finevo:support:${targetUser.id}`);

    // Alerta o sistema que as contas foram alteradas (para fazer logout imediato caso estivesse logado nela)
    triggerAuthUpdate();

    showLocalToast(`A conta de @${targetUser.username} foi deletada definitivamente.`, "ok");
    setDeletingUser(null);
  };

  const handleClearMedia = async (targetUserId: string, username: string, type: "photo" | "banner") => {
    const pKey = `finevo:profile:${targetUserId}`;
    try {
      const field = type === "photo" ? "foto_perfil" : "banner_perfil";
      const val = type === "photo" ? null : "emerald";

      await supabase
        .from("profile")
        .update({ [field]: val })
        .eq("id", targetUserId);

      const raw = safeStorage.getItem(pKey);
      const parsed = raw ? JSON.parse(raw) : { name: username, bio: "", photo: null, banner: "emerald" };
      if (type === "photo") {
        parsed.photo = null;
      } else {
        parsed.banner = "emerald";
      }
      safeStorage.setItem(pKey, JSON.stringify(parsed));

      setAdminUsers((prev) =>
        prev.map((u) => {
          if (u.id === targetUserId) {
            return {
              ...u,
              photo: type === "photo" ? null : u.photo,
              banner: type === "banner" ? "emerald" : u.banner,
            };
          }
          return u;
        })
      );

      showLocalToast(`Mídia (${type === "photo" ? "foto" : "capa"}) de @${username} removida com sucesso.`, "ok");
    } catch (err) {
      console.error(err);
      showLocalToast("Erro ao remover mídia.", "error");
    }
  };

  const filteredUsers = adminUsers.filter((u) => {
    const q = adminSearch.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return createPortal(
    <div data-modal="support" className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in" onClick={handleClose} />
      <div
        className={`relative w-full max-w-[460px] bg-stone-50 shadow-2xl flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl ${
          isAdmin ? "animate-scale-in" : "animate-slide-up"
        }`}
        style={{ maxHeight: isAdmin ? "80vh" : "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Custom Local toast popup */}
        {toast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-white shadow-xl text-[11px] font-semibold flex items-center gap-2 animate-scale-in">
            <span className={toast.type === "ok" ? "text-emerald-400" : "text-rose-400"}>
              ●
            </span>
            <span>{toast.text}</span>
          </div>
        )}

        {/* Custom delete confirmation overlay dialog */}
        {deletingUser && (
          <div data-modal="delete-confirm" className="absolute inset-0 bg-stone-950/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white border border-stone-200 rounded-2xl p-5 w-full space-y-4 shadow-xl">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                  <Trash2 size={24} />
                </div>
                <h4 className="text-sm font-bold text-stone-900 leading-snug">
                  Excluir permanentemente @{deletingUser.username}?
                </h4>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Esta ação é irreversível. Todas as informações de carteira, saldo, XP, metas, desafios e progresso serão destruídas de nosso banco local para @{deletingUser.username}.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => setDeletingUser(null)}
                  className="py-2 px-4 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => executeDeleteUser(deletingUser)}
                  className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm"
                >
                  Excluir Conta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom reset password confirmation overlay dialog */}
        {resetPasswordInfo && (
          <div data-modal="reset-password-success" className="absolute inset-0 bg-stone-950/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white border border-stone-200 rounded-3xl p-6 w-full space-y-4 shadow-2xl">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center animate-bounce">
                  <KeyRound size={24} />
                </div>
                <h4 className="text-sm font-extrabold text-stone-900 uppercase tracking-tight">
                  Senha Redefinida!
                </h4>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  A senha de <span className="font-bold text-stone-800">@{resetPasswordInfo.username}</span> foi alterada com sucesso no banco de dados. Informe o código temporário abaixo para que o usuário possa acessar:
                </p>
                <div className="my-4 p-4 rounded-xl bg-amber-50 border border-amber-200 select-all font-mono font-extrabold text-sm text-amber-850 tracking-wider flex items-center justify-center gap-2">
                  <span>{resetPasswordInfo.tempPw}</span>
                </div>
                <p className="text-[9px] text-stone-400">
                  Ao logar com este código, o sistema exigirá imediatamente que ele cadastre uma nova senha pessoal.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setResetPasswordInfo(null)}
                  className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-md"
                >
                  Entendi, copiar e fechar
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-3 border-b border-stone-100 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`h-10 w-10 grid place-items-center rounded-2xl ${isAdmin ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}`}>
                {isAdmin ? <ShieldAlert size={20} /> : <LifeBuoy size={20} />}
              </span>
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  {isAdmin ? "Painel de Controle (ADM)" : "Central de Suporte"}
                </h3>
                <p className="text-[11px] text-stone-500">
                  {isAdmin ? "Controle administrativo de usuários e mídias" : "Estamos aqui para te ajudar"}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="h-9 w-9 grid place-items-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        {isAdmin ? (
          <div className="flex-1 min-h-0 flex flex-col bg-stone-50 overflow-hidden">
            {/* Search Input */}
            <div className="p-4 bg-white border-b border-stone-100 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input
                  type="text"
                  placeholder="Pesquisar usuários por nome ou e-mail..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-rose-400 focus:bg-white transition"
                />
              </div>
              <p className="text-[9px] text-stone-400 mt-1.5 font-mono">
                Filtrado: {filteredUsers.length} de {adminUsers.length} contas ativas
              </p>
            </div>

            {/* Users grid list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Search size={32} className="mx-auto text-stone-300" />
                  <p className="text-xs text-stone-500 mt-2 font-medium">Nenhum usuário cadastrado</p>
                  <p className="text-[10px] text-stone-400">Tente buscar por um termo diferente.</p>
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const prof = getUserProfile(u.id);
                  const isSelf = u.usernameLower === "adm_evo";
                  return (
                    <div key={u.id} className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-sm space-y-3">
                      {/* Name card */}
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-stone-900 truncate">
                              {prof.name || u.username}
                            </h4>
                            <span className="text-[10px] text-stone-400 font-mono">@{u.username}</span>
                            {isSelf && (
                              <span className="text-[8px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full">
                                ADM PRINCIPAL
                              </span>
                            )}
                            {u.isBanned && (
                              <span className="text-[8px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full animate-pulse">
                                BANIDO
                              </span>
                            )}
                            {u.isTester && (
                              <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                COLABORADOR
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-stone-500">{u.email}</p>
                          <p className="text-[9px] text-stone-400 mt-0.5">
                            Cadastro: {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>

                      {/* Photo indicator */}
                      <div className="grid grid-cols-2 gap-2 text-[9px] text-stone-500 bg-stone-50 p-2 rounded-xl border border-stone-100 font-mono">
                        <div className="flex items-center gap-1">
                          <span className="text-stone-400">Foto:</span>
                          <span className={prof.photo ? "text-emerald-600 font-bold" : "text-stone-400"}>
                            {prof.photo ? "Com foto" : "Sem foto"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-stone-400">Capa:</span>
                          <span className={prof.banner && prof.banner !== "emerald" ? "text-violet-600 font-bold" : "text-stone-400"}>
                            {prof.banner && prof.banner !== "emerald" ? "Personalizada" : "Padrão"}
                          </span>
                        </div>
                      </div>

                      {/* Toolbar buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-100">
                        {/* Clear Photo */}
                        <button
                          onClick={() => handleClearMedia(u.id, u.username, "photo")}
                          disabled={!prof.photo}
                          className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-[9px] font-bold text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-0.5"
                        >
                          <Camera size={10} /> Tirar Foto
                        </button>

                        {/* Clear Banner */}
                        <button
                          onClick={() => handleClearMedia(u.id, u.username, "banner")}
                          disabled={!prof.banner || prof.banner === "emerald"}
                          className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-[9px] font-bold text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-0.5"
                        >
                          <Image size={10} /> Tirar Capa
                        </button>

                        {/* Ban actions */}
                        {!isSelf && (
                          <button
                            onClick={() => handleResetPassword(u)}
                            className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition flex items-center gap-0.5 text-[9px] font-bold"
                            title="Resetar senha para código temporário"
                          >
                            <KeyRound size={10} /> Resetar Senha
                          </button>
                        )}

                        {!isSelf && (
                          <button
                            onClick={() => handleToggleBan(u)}
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition flex items-center gap-0.5 border ${
                              u.isBanned
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                                : "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
                            }`}
                          >
                            {u.isBanned ? "Desbanir" : "Banir"}
                          </button>
                        )}

                        {/* Delete account */}
                        {!isSelf && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="ml-auto p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                            title="Deletar conta definitivamente"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <>
            {success ? (
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-8 flex flex-col items-center justify-center text-center">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30 mb-4 animate-scale-in">
                  <CheckCircle2 size={42} strokeWidth={2.5} />
                </div>
                <h4 className="text-xl font-bold text-stone-900">Mensagem enviada!</h4>
                <p className="text-sm text-stone-600 mt-2 max-w-[280px]">
                  Recebemos seu relato. Nossa equipe vai analisar e responder em breve.
                </p>
                <p className="text-[11px] text-stone-400 mt-4">Fechando automaticamente...</p>
              </div>
            ) : step === "ask" ? (
              <div className="px-6 py-10 flex flex-col items-center text-center space-y-6">
                <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-pulse-ring">
                  <LifeBuoy size={32} />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-stone-900">Precisa de Suporte?</h4>
                  <p className="text-sm text-stone-500 max-w-[320px]">
                    Teve alguma dúvida com seus investimentos ou encontrou alguma inconsistência? Estamos aqui para resolver rápido!
                  </p>
                </div>
                <div className="w-full grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    className="py-3.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold transition text-sm"
                  >
                    Não preciso
                  </button>
                  <button
                    onClick={() => setStep("form")}
                    className="py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition text-sm shadow-md shadow-emerald-500/20"
                  >
                    Sim, preciso!
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-5 py-4 space-y-4">
                  {/* Back Button */}
                  <button
                    onClick={() => setStep("ask")}
                    className="text-xs font-semibold text-stone-500 hover:text-stone-700 flex items-center gap-1"
                  >
                    ← Voltar
                  </button>

                  {/* Categoria */}
                  <div>
                    <label className="text-[11px] text-stone-500 mb-2 block font-medium">
                      Sobre o que é?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.map((c) => {
                        const active = category === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setCategory(c.id)}
                            className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition text-left ${
                              active
                                ? `${c.bg} ${c.color}`
                                : "bg-white border-stone-200 text-stone-500 hover:bg-stone-50"
                            }`}
                          >
                            <c.Icon size={16} className="shrink-0" />
                            <span className="text-xs font-semibold">{c.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Assunto (opcional) */}
                  <div>
                    <label className="text-[11px] text-stone-500 mb-1.5 block font-medium">
                      Assunto <span className="text-stone-400">(opcional)</span>
                    </label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value.slice(0, 80))}
                      placeholder="Ex: Não consigo adicionar aporte"
                      maxLength={80}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-stone-200 text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-400"
                    />
                    <p className="text-[10px] text-stone-400 mt-1 text-right">{subject.length}/80</p>
                  </div>

                  {/* Mensagem */}
                  <div>
                    <label className="text-[11px] text-stone-500 mb-1.5 block font-medium">
                      Descreva o problema ou sua mensagem
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                      placeholder="Conte com detalhes o que aconteceu, o que você esperava ou sua sugestão..."
                      rows={6}
                      maxLength={1000}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-stone-200 text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-400 resize-none"
                    />
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className={message.trim().length < 10 ? "text-stone-400" : "text-emerald-600"}>
                        {message.trim().length < 10
                          ? `Mínimo 10 caracteres (faltam ${Math.max(0, 10 - message.trim().length)})`
                          : "✓ Pronto para enviar"}
                      </span>
                      <span className="text-stone-400">{message.length}/1000</span>
                    </div>
                  </div>

                  {/* Dica */}
                  <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3">
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      💡 <strong>Dica:</strong> Se for um bug, conte qual aba você estava, o que clicou e o que aconteceu (ou não aconteceu).
                      Isso ajuda nossa equipe a resolver mais rápido!
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-stone-100 bg-white px-5 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleClose}
                      className="py-3.5 rounded-2xl bg-stone-100 text-sm font-semibold text-stone-700 hover:bg-stone-200 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className="flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-500/30"
                    >
                      {submitting ? (
                        "Enviando..."
                      ) : (
                        <>
                          <Send size={14} /> Enviar relato
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
