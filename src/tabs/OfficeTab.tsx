import React, { useMemo, useState, useEffect, Suspense } from "react";
import { 
  Play, Pause, Sparkles, Briefcase, Zap, Star, Coins, Info, CheckCircle, TrendingUp, TrendingDown, Layers
} from "lucide-react";
import { usePortfolio, type Position } from "../services/portfolio";
import { getCachedQuotes, getQuote, type PriceQuote } from "../services/marketApi";
import { safeStorage } from "../services/safeStorage";
import ThreeOfficeScene from "../components/ThreeOfficeScene";

function OfficeLoadingFallback() {
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#090514] to-[#040209] flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in">
      <div className="relative mb-6">
        {/* Decorative ambient background blur */}
        <div className="absolute -inset-6 rounded-full bg-emerald-500/10 blur-2xl animate-pulse" />
        
        {/* Core rotating neon geometric loading skeleton */}
        <div className="relative h-14 w-14 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center shadow-2xl">
          <Layers size={22} className="text-emerald-400 animate-bounce" />
          <div className="absolute inset-0 rounded-2xl border-t-2 border-r-2 border-emerald-500/40 animate-spin" />
        </div>
      </div>
      
      <h3 className="text-sm font-bold text-stone-200 tracking-wide uppercase">Iniciando Ambiente Voxel</h3>
      <p className="text-[10px] text-stone-500 max-w-[240px] leading-relaxed mt-1 font-sans">
        Sintonizando simulação 3D de ativos em tempo real... O app carrega instantaneamente enquanto os elementos visuais são posicionados.
      </p>
    </div>
  );
}

