import React, { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null; info: ErrorInfo | null };

/**
 * Captura erros em qualquer parte da árvore e mostra uma tela amigável
 * em vez de tela branca. Em produção também loga no console.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[FinEvo ErrorBoundary]", error, info);
    this.setState({ info });
  }

  reset = () => {
    try {
      this.setState({ hasError: false, error: null, info: null });
    } catch {
      window.location.reload();
    }
  };

  clearStorageAndReload = () => {
    try {
      localStorage.clear();
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen w-full bg-[#f6f5f0] text-stone-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200 shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 grid place-items-center rounded-2xl bg-rose-100 text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <line x1="12" x2="12" y1="9" y2="13" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-900">Ops, algo deu errado</h1>
              <p className="text-xs text-stone-500">Encontramos um problema ao carregar o app</p>
            </div>
          </div>

          {this.state.error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3 mb-4">
              <p className="text-[11px] font-mono text-rose-800 break-words">
                {this.state.error.message || "Erro desconhecido"}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={this.reset}
              className="w-full py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition shadow-md shadow-emerald-500/30"
            >
              🔄 Tentar de novo
            </button>
            <button
              onClick={this.clearStorageAndReload}
              className="w-full py-3 rounded-2xl bg-stone-100 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition"
            >
              🧹 Limpar dados e recarregar
            </button>
          </div>

          <p className="text-[10px] text-stone-400 text-center mt-4">
            Se o problema persistir, tente abrir em outro navegador.
          </p>
        </div>
      </div>
    );
  }
}
