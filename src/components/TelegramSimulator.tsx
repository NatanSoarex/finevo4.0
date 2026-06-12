import { useState, useEffect } from "react";
import { 
  Smartphone, ShieldAlert, Award, RefreshCw, X, Radio, 
  Settings, UserCheck, Sparkles, Check, ChevronDown, 
  ToggleLeft, ToggleRight, Laptop, Moon, Sun, Flame
} from "lucide-react";
import { 
  isTelegramSimulated, 
  setTelegramSimulation, 
  getTelegramUser, 
  TelegramUser,
  isRealTelegramMiniApp
} from "../services/telegramService";
import { loginTelegramUser, logout } from "../services/auth";

interface Props {
  onRefreshSession: () => void;
  activeTab: string;
}

const PRESET_USERS = [
  { id: 715563999, first_name: "Nathan", last_name: "Soares", username: "natansoarex", role: "Criador" },
  { id: 987654321, first_name: "Ana", last_name: "Beatriz", username: "anab_investe", role: "Investidor Pro" },
  { id: 112233445, first_name: "Lucas", last_name: "Evo", username: "lucasevo", role: "Sócio" },
  { id: 555777999, first_name: "ADM", last_name: "Evo", username: "adm_evo", role: "Administrador" }
];

export default function TelegramSimulator({ onRefreshSession, activeTab }: Props) {
  const [active, setActive] = useState(isTelegramSimulated());
  const [realTMA, setRealTMA] = useState(isRealTelegramMiniApp());
  const [selectedUser, setSelectedUser] = useState<TelegramUser>(() => {
    return getTelegramUser() || {
      id: 715563999,
      first_name: "Nathan",
      last_name: "Soares",
      username: "natansoarex"
    };
  });
  
  const [hapticLogs, setHapticLogs] = useState<{ id: string; type: string; time: string }[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [simulatedThemeCategory, setSimulatedThemeCategory] = useState<"dark" | "light" | "custom">("dark");

  useEffect(() => {
    // Detecta se é o Telegram real de forma reativa
    setRealTMA(isRealTelegramMiniApp());
  }, []);

  // Monitora interceptações de feedback tátil tcheco-vibratório
  useEffect(() => {
    const handleHaptic = (e: any) => {
      const type = e.detail?.type || "impact";
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
      
      const newLog = {
        id: Math.random().toString(),
        type,
        time: timeStr
      };

      setHapticLogs((prev) => [newLog, ...prev.slice(0, 4)]);

      // Emite efeito de vibração simulado usando a API Speech Synthesis de cliques, se disponível, ou leve som
      try {
        if ("vibrate" in navigator) {
          navigator.vibrate(type === "heavy" ? 150 : type === "medium" ? 80 : 40);
        }
      } catch {
        /* noop */
      }
    };

    window.addEventListener("tg-haptic-trigger", handleHaptic as EventListener);
    return () => {
      window.removeEventListener("tg-haptic-trigger", handleHaptic as EventListener);
    };
  }, []);

  // Sincroniza login imediato caso mude do usuário simulado ou ligue a simulação
  const applyTelegramUserSession = async (user: TelegramUser) => {
    try {
      await loginTelegramUser(user);
      onRefreshSession();
    } catch (e) {
      console.error("Falha ao sincronizar login telegram simulado:", e);
    }
  };

  const handleToggleSimulation = async (activate: boolean) => {
    if (activate) {
      setTelegramSimulation(true, selectedUser);
      setActive(true);
      await applyTelegramUserSession(selectedUser);
    } else {
      setTelegramSimulation(false);
      setActive(false);
      // Força logout para limpar heranças
      await logout();
      onRefreshSession();
    }
  };

  const handleSelectUser = async (user: typeof PRESET_USERS[0]) => {
    const newUser = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username
    };
    setSelectedUser(newUser);
    if (active) {
      setTelegramSimulation(true, newUser);
      await applyTelegramUserSession(newUser);
    }
  };

  // Se o usuário estiver utilizando no Telegram nativo real, não há necessidade de renderizar o simulador web de iframe
  if (realTMA) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
        <div className="bg-emerald-600/95 text-white text-[10px] font-extrabold px-3 py-1 rounded-full shadow-lg border border-emerald-500/30 flex items-center gap-1.5 backdrop-blur-md animate-fade-in animate-bounce">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
          NATIVO TELEGRAM MINI APP ATIVO
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 1. TOPO DA TELA - Barra de Simulador */}
      <div className="w-full bg-[#1b1c23] border-b border-stone-800 text-stone-300 text-xs px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 relative z-50 shadow-inner">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-[#0088cc] flex items-center justify-center text-white text-[10px] font-extrabold shadow-sm animate-pulse">
            TG
          </div>
          <div>
            <span className="font-extrabold text-white tracking-wide text-[11px] uppercase">Telegram Mini App Workspace</span>
            <span className="text-[10px] text-stone-400 ml-1.5">v1.2.5 (Simulated)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* logs rápidos de haptics */}
          {hapticLogs.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-stone-900/60 border border-stone-800 rounded-lg px-2 py-1 text-[10px] text-stone-300 animate-fade-in">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-mono text-[9px] text-stone-400">Haptics:</span>
              <span className="font-extrabold capitalize text-emerald-400 font-mono text-[9px]">
                {hapticLogs[0].type} ({hapticLogs[0].time})
              </span>
            </div>
          )}

          {/* Toggle de simulação */}
          <button
            onClick={() => handleToggleSimulation(!active)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition text-[11px] cursor-pointer ${
              active 
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-700/20" 
                : "bg-stone-800 hover:bg-stone-700 text-stone-200"
            }`}
          >
            {active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
            <span>{active ? "Simulador Ativo (Mini App)" : "Ativar Modo Mini App"}</span>
          </button>

          {/* Botão de abrir configurações */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-1.5 rounded-xl bg-stone-800/80 border border-stone-700 hover:bg-stone-700 hover:text-white text-stone-400 transition cursor-pointer"
            title="Ajustes do Simulador"
          >
            <Settings size={14} className={showConfig ? "rotate-45 transition-transform" : ""} />
          </button>
        </div>
      </div>

      {/* 2. MENU LATERAL DE AJUSTES DO SIMULADOR (se visível) */}
      {showConfig && (
        <div className="fixed inset-y-0 right-0 w-80 bg-[#121418] border-l border-stone-800 z-[9999] p-5 shadow-2xl flex flex-col justify-between animate-fade-left text-white">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-400 animate-pulse" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider">Ajustes Telegram</h3>
              </div>
              <button 
                onClick={() => setShowConfig(false)}
                className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition"
              >
                <X size={15} />
              </button>
            </div>

            {/* Configurações do modo */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Estado da Simulação</h4>
              <div className="bg-stone-900/50 rounded-2xl p-3 border border-stone-800/80 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold">Mock de Mini App</p>
                  <p className="text-[9px] text-stone-500 mt-0.5">Simula layout celular em tela cheia</p>
                </div>
                <button
                  onClick={() => handleToggleSimulation(!active)}
                  className={`p-1 rounded-lg ${active ? "text-emerald-500" : "text-stone-600"}`}
                >
                  {active ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                </button>
              </div>
            </div>

            {/* Usuário de teste */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Identidade do Usuário</h4>
              <p className="text-[9px] text-stone-500">Selecione para entrar automaticamente sem chaves de acesso:</p>
              
              <div className="grid grid-cols-1 gap-1.5">
                {PRESET_USERS.map((user) => {
                  const isCurrent = selectedUser.id === user.id;
                  return (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className={`w-full p-2.5 rounded-xl text-left border text-xs transition flex items-center justify-between cursor-pointer ${
                        isCurrent
                          ? "bg-emerald-500/10 border-emerald-500/50 text-white"
                          : "bg-stone-900/40 border-stone-800/80 hover:bg-stone-800/40 text-stone-300"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[11px] truncate">{user.first_name} {user.last_name}</span>
                          <span className="text-[8px] bg-stone-800 text-stone-400 px-1 py-0.2 rounded-md font-mono shrink-0 font-bold uppercase">{user.role}</span>
                        </div>
                        <p className="text-[9.5px] text-stone-500 truncate mt-0.5">@{user.username} • ID: {user.id}</p>
                      </div>
                      {isCurrent && <Check size={14} className="text-emerald-400 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* haptic logs */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                <Radio size={11} className="text-rose-400 animate-ping" />
                Retornos Táteis (Haptic Logs)
              </h4>
              <p className="text-[9px] text-stone-500 leading-normal">
                Clique nas negociações de FIIs/Ações ou no escritório 3D e veja a resposta física disparada na mão do usuário:
              </p>
              
              <div className="bg-stone-950/80 border border-stone-850 rounded-2xl p-3 font-mono text-[9px] space-y-1.5 max-h-32 overflow-y-auto">
                {hapticLogs.length === 0 ? (
                  <p className="text-stone-600 text-center py-2 italic">[Aguardando gatilhos táticos]</p>
                ) : (
                  hapticLogs.map((log) => (
                    <div key={log.id} className="flex justify-between items-center text-[9px] text-stone-400 border-b border-stone-900 pb-1 last:border-0">
                      <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                        <span className="inline-block h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                        {log.type.toUpperCase()}
                      </span>
                      <span>{log.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-800 space-y-2 text-[10px] text-stone-400">
            <p className="flex items-center gap-1.5">
              <Smartphone size={12} className="text-emerald-400" />
              <span>Gatilho de vibração ativo no mobile</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Laptop size={12} className="text-emerald-400" />
              <span>Sincronizado via Supabase Cloud Engine</span>
            </p>
          </div>
        </div>
      )}

      {/* 3. SIMULAÇÃO VISUAL DE HAPTIC FEEDBACK FLOAT BUBBLE */}
      {hapticLogs.length > 0 && (
         <div className="fixed bottom-24 right-4 z-[99999] pointer-events-none animate-bounce">
           <div className="rounded-2xl bg-stone-950/95 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-3 py-2 flex items-center gap-2 shadow-2xl backdrop-blur-md">
             <span className="text-[12px]">📳</span>
             <span>Vibração Mini App:</span>
             <span className="text-white capitalize font-mono text-[9px] bg-emerald-500/20 px-1 py-0.5 rounded-md">{hapticLogs[0].type}</span>
           </div>
         </div>
      )}
    </>
  );
}