export default function OfficeTab({ isActive = true }: { isActive?: boolean }) {
  const positions = usePortfolio();



  // Carrega cotações em tempo real e armazena em estado local para atualizar a UI reativamente
  const [quotes, setQuotes] = useState<Record<string, PriceQuote>>(() => getCachedQuotes());
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  useEffect(() => {
    if (positions.length === 0) return;
    const loadQuotes = async () => {
      setLoadingQuotes(true);
      try {
        const promises = positions.map((p) => getQuote(p.ticker));
        await Promise.all(promises);
        setQuotes(getCachedQuotes());
      } catch (e) {
        console.warn("Erro ao atualizar cotações no escritório:", e);
      } finally {
        setLoadingQuotes(false);
      }
    };
    loadQuotes();
    const interval = setInterval(loadQuotes, 30000); // 30 segundos
    return () => clearInterval(interval);
  }, [positions]);

  // Combined real-time or seeded portfolio stats
  const portfolioStats = useMemo(() => {
    let userTotalValue = 0;
    let oldInvestedTotal = 0;

    positions.forEach((pos) => {
      const q = quotes[pos.ticker];
      const currentPrice = q ? q.price : pos.purchasePrice;
      const val = currentPrice * pos.quantity;
      userTotalValue += val;
      oldInvestedTotal += pos.invested;
    });

    const isPortfolioEmpty = positions.length === 0;

    if (isPortfolioEmpty) {
      return {
        total: 0,
        variationPercent: 0,
        profit: 0,
        isDemo: false,
        summaryText: "Seu escritório virtual está pronto! Seus ajudantes e personagens voxel estão a postos para o dia de trabalho."
      };
    }

    const variationPercent = oldInvestedTotal > 0 
      ? ((userTotalValue - oldInvestedTotal) / oldInvestedTotal) * 100 
      : 0;

    const profit = userTotalValue - oldInvestedTotal;

    return {
      total: userTotalValue,
      variationPercent: isNaN(variationPercent) ? 0 : variationPercent,
      profit: profit,
      isDemo: false,
      summaryText: "Conectado em tempo real com seu portfólio principal. Seus personagens voxel zelam pelos seus ativos!"
    };
  }, [positions, quotes]);

  const [selectedEntity, setSelectedEntity] = useState<{ type: "agent" | "asset"; id: string } | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  const [simulatedAgents, setSimulatedAgents] = useState<any[]>([]);

  // Mapeamento preciso de todos os possíveis ativos reais do catálogo para as 4 seções físicas do escritório 3D
  const getGroupPositions = (type: "cdb" | "fii" | "stocks" | "gold") => {
    if (type === "cdb") {
      return positions.filter(p => p.type === "etf" && (p.ticker.includes("SELIC") || p.ticker.includes("LFTS") || p.ticker.includes("CDI") || !["GOLD11", "IVVB11", "BOVA11", "SMAL11", "HASH11"].includes(p.ticker.toUpperCase())));
    }
    if (type === "fii") {
      return positions.filter(p => p.type === "fund");
    }
    if (type === "stocks") {
      return positions.filter(p => (p.type === "stock" && !p.ticker.toLowerCase().includes("gold")) || ["BOVA11", "IVVB11", "SMAL11"].includes(p.ticker.toUpperCase()));
    }
    if (type === "gold") {
      return positions.filter(p => p.ticker === "GOLD11" || p.ticker.toLowerCase().includes("gold") || p.type === "crypto" || p.ticker.toUpperCase() === "HASH11");
    }
    return [];
  };

  const getDetailedAssetStats = (id: string) => {
    switch(id) {
      case "cdb_pool":
        return {
          title: "Cofre Conservador (CDB / Selic)",
          desc: "Alocação focada em liquidez diária e blindagem de patrimônio base. Rende ~10.5% a.a. com controle de risco automático e aportes automáticos.",
          allocTarget: "20%",
          risk: "Ultra Baixo",
          aiManager: "Bia",
          connectedCount: getGroupPositions("cdb").length
        };
      case "stocks_grid":
        return {
          title: "Tecnopolo de Ações (Ibovespa PN/ON)",
          desc: "Rastreio e varredura de tendências de alta em ações de valor (WEGE3, PETR4, ITUB4). Vigilância e análise constante do setor pelos personagens.",
          allocTarget: "40%",
          risk: "Alto (Renda Variável)",
          aiManager: "Alô",
          connectedCount: getGroupPositions("stocks").length
        };
      default:
        return {
          title: "Cofre Conservador (CDB / Selic)",
          desc: "Alocação focada em liquidez diária e blindagem de patrimônio base. Rende ~10.5% a.a. com controle de risco automático e aportes automáticos.",
          allocTarget: "20%",
          risk: "Ultra Baixo",
          aiManager: "Bia",
          connectedCount: getGroupPositions("cdb").length
        };
    }
  };

  // Predefined style templates for up to 7 characters (looping ensures we can support more seamlessly)
  const agentTemplates = useMemo(() => [
    {
      avatarColor: "#ec4899",
      accessory: "headphones" as const,
      gender: "female" as const,
      assignedAssetId: "cdb_pool",
      suitColor: "#1e1b4b",
      hairColor: "#78350f",
      sitRotate: -Math.PI,
      spawnX: 1.1, spawnZ: -0.3
    },
    {
      avatarColor: "#06b6d4",
      accessory: "glasses" as const,
      gender: "male" as const,
      assignedAssetId: "stocks_grid",
      suitColor: "#1f2937",
      hairColor: "#111827",
      sitRotate: 0,
      spawnX: -0.4, spawnZ: 1.1
    },
    {
      avatarColor: "#f97316",
      accessory: "tie" as const,
      gender: "male" as const,
      assignedAssetId: "stocks_grid",
      suitColor: "#374151",
      hairColor: "#334155",
      sitRotate: 0,
      spawnX: 1.1, spawnZ: 1.2
    },
    {
      avatarColor: "#10b981",
      accessory: "none" as const,
      gender: "male" as const,
      assignedAssetId: "cdb_pool",
      suitColor: "#1e3a8a",
      hairColor: "#111827",
      sitRotate: -Math.PI,
      spawnX: 0.3, spawnZ: 0.4
    },
    {
      avatarColor: "#a855f7",
      accessory: "glasses" as const,
      gender: "female" as const,
      assignedAssetId: "cdb_pool",
      suitColor: "#0f172a",
      hairColor: "#b45309",
      sitRotate: Math.PI / 2,
      spawnX: 0.0, spawnZ: 0.0
    },
    {
      avatarColor: "#eab308",
      accessory: "tie" as const,
      gender: "female" as const,
      assignedAssetId: "cdb_pool",
      suitColor: "#1e293b",
      hairColor: "#1c1917",
      sitRotate: -Math.PI / 2,
      spawnX: -0.8, spawnZ: -0.2
    },
    {
      avatarColor: "#f43f5e",
      accessory: "headphones" as const,
      gender: "male" as const,
      assignedAssetId: "stocks_grid",
      suitColor: "#3b82f6",
      hairColor: "#4b5563",
      sitRotate: 0,
      spawnX: 0.5, spawnZ: -0.8
    }
  ], []);

  // Suporte de amostragem de até 6 ativos ativamente no escritório virtual
  const activePositions = useMemo(() => {
    return positions && positions.length > 0 ? positions.slice(0, 6) : [];
  }, [positions]);

  const getAssetVariation = (pos: any) => {
    if (pos.id.startsWith("mock_")) {
      if (pos.ticker === "SELIC") return 5.1;
      if (pos.ticker === "VALE3") return 3.2;
      if (pos.ticker === "FIIs") return 1.8;
      if (pos.ticker === "GOLD11") return -1.2;
      return 1.5;
    }
    const q = quotes[pos.ticker];
    const currentPrice = q ? q.price : pos.purchasePrice;
    return pos.purchasePrice > 0 ? ((currentPrice - pos.purchasePrice) / pos.purchasePrice) * 100 : 0;
  };

  const getDynamicAssignedAssetId = (pos: Position) => {
    if (pos.ticker === "GOLD11" || pos.ticker.toLowerCase().includes("gold") || pos.type === "crypto" || pos.ticker.toUpperCase() === "HASH11") {
      return "stocks_grid";
    }
    if (pos.type === "fund") {
      return "cdb_pool";
    }
    if (pos.type === "stock" || ["BOVA11", "IVVB11", "SMAL11"].includes(pos.ticker.toUpperCase())) {
      return "stocks_grid";
    }
    return "cdb_pool";
  };

  const dynamicAgents = useMemo(() => {
    return activePositions.map((pos, index) => {
      const template = agentTemplates[index % agentTemplates.length];
      const isCrypto = pos.type === "crypto";
      const isFii = pos.type === "fund";
      const isEtf = pos.type === "etf";
      const typeText = isCrypto ? "Criptomoedas" : isFii ? "Fundos Imobiliários" : isEtf ? "ETF / Renda Fixa" : "Ações de Bolsa";
      
      return {
        id: `agent_${pos.id}`,
        name: pos.ticker,
        role: `${typeText} • ${pos.name}`,
        efficiency: Math.round(95 + (pos.quantity % 5) * 10) / 10,
        variation: getAssetVariation(pos),
        avatarColor: template.avatarColor,
        suitColor: template.suitColor,
        hairColor: template.hairColor,
        accessory: template.accessory,
        gender: template.gender,
        assignedAssetId: getDynamicAssignedAssetId(pos),
        sitRotate: template.sitRotate,
        x: template.spawnX,
        y: 0,
        z: template.spawnZ,
        targetX: template.spawnX,
        targetZ: template.spawnZ,
        state: "talk" as const,
        stateTimer: 2 + Math.floor(Math.random() * 5),
      };
    });
  }, [activePositions, quotes, agentTemplates]);

  return (
    <div className="flex flex-col bg-[#090514] text-stone-100 h-full w-full relative overflow-hidden" id="virtual-office-room">
      {/* 2. ISOMETRIC STAGE CONTAINER */}
      <div className="relative flex-1 w-full flex items-center justify-center bg-gradient-to-b from-[#090514] to-[#040209]">
        {/* 3D Scene viewport */}
        <div className="w-full h-full relative">
          <Suspense fallback={<OfficeLoadingFallback />}>
            <ThreeOfficeScene
              agents={dynamicAgents}
              portfolioStats={portfolioStats}
              onSelectEntity={setSelectedEntity}
              selectedEntity={selectedEntity}
              onAgentsUpdate={setSimulatedAgents}
              isMarketOpen={true}
              isActive={isActive}
            />
          </Suspense>
        </div>
      </div>

      {/* 3. PERFORMANCE STATS PANEL (BOTTOM HUD) */}
      {!selectedEntity && (
        <div className="absolute bottom-[84px] inset-x-2.5 z-40 animate-fade-in pointer-events-auto">
          <div className="rounded-2xl border border-stone-800 bg-[#0c0817]/95 backdrop-blur-md p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-3 transition">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest whitespace-nowrap">Patrimônio Total:</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-mono font-extrabold text-white whitespace-nowrap">
                    R$ {portfolioStats.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${
                    portfolioStats.variationPercent >= 0 
                    ? "text-emerald-400 bg-emerald-500/10" 
                    : "text-rose-400 bg-rose-500/10"
                  }`}>
                    {portfolioStats.variationPercent >= 0 ? <TrendingUp size={11} className="inline animate-bounce" /> : <TrendingDown size={11} className="inline" />}
                    {portfolioStats.variationPercent >= 0 ? "+" : ""}{portfolioStats.variationPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[9.5px] font-bold text-stone-400 uppercase tracking-widest whitespace-nowrap">Lucro Total:</p>
                <p className="text-sm font-mono font-bold text-emerald-400 animate-pulse whitespace-nowrap mt-1">
                  R$ {portfolioStats.profit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SELECTION OVERLAY BOTTOM DRAWER */}
      {selectedEntity && (
        <div className="absolute bottom-[84px] inset-x-2 z-50 animate-slide-up">
          <div className="rounded-2xl border border-stone-800 bg-[#0c0817]/95 backdrop-blur-md p-4 shadow-2xl flex flex-col gap-3.5 relative overflow-hidden">
            {/* Background decoration blur */}
            <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            
            {/* Header section with Close button */}
            <div className="flex items-start justify-between relative z-10">
              {selectedEntity.type === "agent" ? (
                (() => {
                  const currentAgent = simulatedAgents.find(a => a.id === selectedEntity.id) || dynamicAgents.find(a => a.id === selectedEntity.id);
                  if (!currentAgent) return null;
                  return (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl relative grid place-items-center font-bold text-white text-sm" style={{ backgroundColor: currentAgent.avatarColor }}>
                        {currentAgent.name[0]}
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-stone-950 text-[8px] text-emerald-400 border border-stone-800">
                          {currentAgent.accessory === "glasses" ? "🕶️" : currentAgent.accessory === "headphones" ? "🎧" : "💼"}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                          Personagem {currentAgent.name}
                          <span className={`shrink-0 text-[8.5px] px-1 py-0.1 ${currentAgent.variation >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"} rounded-sm font-mono border border-stone-800`}>
                            {currentAgent.variation >= 0 ? "LUCRO" : "PREJUÍZO"}
                          </span>
                        </h2>
                        <p className="text-[9.5px] text-stone-400 mt-0.5">{currentAgent.role}</p>
                      </div>
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const meta = getDetailedAssetStats(selectedEntity.id);
                  return (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl grid place-items-center bg-stone-950 border border-stone-800">
                        {selectedEntity.id === "cdb_pool" && <Zap size={18} className="text-sky-400 animate-pulse" />}
                        {selectedEntity.id === "stocks_grid" && <Layers size={18} className="text-purple-400 animate-bounce" />}
                      </div>
                      <div>
                        <h2 className="text-xs font-bold text-white uppercase tracking-wide">
                          {meta.title}
                        </h2>
                        <p className="text-[9.5px] text-stone-400 mt-0.5">Módulo de Ativos Ativos</p>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Dismiss button */}
              <button 
                onClick={() => setSelectedEntity(null)}
                className="p-1 px-2.5 text-[9.5px] font-bold text-stone-400 bg-stone-950 hover:text-white rounded-lg transition active:scale-95 border border-stone-800 cursor-pointer"
              >
                Voltar
              </button>
            </div>

            {/* Inner description blocks */}
            <div className="text-[10px] space-y-2 relative z-10 text-stone-300">
              {selectedEntity.type === "agent" ? (
                (() => {
                  const currentAgent = simulatedAgents.find(a => a.id === selectedEntity.id) || dynamicAgents.find(a => a.id === selectedEntity.id);
                  if (!currentAgent) return null;
                  return (
                    <>
                      <p className="leading-relaxed bg-stone-950 p-2.5 rounded-xl border border-stone-800/50 text-stone-400">
                        "Prestando suporte operacional e auditoria em tempo real na rede descentralizada do seu portfólio. Rentabilidade sob vigilância constante."
                      </p>

                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="bg-stone-950 p-2 rounded-xl border border-stone-800/40 text-[9px]">
                          <p className="text-stone-400 font-bold">Monitorando:</p>
                          <p className="text-white font-mono uppercase font-bold mt-0.5">
                            {currentAgent.assignedAssetId === "cdb_pool" ? "✦ CDB Pool" : "✦ Tapete de Ações"}
                          </p>
                        </div>
                        <div className="bg-stone-950 p-2 rounded-xl border border-stone-800/40 text-[9px]">
                          <p className="text-stone-400 font-bold">Precisão Operacional:</p>
                          <p className="text-emerald-400 font-mono font-bold mt-0.5">
                            {currentAgent.efficiency}% Eficiência
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="bg-stone-950 p-2 rounded-xl border border-stone-800/40 text-[9px]">
                          <p className="text-stone-400 font-bold">Personalidade:</p>
                          <p className="text-amber-400 font-bold mt-0.5 font-sans">
                            {currentAgent.personality === "workaholic" ? "Foco no Trabalho 💼" :
                             currentAgent.personality === "gamer" ? "Gamer / Lazer 🎮" :
                             currentAgent.personality === "swimmer" ? "Chilista na Piscina 🏊" :
                             currentAgent.personality === "socializer" ? "Networking 🗣️" : "Equilibrado 🍃"}
                          </p>
                        </div>
                        <div className="bg-stone-950 p-2 rounded-xl border border-stone-800/40 text-[9px]">
                          <p className="text-stone-400 font-bold">Atividade Atual:</p>
                          <p className="text-sky-400 font-bold mt-0.5 font-sans">
                            {currentAgent.lifeStatus || "Concentrado ✨"}
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()
              ) : (
                (() => {
                  const meta = getDetailedAssetStats(selectedEntity.id);
                  return (
                    <>
                      <p className="leading-relaxed bg-stone-950 p-2.5 rounded-xl border border-stone-800/50 text-stone-400">
                        {meta.desc}
                      </p>

                      <div className="grid grid-cols-3 gap-2 mt-1.5">
                        <div className="bg-stone-950 p-2 rounded-xl border border-stone-800/30 text-center">
                          <p className="text-[8px] font-bold text-stone-400 uppercase">Alocação Alvo</p>
                          <p className="text-[10px] font-bold text-white font-mono mt-0.5">{meta.allocTarget}</p>
                        </div>
                        <div className="bg-stone-950 p-2 rounded-xl border border-stone-800/30 text-center">
                          <p className="text-[8px] font-bold text-stone-400 uppercase">Grau de Risco</p>
                          <p className="text-[10px] font-bold text-white mt-0.5">{meta.risk}</p>
                        </div>
                        <div className="bg-stone-950 p-2 rounded-xl border border-stone-800/30 text-center">
                          <p className="text-[8px] font-bold text-stone-400 uppercase">Personagem Líder</p>
                          <p className="text-[10px] font-bold text-emerald-400 mt-0.5">{meta.aiManager}</p>
                        </div>
                      </div>

                      {meta.connectedCount > 0 && (
                        <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 bg-emerald-500/10 p-1.5 px-2 rounded-lg border border-emerald-500/20 mt-1">
                          <CheckCircle size={10} />
                          <span>Identificamos <strong>{meta.connectedCount} ativo(s)</strong> reais da sua carteira conectados a esse módulo.</span>
                        </div>
                      )}
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
