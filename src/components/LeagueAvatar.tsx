type Props = {
  /** Tamanho do avatar em px */
  size: number;
  /** Espessura do anel em px (mantido para compatibilidade, ignorado) */
  ringWidth?: number;
  /** Liga atual do usuário (mantido para compatibilidade, ignorado) */
  league?: any;
  /** Cor de fundo do avatar quando sem foto (gradiente Tailwind) */
  bgGradient?: string;
  /** URL da foto, se houver */
  photo?: string | null;
  /** Iniciais para fallback */
  initials: string;
  /** Mostrar emoji do tier no canto (mantido para compatibilidade, ignorado) */
  showBadge?: boolean;
  /** Animar o anel com efeito de brilho/rotação suave (mantido para compatibilidade, ignorado) */
  animated?: boolean;
  /** Cor da borda interna — usar bg do contexto (mantido para compatibilidade, ignorado) */
  innerBorder?: string;
};

/**
 * Avatar simplificado e elegante, livre do anel de "Ligas".
 */
export default function LeagueAvatar({
  size,
  bgGradient = "from-emerald-500 via-teal-500 to-sky-500",
  photo,
  initials,
}: Props) {
  const fontSize = Math.max(11, size * 0.35);

  return (
    <span
      className="relative inline-block shrink-0 rounded-full p-1 bg-gradient-to-tr from-emerald-500 via-emerald-600 to-teal-500 shadow-md shadow-emerald-500/10"
      style={{ width: size, height: size }}
    >
      <span
        className={`absolute inset-1 rounded-full overflow-hidden ${photo ? "" : "grid place-items-center"} bg-gradient-to-br ${bgGradient}`}
      >
        {photo ? (
          <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" style={{ fontSize }}>
            {initials}
          </span>
        )}
      </span>
    </span>
  );
}
