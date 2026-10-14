import Icon, { type IconName } from "./Icon";

export interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  badge?: number;
  tone?: "normal" | "locked" | "alert";
}

/** Barra de navegación inferior, al alcance del pulgar. Con más de cinco pestañas se desplaza en horizontal. */
export default function BottomNav({
  items,
  active,
  onSelect,
  className = "",
}: {
  items: NavItem[];
  active: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    <nav className={`safe-bottom shrink-0 border-t border-term-line bg-term-panel ${className}`}>
      <div className="no-scrollbar flex overflow-x-auto">
        {items.map((item) => {
          const isActive = item.key === active;
          const color = isActive
            ? "text-term-green"
            : item.tone === "locked"
              ? "text-term-amber/80"
              : item.tone === "alert"
                ? "text-term-red"
                : "text-term-dim";
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-[58px] min-w-[52px] flex-1 flex-col items-center justify-center gap-1 px-1 ${color}`}
            >
              {isActive && <span className="absolute inset-x-2 top-0 h-0.5 bg-term-green" />}
              <Icon name={item.icon} className="h-5 w-5" />
              <span className="text-[9px] tracking-wider">{item.label}</span>
              {item.badge ? (
                <span className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-term-green px-1 text-center text-[10px] font-bold leading-[18px] text-term-bg">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
