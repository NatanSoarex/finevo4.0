import React, { useState, useEffect } from "react";
import { 
  Play, Plus, Trash2, Edit2, X, Video, Info, Sparkles, Tv, Eye, Layout, Handshake
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../services/auth";

interface VideoItem {
  id: string;
  title: string;
  description: string;
  url: string;
  duration: string;
  views: number;
  isPartner: boolean; // Flag de parceria com o canal
}

const DEFAULT_VIDEOS: VideoItem[] = [
  {
    id: "v1",
    title: "Como começar a Investir do Zero absoluto!",
    description: "Um guia essencial para você entender o mindset investidor, dar o primeiro passo com segurança e montar sua primeira carteira de investimentos.",
    url: "https://www.youtube.com/watch?v=F_fO5_7Zl50",
    duration: "18:42",
    views: 842,
    isPartner: true,
  },
  {
    id: "v2",
    title: "O que são Ações e Como Funciona a Bolsa?",
    description: "Conceitos básicos fundamentais para compreender como funcionam as ações das maiores empresas do Brasil, como comprar o primeiro lote de ativos e o que são os dividendos.",
    url: "https://www.youtube.com/watch?v=ZfWv_3qY_Xg",
    duration: "15:10",
    views: 612,
    isPartner: true,
  },
  {
    id: "v3",
    title: "Fundos Imobiliários: Gerando Renda Mensal recorrente",
    description: "Aprenda a receber aluguéis mensais sem precisar comprar imóveis físicos. O que analisar em um FII, como funciona a taxa de vacância e os dividendos isentos de imposto de renda.",
    url: "https://www.youtube.com/watch?v=S0T8fXyQ7v8",
    duration: "22:15",
    views: 947,
    isPartner: false,
  },
  {
    id: "v4",
    title: "Tesouro Direto na prática: Qual escolher?",
    description: "Comparativo prático entre Tesouro Selic, IPCA+ e Prefixado. Saiba onde colocar sua reserva de emergência e entenda o impacto da inflação no seu patrimônio.",
    url: "https://www.youtube.com/watch?v=_u_Zt_r8sJ4",
    duration: "13:58",
    views: 436,
    isPartner: true,
  }
];

export function getYoutubeId(url: string): string {
  if (!url) return "";
  let vidId = "";
  // Check for various patterns
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    vidId = match[2];
  } else if (url.trim().length === 11) {
    vidId = url.trim();
  } else {
    // Try manual matching for /shorts/
    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch && shortsMatch[1]) {
      vidId = shortsMatch[1];
    }
  }
  return vidId;
}

