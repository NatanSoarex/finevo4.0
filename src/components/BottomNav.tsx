import { Home, Wallet, Trophy, User, Users, Tv } from "lucide-react";
import { motion } from "motion/react";

export type TabId = "home" | "academy" | "profile";

type Props = {
  active: TabId;
  onChange: (id: TabId) => void;
};

const items: { id: TabId; label: string; Icon: typeof Tv }[] = [
  { id: "home",    label: "Início",    Icon: Home },
  { id: "academy", label: "Vídeos",    Icon: Tv },
  { id: "profile", label: "Perfil",    Icon: User },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] z-50 md:hidden">
      <div className="mx-3 mb-3 rounded-2xl border border-stone-200/80 bg-white/90 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(28,25,23,0.12)]">
        <div className="grid grid-cols-3 px-1 py-1.5 relative">
          {items.map(({ id, label, Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                className="relative flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-150 group cursor-pointer active:scale-95 touch-manipulation"
              >
                {isActive && (
                  <>
                    {/* Background slide/pill */}
                    <motion.span
                      layoutId="activeTabBg"
                      className="absolute inset-0 bg-stone-100/70 rounded-xl -z-10"
                      transition={{ type: "spring", stiffness: 480, damping: 35 }}
                    />
                    {/* Top slide indicator bar */}
                    <motion.span
                      layoutId="activeTabLine"
                      className="absolute inset-x-4 top-0.5 h-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
                      transition={{ type: "spring", stiffness: 480, damping: 35 }}
                    />
                  </>
                )}
                <span
                  className={`transition-all duration-300 ${
                    isActive
                      ? "scale-110 text-emerald-600"
                      : "text-stone-400 group-hover:text-stone-600"
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                </span>
                <span
                  className={`text-[10px] font-medium tracking-wide transition-all duration-300 ${
                    isActive ? "text-stone-900" : "text-stone-400 group-hover:text-stone-600"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
