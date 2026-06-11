import React, { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function Modal({ open, onClose, title, subtitle, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[460px] max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-stone-200 bg-white shadow-[0_20px_80px_-10px_rgba(28,25,23,0.25)] animate-slide-up scrollbar-hide">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-5 pt-5 pb-3 bg-white/95 backdrop-blur-md border-b border-stone-100">
          <div>
            {title && <h3 className="text-lg font-semibold text-stone-900">{title}</h3>}
            {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4">
          {children}
          
          {/* Botão de backup no rodapé para fácil usabilidade e acessibilidade */}
          <div className="mt-8 pt-4 border-t border-stone-100">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-[0.98] text-stone-700 font-bold text-xs transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