export function getYoutubeThumbnail(url: string): string {
  const vidId = getYoutubeId(url);
  if (vidId) {
    return `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
  }
  return "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"; // fallback visual elegante
}

export default function AcademyTab() {
  const { user } = useAuth();
  const isAdmin = user?.usernameLower === "adm_evo";
  const [videos, setVideos] = useState<VideoItem[]>([]);
  
  // Modo Edição / Curadoria (Owner)
  const [adminMode, setAdminMode] = useState(false);
  const [showAddVidModal, setShowAddVidModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<VideoItem | null>(null);

  // States Formulário Vídeo
  const [vidTitle, setVidTitle] = useState("");
  const [vidDesc, setVidDesc] = useState("");
  const [vidUrl, setVidUrl] = useState("");
  const [vidDuration, setVidDuration] = useState("Vídeo");
  const [vidIsPartner, setVidIsPartner] = useState(true); // default true como sugerido pelo usuário 
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Carrega do LocalStorage ou define padrões
  useEffect(() => {
    const cachedVids = localStorage.getItem("finevo:academy_videos");

    if (cachedVids) {
      setVideos(JSON.parse(cachedVids));
    } else {
      setVideos(DEFAULT_VIDEOS);
      localStorage.setItem("finevo:academy_videos", JSON.stringify(DEFAULT_VIDEOS));
    }
  }, []);

  // Efeito para carregar Metadados dinamicamente do YouTube via noembed
  useEffect(() => {
    const fetchMetadata = async () => {
      const vidId = getYoutubeId(vidUrl);
      if (!vidId) return;

      setLoadingMetadata(true);
      try {
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(vidUrl)}`);
        const data = await res.json();
        if (data && data.title) {
          setVidTitle(data.title);
          setVidDesc(data.author_name ? `Canal: ${data.author_name}. Assista a este vídeo no YouTube.` : "Vídeo educativo recomendado.");
          setVidDuration("Vídeo");
        } else {
          setVidTitle("Vídeo do YouTube");
          setVidDesc("Assista a este vídeo recomendado no YouTube.");
        }
      } catch (err) {
        setVidTitle("Vídeo de Finanças & Investimentos");
        setVidDesc("Estudo de inteligência financeira recomendado.");
      } finally {
        setLoadingMetadata(false);
      }
    };

    const timer = setTimeout(() => {
      if (vidUrl.trim() !== "" && getYoutubeId(vidUrl)) {
        fetchMetadata();
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [vidUrl]);

  const saveVideos = (newVids: VideoItem[]) => {
    setVideos(newVids);
    localStorage.setItem("finevo:academy_videos", JSON.stringify(newVids));
  };

  // Gerenciamento de Vídeos
  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!vidUrl) return;

    const finalTitle = vidTitle.trim() !== "" ? vidTitle : "Vídeo do YouTube";
    const finalDesc = vidDesc.trim() !== "" ? vidDesc : "Assista a este vídeo recomendado.";

    const newVid: VideoItem = {
      id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: finalTitle,
      description: finalDesc,
      url: vidUrl,
      duration: vidDuration || "Vídeo",
      views: 0,
      isPartner: vidIsPartner
    };

    const updated = [...videos, newVid];
    saveVideos(updated);
    
    // Reseta form
    resetForm();
    setShowAddVidModal(false);
  };

  const handleUpdateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingVideo || !vidUrl) return;

    const finalTitle = vidTitle.trim() !== "" ? vidTitle : editingVideo.title;
    const finalDesc = vidDesc.trim() !== "" ? vidDesc : editingVideo.description;

    const updated = videos.map((v) => {
      if (v.id === editingVideo.id) {
        return {
          ...v,
          title: finalTitle,
          description: finalDesc,
          url: vidUrl,
          duration: vidDuration,
          isPartner: vidIsPartner
        };
      }
      return v;
    });

    saveVideos(updated);
    setEditingVideo(null);
    resetForm();
    setShowAddVidModal(false);
  };

  const resetForm = () => {
    setVidTitle("");
    setVidDesc("");
    setVidUrl("");
    setVidDuration("Vídeo");
    setVidIsPartner(true);
    setLoadingMetadata(false);
  };

  const handleDeleteVideo = (vid: VideoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setVideoToDelete(vid);
  };

  const startEditVideo = (v: VideoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setEditingVideo(v);
    setVidTitle(v.title);
    setVidDesc(v.description);
    setVidUrl(v.url);
    setVidDuration(v.duration);
    setVidIsPartner(v.isPartner ?? false);
    setShowAddVidModal(true);
  };

  // Incrementa o contador de visualização
  const handlePlayCount = (vid: VideoItem) => {
    const updated = videos.map((v) => {
      if (v.id === vid.id) {
        return { ...v, views: (v.views || 0) + 1 };
      }
      return v;
    });
    saveVideos(updated);
  };

  return (
    <div className="px-5 pt-8 pb-32 md:pb-12 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
        <div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <h1 className="text-2xl font-black tracking-tight text-stone-900">Vídeos Recomendados</h1>
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-emerald-200/50">
              <Sparkles size={10} /> Parceiros
            </span>
          </div>
          <p className="text-[12px] text-stone-500 mt-1">Aulas selecionadas a dedo e canais parceiros certificados para acelerar sua jornada de investidor.</p>
        </div>

        {/* Curator Buttons */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdminMode(!adminMode)}
              className={`h-9 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 border ${
                adminMode 
                  ? "bg-stone-900 text-white border-stone-800 shadow-sm" 
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              <Layout size={13} />
              {adminMode ? "Sair do Modo de Gestão" : "Gerenciar Vídeos"}
            </button>

            {adminMode && (
              <button
                onClick={() => {
                  setEditingVideo(null);
                  resetForm();
                  setShowAddVidModal(true);
                }}
                className="h-9 px-4 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition shadow-sm shadow-emerald-500/20 flex items-center gap-1"
              >
                <Plus size={13} /> Adicionar Vídeo
              </button>
            )}
          </div>
        )}
      </header>

      {/* Grid Simplificado de Vídeos */}
      <main className="space-y-4">
        {videos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-200 bg-white p-16 text-center animate-fade-in max-w-xl mx-auto">
            <Video size={48} className="mx-auto text-stone-300 mb-3" />
            <h4 className="text-sm font-bold text-stone-700 uppercase tracking-tight">Nenhum vídeo recomendado</h4>
            <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
              Use o botão de <strong>Gerenciar Vídeos</strong> no topo direito para cadastrar as primeiras aulas com link do YouTube e marcar quais são canais parceiros!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((vid) => {
              const thumb = getYoutubeThumbnail(vid.url);
              return (
                <div
                  key={vid.id}
                  className="group bg-white rounded-2xl border border-stone-200/80 hover:border-emerald-400 transition-all duration-300 shadow-sm hover:shadow-[0_12px_32px_rgba(16,185,129,0.05)] flex flex-col overflow-hidden"
                >
                  {/* ÁREA CLICÁVEL PRINCIPAL (Isolada dos botões administrativos) */}
                  <a 
                    href={vid.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handlePlayCount(vid)}
                    className="cursor-pointer flex-1 flex flex-col animate-fade-in text-inherit no-underline"
                    id={`vid_link_${vid.id}`}
                  >
                    {/* Thumbnail com badges */}
                    <div className="relative aspect-video w-full bg-stone-900 overflow-hidden text-stone-100">
                      <img
                        src={thumb}
                        alt={vid.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                        id={`thumb_${vid.id}`}
                      />
                      <div className="absolute inset-0 bg-stone-950/20 group-hover:bg-stone-950/40 transition-colors" />
                      
                      {/* Botão Play centralizado e duração */}
                      <div className="absolute inset-x-0 bottom-3 px-3 flex items-center justify-between z-10">
                        <span className="bg-stone-950/80 backdrop-blur-md text-white text-[9.5px] font-bold tracking-wide px-2 py-0.5 rounded-lg font-sans">
                          {vid.duration}
                        </span>
                        
                        <div className="h-9 w-9 flex items-center justify-center rounded-full bg-white text-stone-950 shadow-md group-hover:bg-emerald-500 group-hover:text-white group-hover:scale-110 transition-all duration-300">
                          <Play size={14} fill="currentColor" className="ml-0.5" />
                        </div>
                      </div>

                      {/* Badge da Direita: PARCERIA OFICIAL */}
                      {vid.isPartner && (
                        <div className="absolute top-3 right-3 bg-gradient-to-r from-emerald-600/90 to-teal-600/90 backdrop-blur-md shadow-md text-white font-extrabold text-[9px] tracking-wider px-2.5 py-1 rounded-lg flex items-center gap-1 border border-emerald-400/30 animate-pulse">
                          <Handshake size={10} className="text-white" />
                          <span>PARCERIA 🤝</span>
                        </div>
                      )}
                    </div>

                    {/* Informações */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <h3 className="text-[13px] font-extrabold text-stone-900 tracking-tight leading-snug line-clamp-2 uppercase group-hover:text-emerald-600 transition-colors">
                          {vid.title}
                        </h3>
                        <p className="text-[11px] text-stone-500 leading-relaxed line-clamp-2">
                          {vid.description || "Sem descrição disponível."}
                        </p>
                      </div>
                    </div>
                  </a>

                  {/* Botões do Painel Admin (Fora da área clicável principal) */}
                  {adminMode && isAdmin && (
                    <div className="px-4 pb-4 pt-0 self-stretch">
                      <div className="flex items-center justify-end gap-1.5 border-t border-stone-100 pt-3">
                        <button
                          type="button"
                          onClick={(e) => startEditVideo(vid, e)}
                          className="h-7 px-2.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 text-[10px] font-bold flex items-center gap-1 transition"
                        >
                          <Edit2 size={10} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteVideo(vid, e)}
                          className="h-7 w-7 grid place-items-center border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                          title="Remover vídeo"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL ADICIONAR / EDITAR VÍDEO (Com seletor de Parceria e Capa Live!) */}
      <AnimatePresence>
        {showAddVidModal && isAdmin && (
          <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-[999] overflow-y-auto flex items-start sm:items-center justify-center p-4 py-8 animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 pb-28 sm:pb-8 border border-stone-200 relative my-auto"
              id="video_upsert_modal"
            >
              {/* Botão de Fechar */}
              <button
                type="button"
                onClick={() => {
                  setShowAddVidModal(false);
                  setEditingVideo(null);
                }}
                className="absolute top-4 right-4 h-8 w-8 grid place-items-center rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition"
              >
                <X size={16} />
              </button>

              <div className="mb-4">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md">Curadoria de Vídeos</span>
                <h3 className="text-sm font-bold text-stone-950 tracking-tight mt-1 uppercase">
                  {editingVideo ? "Editar Link do Vídeo" : "Recomendar Novo Vídeo"}
                </h3>
              </div>

              {/* LIVE PLAYBACK PREVIEW (Solicitação do usuário: Já aparece a capa quando coloca link!) */}
              {vidUrl.trim() !== "" && getYoutubeId(vidUrl) && (
                <div className="mb-4 space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Visualização da Capa:</p>
                    {loadingMetadata && (
                      <span className="text-[9px] text-emerald-600 font-bold animate-pulse flex items-center gap-1">
                        Carregando dados...
                      </span>
                    )}
                  </div>
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-stone-900 border border-stone-200">
                    <img
                      src={getYoutubeThumbnail(vidUrl)}
                      alt="Capa do YouTube"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {vidIsPartner && (
                      <div className="absolute top-2.5 right-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 shadow text-white font-extrabold text-[8px] tracking-wider px-2 py-0.5 rounded-md flex items-center gap-0.5 border border-emerald-400/20">
                        <Handshake size={8} />
                        <span>PARCERIA 🤝</span>
                      </div>
                    )}
                  </div>
                  {vidTitle && (
                    <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">Título Capturado:</p>
                      <p className="text-[11px] font-bold text-stone-800 line-clamp-2 uppercase leading-snug">{vidTitle}</p>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={editingVideo ? handleUpdateVideo : handleAddVideo} className="space-y-4 text-xs font-medium text-stone-700">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Link do Vídeo no YouTube *</label>
                  <input
                    type="url"
                    required
                    value={vidUrl}
                    onChange={(e) => setVidUrl(e.target.value)}
                    placeholder="Ex: https://www.youtube.com/watch?v=F_fO5_7Zl50"
                    className="w-full h-10 px-3 bg-stone-50 hover:bg-stone-100/50 focus:bg-white border border-stone-200 rounded-xl focus:border-emerald-500 outline-none text-stone-800 transition"
                  />
                  <p className="text-[10px] text-stone-400 italic font-sans leading-normal">Basta colar o link. Nós buscamos a capa e o título do YouTube automaticamente!</p>
                </div>

                {/* BOTÃO PARA ATIVAR PARCERIA (Sugerido pelo usuário!) */}
                <div className="p-3 bg-stone-50 border border-stone-200/60 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <p className="text-xs font-bold text-stone-800">Parceria Oficial 🤝</p>
                    <p className="text-[10px] text-stone-500 leading-normal">Exibe o selo de canal parceiro verificado na capa do vídeo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVidIsPartner(!vidIsPartner)}
                    className={`h-7 px-3.5 rounded-lg text-[11px] font-bold transition-all duration-200 flex items-center gap-1 ${
                      vidIsPartner 
                        ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/10" 
                        : "bg-white text-stone-500 border border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    {vidIsPartner ? "Ativo" : "Inativo"}
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loadingMetadata}
                    className={`w-full h-10 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition shadow outline-none ${
                      loadingMetadata ? "opacity-70 cursor-not-allowed" : ""
                    }`}
                  >
                    <Plus size={14} /> {editingVideo ? "Salvar Novo Link" : "Salvar e Recomendar"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CONFIRMAÇÃO DE DELETAR (Seguro para iframes!) */}
      <AnimatePresence>
        {videoToDelete && isAdmin && (
          <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 border border-stone-200 relative text-center"
              id="confirm_delete_modal"
            >
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-3">
                <Trash2 size={22} className="stroke-[2.5px]" />
              </div>
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-tight">Excluir Vídeo Recomendado?</h3>
              <p className="text-[11px] text-stone-500 mt-2 leading-relaxed">
                Você tem certeza que deseja remover <strong className="text-stone-800">"{videoToDelete.title}"</strong> da curadoria?
              </p>
              <div className="flex items-center gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setVideoToDelete(null)}
                  className="flex-1 h-9 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const filtered = videos.filter((v) => v.id !== videoToDelete.id);
                    saveVideos(filtered);
                    setVideoToDelete(null);
                  }}
                  className="flex-1 h-9 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition shadow"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
