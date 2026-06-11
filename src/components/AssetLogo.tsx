import { useState } from "react";
import type { AssetType } from "../services/assetsCatalog";

type Props = {
  ticker: string;
  logo?: string;
  type: AssetType;
  size?: number;
  className?: string;
};

const typeColors: Record<AssetType, string> = {
  stock: "from-emerald-400 to-teal-500",
  fund: "from-sky-400 to-blue-500",
  etf: "from-violet-400 to-purple-500",
  crypto: "from-amber-400 to-orange-500",
};

export default function AssetLogo({ ticker, logo, type, size = 40, className = "" }: Props) {
  const [err, setErr] = useState(false);

  if (logo && !err) {
    return (
      <div
        className={`shrink-0 rounded-xl overflow-hidden bg-white border border-stone-200 grid place-items-center ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={logo}
          alt={ticker}
          onError={() => setErr(true)}
          className="object-contain"
          style={{ width: size - 8, height: size - 8 }}
        />
      </div>
    );
  }

  // Fallback: gradiente com iniciais
  const initials = ticker.slice(0, 2).toUpperCase();
  return (
    <div
      className={`shrink-0 rounded-xl bg-gradient-to-br ${typeColors[type]} grid place-items-center text-white font-bold shadow-sm ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}
