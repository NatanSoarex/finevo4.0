import { useEffect, useState } from "react";
import {
  TrendingUp, User as UserIcon, Mail, Lock, Eye, EyeOff,
  AlertCircle, Loader2, ArrowLeft, CheckCircle2, LifeBuoy,
} from "lucide-react";
import {
  registerUser, loginUser, validateUsername, validateEmail, validatePassword,
  isUsernameAvailable, getLockoutRemainingMs, useAuth,
} from "../services/auth";
import { updateProfile } from "../services/userProfile";
import { supabase } from "../services/supabaseClient";

type Screen = "login" | "register";

export default function AuthScreen() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>("login");

  return (
    <div
      className="w-full bg-[#05070d] flex items-stretch justify-center"
      style={{ minHeight: "100dvh" }}
    >
      <div
        className="relative w-full max-w-[460px] overflow-hidden flex flex-col"
        style={{ minHeight: "100dvh" }}
      >
        {/* === FUNDO ANIMADO === */}
        <AnimatedBackground />

        {/* Suporte Supremo flutuante no topo direito */}
        <div className="absolute top-4 right-4 z-50 animate-fade-in">
          <a
            href="https://t.me/natansoarex"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/20 text-white/70 hover:text-emerald-400 text-[10.5px] font-bold transition-all duration-150 active:scale-95 shadow-lg backdrop-blur-md"
          >
            <LifeBuoy size={12} className="animate-pulse text-emerald-400 shrink-0" />
            <span>Suporte Telegram</span>
          </a>
        </div>

        {/* Conteúdo - scrollável quando não couber */}
        <div
          className="relative z-10 flex-1 overflow-y-auto"
          style={{
            paddingTop: "max(24px, env(safe-area-inset-top))",
            paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          }}
        >
          {user && user.isProfileIncomplete ? (
            <CompleteRegisterScreen />
          ) : screen === "login" ? (
            <LoginScreen onGoRegister={() => setScreen("register")} />
          ) : (
            <RegisterScreen onBack={() => setScreen("login")} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============== FUNDO ANIMADO ============== */
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Gradiente base escuro premium */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e1a] via-[#0d1525] to-[#0a1a1f]" />

      {/* Blobs animados grandes que se movem */}
      <div className="absolute top-[10%] left-[-20%] w-[500px] h-[500px] rounded-full bg-emerald-500/20 blur-[120px] animate-blob-1" />
      <div className="absolute top-[40%] right-[-20%] w-[500px] h-[500px] rounded-full bg-violet-500/20 blur-[120px] animate-blob-2" />
      <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-teal-400/20 blur-[120px] animate-blob-3" />
      <div className="absolute top-[30%] left-[30%] w-[300px] h-[300px] rounded-full bg-sky-500/15 blur-[100px] animate-blob-4" />

      {/* Grid sutil de pontos */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Partículas flutuantes (estrelas/pontos) */}
      <div className="absolute inset-0">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white animate-float-particle"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              opacity: 0.2 + (i % 5) * 0.1,
              animationDelay: `${(i * 0.3) % 6}s`,
              animationDuration: `${8 + (i % 6)}s`,
            }}
          />
        ))}
      </div>

      {/* Linhas finas brilhantes diagonais */}
      <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="20%" x2="100%" y2="40%" stroke="url(#line-grad)" strokeWidth="1" className="animate-line-sweep" />
        <line x1="0" y1="60%" x2="100%" y2="80%" stroke="url(#line-grad)" strokeWidth="1" className="animate-line-sweep" style={{ animationDelay: "2s" }} />
      </svg>

      {/* Vinheta suave */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20" />

      {/* Animações inline (mantém o componente autocontido) */}
      <style>{`
        @keyframes blob1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(80px, 60px) scale(1.1); }
          66% { transform: translate(-40px, 100px) scale(0.95); }
        }
        @keyframes blob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-90px, 50px) scale(1.05); }
          66% { transform: translate(60px, -80px) scale(1.1); }
        }
        @keyframes blob3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(100px, -80px) scale(1.15); }
        }
        @keyframes blob4 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
          50% { transform: translate(-60px, 100px) scale(1.2); opacity: 1; }
        }
        @keyframes floatParticle {
          0%, 100% { transform: translate(0, 0); opacity: 0.3; }
          50% { transform: translate(20px, -30px); opacity: 0.8; }
        }
        @keyframes lineSweep {
          0% { opacity: 0; transform: translateX(-30%); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateX(30%); }
        }
        .animate-blob-1 { animation: blob1 18s ease-in-out infinite; }
        .animate-blob-2 { animation: blob2 20s ease-in-out infinite; }
        .animate-blob-3 { animation: blob3 16s ease-in-out infinite; }
        .animate-blob-4 { animation: blob4 12s ease-in-out infinite; }
        .animate-float-particle { animation: floatParticle ease-in-out infinite; }
        .animate-line-sweep { animation: lineSweep 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ============== LOGIN (tela principal) ============== */
function LoginScreen({ onGoRegister }: { onGoRegister: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lockMs, setLockMs] = useState(getLockoutRemainingMs());
  useEffect(() => {
    if (lockMs <= 0) return;
    const i = window.setInterval(() => setLockMs(getLockoutRemainingMs()), 1000);
    return () => window.clearInterval(i);
  }, [lockMs]);

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await loginUser({ identifier, password });
      if (!result.ok) {
        setError((result as { error: string }).error);
        setLockMs(getLockoutRemainingMs());
      } else {
        // Sincroniza o nome do perfil com o username do usuário que entrou.
        // Garante que "Olá, X" mostre o nome correto mesmo se o profile
        // tinha dados de outra conta/versão anterior.
        updateProfile({ name: result.user.username });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = lockMs > 0;
  const lockSecs = Math.ceil(lockMs / 1000);

  const handleGoogleLogin = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const { data, error: googleErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          skipBrowserRedirect: true,
        },
      });

      if (googleErr) throw googleErr;

      if (data?.url) {
        const width = 500;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          data.url,
          "finevo_google_auth",
          `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
        );
        
        if (!popup) {
          throw new Error("Popup bloqueado pelo navegador. Por favor, permita popups para fazer login.");
        }
      }
    } catch (err: any) {
      console.error("Erro ao autenticar com o Google:", err);
      // Suprime mensagens técnicas, provê erro amigável ao usuário
      setError("Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-center px-6 sm:px-8 py-6 animate-fade-in">
      {/* Logo no topo */}
      <div className="text-center mb-8 sm:mb-10">
        <div className="relative inline-block">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-emerald-400/40 to-teal-400/40 blur-2xl animate-pulse" style={{ animationDuration: "3s" }} />
          <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 grid place-items-center shadow-xl shadow-emerald-500/40 animate-scale-in">
            <TrendingUp size={42} className="text-white" strokeWidth={2.5} />
          </div>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white animate-fade-up">FinEvo</h1>
      </div>

      {/* Card de login com glassmorphism */}
      <div
        className="rounded-3xl bg-white/[0.08] backdrop-blur-xl border border-white/15 p-6 shadow-2xl animate-fade-up"
        style={{ animationDelay: "100ms" }}
      >
        <div className="space-y-3">
          <DarkField
            Icon={UserIcon}
            value={identifier}
            onChange={setIdentifier}
            placeholder="Usuário ou e-mail"
            disabled={isLocked || submitting}
          />
          <DarkPasswordField
            value={password}
            onChange={setPassword}
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            disabled={isLocked || submitting}
            placeholder="Senha"
          />

          {error && (
            <div className="rounded-2xl bg-rose-500/15 border border-rose-400/30 p-3 flex items-start gap-2 animate-fade-in">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-200 font-medium">{error}</p>
            </div>
          )}

          {isLocked && (
            <div className="rounded-2xl bg-amber-500/15 border border-amber-400/30 p-3 text-center">
              <p className="text-xs text-amber-200 font-semibold">
                ⏱️ Aguarde {Math.floor(lockSecs / 60)}min {lockSecs % 60}s
              </p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLocked || submitting || !identifier || !password}
            className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold hover:from-emerald-400 hover:to-teal-400 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Entrando..." : "Entrar"}
          </button>

          {/* Divisor */}
          <div className="flex items-center gap-3 my-2 px-1">
            <div className="h-[1px] flex-1 bg-white/10" />
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">ou</span>
            <div className="h-[1px] flex-1 bg-white/10" />
          </div>

          {/* Botão Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-white/[0.04] p-3 hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white text-sm font-bold transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-45"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-3.3-4.53-6.16-4.53z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Entrar com o Google
          </button>
        </div>
      </div>

      {/* Botão de registro */}
      <button
        onClick={onGoRegister}
        className="mt-4 w-full py-3.5 rounded-2xl bg-white/[0.06] border border-white/15 text-white text-sm font-semibold hover:bg-white/[0.12] transition active:scale-[0.98] backdrop-blur animate-fade-up"
        style={{ animationDelay: "200ms" }}
      >
        Criar nova conta
      </button>
    </div>
  );
}

/* ============== REGISTRO ============== */
function RegisterScreen({ onBack }: { onBack: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const { data, error: googleErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          skipBrowserRedirect: true,
        },
      });

      if (googleErr) throw googleErr;

      if (data?.url) {
        const width = 500;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          data.url,
          "finevo_google_auth",
          `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
        );
        
        if (!popup) {
          throw new Error("Popup bloqueado pelo navegador. Por favor, permita popups para este site para fazer cadastro.");
        }
      }
    } catch (err: any) {
      console.error("Erro ao autenticar com o Google:", err);
      setError("Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const usernameValidation = username ? validateUsername(username) : null;
  const usernameAvailable = usernameValidation?.ok ? isUsernameAvailable(username) : null;
  const emailValidation = email ? validateEmail(email) : null;
  const passwordValidation = password ? validatePassword(password) : null;

  const canSubmit =
    username && email && password &&
    usernameValidation?.ok && usernameAvailable !== false &&
    emailValidation?.ok && passwordValidation?.ok && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await registerUser({ username, email, password });
      if (!result.ok) {
        setError((result as { error: string }).error);
      } else {
        updateProfile({ name: result.user.username });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-center px-6 sm:px-8 py-6 animate-fade-in">
      <button
        onClick={onBack}
        className="h-10 w-10 grid place-items-center rounded-full bg-white/[0.08] border border-white/15 text-white hover:bg-white/[0.15] transition self-start backdrop-blur mb-4"
      >
        <ArrowLeft size={18} />
      </button>

      <div className="text-center mb-5">
        <div className="relative inline-block">
          <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-violet-400/40 to-fuchsia-400/40 blur-2xl animate-pulse" style={{ animationDuration: "3s" }} />
          <div className="relative h-16 w-16 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center shadow-xl shadow-violet-500/40">
            <UserIcon size={32} className="text-white" strokeWidth={2.5} />
          </div>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-white">Criar conta</h2>
      </div>

      <div
        className="rounded-3xl bg-white/[0.08] backdrop-blur-xl border border-white/15 p-6 shadow-2xl animate-fade-up"
        style={{ animationDelay: "100ms" }}
      >
        <div className="space-y-3">
          <DarkField
            Icon={UserIcon}
            value={username}
            onChange={(v) => setUsername(v.slice(0, 20))}
            placeholder="Nome de usuário"
            disabled={submitting}
            hint={
              !username ? null
                : usernameValidation && !usernameValidation.ok ? { text: (usernameValidation as { error: string }).error, tone: "error" }
                : usernameAvailable === false ? { text: "Já está em uso", tone: "error" }
                : { text: "Disponível", tone: "ok" }
            }
          />

          <DarkField
            Icon={Mail}
            value={email}
            onChange={(v) => setEmail(v.slice(0, 100))}
            placeholder="E-mail"
            type="email"
            disabled={submitting}
            hint={
              !email ? null
                : emailValidation && !emailValidation.ok ? { text: (emailValidation as { error: string }).error, tone: "error" }
                : { text: "E-mail válido", tone: "ok" }
            }
          />

          <DarkPasswordField
            value={password}
            onChange={(v) => setPassword(v.slice(0, 100))}
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            disabled={submitting}
            placeholder="Senha"
            hint={
              !password ? null
                : passwordValidation && !passwordValidation.ok ? { text: (passwordValidation as { error: string }).error, tone: "error" }
                : { text: "Senha forte", tone: "ok" }
            }
          />

          {error && (
            <div className="rounded-2xl bg-rose-500/15 border border-rose-400/30 p-3 flex items-start gap-2 animate-fade-in">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-200 font-medium">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold hover:from-emerald-400 hover:to-teal-400 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Criando..." : "Criar conta"}
          </button>

          {/* Divisor */}
          <div className="flex items-center gap-3 my-2 px-1">
            <div className="h-[1px] flex-1 bg-white/10" />
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">ou</span>
            <div className="h-[1px] flex-1 bg-white/10" />
          </div>

          {/* Botão Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-white/[0.04] p-3 hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white text-sm font-bold transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-45"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-3.3-4.53-6.16-4.53z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Criar conta com o Google
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============== CAMPOS DARK ============== */
type Hint = { text: string; tone: "ok" | "error" };

function DarkField({
  Icon, value, onChange, placeholder, type = "text", disabled, hint,
}: {
  Icon: typeof UserIcon;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  disabled?: boolean;
  hint?: Hint | null;
}) {
  return (
    <div>
      <div className="relative">
        <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={type === "email" ? "email" : "off"}
          autoCapitalize="off"
          className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/15 text-base text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-400/60 focus:bg-white/[0.1] transition disabled:opacity-50"
        />
      </div>
      {hint && (
        <p className={`text-[10px] font-medium mt-1.5 px-1 flex items-center gap-1 ${
          hint.tone === "ok" ? "text-emerald-400" : "text-rose-300"
        }`}>
          {hint.tone === "ok" ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
          {hint.text}
        </p>
      )}
    </div>
  );
}

function DarkPasswordField({
  value, onChange, show, onToggle, disabled, placeholder, hint,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  disabled?: boolean;
  placeholder: string;
  hint?: Hint | null;
}) {
  return (
    <div>
      <div className="relative">
        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="current-password"
          className="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-white/[0.06] border border-white/15 text-base text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-400/60 focus:bg-white/[0.1] transition disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-lg text-white/50 hover:text-white hover:bg-white/10"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && (
        <p className={`text-[10px] font-medium mt-1.5 px-1 flex items-center gap-1 ${
          hint.tone === "ok" ? "text-emerald-400" : "text-rose-300"
        }`}>
          {hint.tone === "ok" ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
          {hint.text}
        </p>
      )}
    </div>
  );
}

/* ============== COMPLETAR CADASTRO (Após Google Login) ============== */
function CompleteRegisterScreen() {
  const { user, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameValidation = username ? validateUsername(username) : null;
  const usernameAvailable = usernameValidation?.ok ? isUsernameAvailable(username) : null;
  const passwordValidation = password ? validatePassword(password) : null;

  const canSubmit =
    username &&
    usernameValidation?.ok &&
    usernameAvailable !== false &&
    (!password || passwordValidation?.ok) &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const { completeProfileRegistration } = await import("../services/auth");
      const result = await completeProfileRegistration(username, password || undefined);
      if (!result.ok) {
        setError((result as { error: string }).error);
      } else {
        updateProfile({ name: (result as { user: any }).user.username });
      }
    } catch (err: any) {
      setError(err.message || "Erro ao concluir cadastro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-center px-6 sm:px-8 py-6 animate-fade-in animate-fade-up">
      {/* Botão de Voltar / Sair para cancelar */}
      <button
        onClick={logout}
        className="h-10 w-10 grid place-items-center rounded-full bg-white/[0.08] border border-white/15 text-white hover:bg-white/[0.15] transition self-start backdrop-blur mb-4"
        title="Cancelar e Sair"
      >
        <ArrowLeft size={18} />
      </button>

      <div className="text-center mb-5">
        <div className="relative inline-block">
          <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-emerald-400/45 to-teal-400/45 blur-2xl animate-pulse" style={{ animationDuration: "3s" }} />
          <div className="relative h-16 w-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 grid place-items-center shadow-xl shadow-emerald-500/40">
            <UserIcon size={32} className="text-white" strokeWidth={2.5} />
          </div>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-white">Quase lá!</h2>
        <p className="text-xs text-white/60 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
          Escolha como quer ser chamado no FinEvo para concluir seu cadastro com o Google.
        </p>
      </div>

      <div
        className="rounded-3xl bg-white/[0.08] backdrop-blur-xl border border-white/15 p-6 shadow-2xl animate-fade-up"
        style={{ animationDelay: "100ms" }}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">E-mail do Google</p>
            <p className="text-xs font-semibold text-white/80 select-all truncate">{user?.email}</p>
          </div>

          <DarkField
            Icon={UserIcon}
            value={username}
            onChange={(v) => setUsername(v.slice(0, 20))}
            placeholder="Nome de usuário"
            disabled={submitting}
            hint={
              !username ? null
                : usernameValidation && !usernameValidation.ok ? { text: (usernameValidation as { error: string }).error, tone: "error" }
                : usernameAvailable === false ? { text: "Já está em uso", tone: "error" }
                : { text: "Disponível", tone: "ok" }
            }
          />

          <div className="space-y-1.5">
            <DarkPasswordField
              value={password}
              onChange={(v) => setPassword(v.slice(0, 100))}
              show={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
              disabled={submitting}
              placeholder="Criar uma senha (opcional)"
              hint={
                !password ? { text: "Sua conta do Google já é protegida, mas você pode definir uma senha para entrar por e-mail e senha mais tarde se desejar.", tone: "ok" } as any
                  : passwordValidation && !passwordValidation.ok ? { text: (passwordValidation as { error: string }).error, tone: "error" }
                  : { text: "Senha aceitável", tone: "ok" }
              }
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-500/15 border border-rose-400/30 p-3 flex items-start gap-2 animate-fade-in">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-200 font-medium">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold hover:from-emerald-400 hover:to-teal-400 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Salvando..." : "Concluir Cadastro"}
          </button>
        </div>
      </div>
    </div>
  );
}
