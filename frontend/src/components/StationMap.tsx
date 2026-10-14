import { SECTOR_STATUS_LABEL, type Sector, type SectorStatus } from "../lib/types";

const STYLE: Record<SectorStatus, { stroke: string; fill: string; text: string; dash?: string; cls?: string }> = {
  UNKNOWN: { stroke: "var(--color-term-faint)", fill: "transparent", text: "var(--color-term-faint)", dash: "1.5 1.5" },
  OPEN: { stroke: "var(--color-term-green)", fill: "rgba(57,255,138,0.10)", text: "var(--color-term-green)" },
  LOCKED: { stroke: "var(--color-term-amber)", fill: "rgba(255,179,71,0.10)", text: "var(--color-term-amber)" },
  QUARANTINE: { stroke: "var(--color-term-red)", fill: "rgba(255,77,77,0.10)", text: "var(--color-term-red)", dash: "2 1" },
  DANGER: { stroke: "var(--color-term-red)", fill: "rgba(255,77,77,0.35)", text: "var(--color-term-red)", cls: "blink" },
  DESTROYED: { stroke: "var(--color-term-faint)", fill: "rgba(21,64,43,0.25)", text: "var(--color-term-faint)" },
};

export const SECTOR_TONE: Record<SectorStatus, string> = {
  UNKNOWN: "border-term-faint text-term-faint",
  OPEN: "border-term-green text-term-green",
  LOCKED: "border-term-amber text-term-amber",
  QUARANTINE: "border-term-red text-term-red",
  DANGER: "border-term-red bg-term-red/20 text-term-red",
  DESTROYED: "border-term-faint text-term-faint line-through",
};

const W = 16;
const H = 10;

/** Parte un nombre en hasta dos líneas de ~12 caracteres para que quepa en la casilla. */
function wrap(label: string, max = 12): string[] {
  if (label.length <= max) return [label];
  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  if (lines.length > 2) return [lines[0], lines.slice(1).join(" ").slice(0, max - 1) + "…"];
  return lines.map((l) => (l.length > max ? l.slice(0, max - 1) + "…" : l));
}

/** Plano esquemático de la estación. Los sectores desconocidos llegan sin nombre desde el servidor. */
export default function StationMap({
  sectors,
  selected,
  onSelect,
}: {
  sectors: Sector[];
  selected?: string | null;
  onSelect?: (code: string) => void;
}) {
  const byCode = new Map(sectors.map((s) => [s.code, s]));
  const edges: Array<[Sector, Sector]> = [];
  const seen = new Set<string>();
  for (const s of sectors) {
    for (const link of s.links) {
      const target = byCode.get(link);
      if (!target) continue;
      const key = [s.code, target.code].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([s, target]);
    }
  }

  return (
    <svg viewBox="0 0 100 100" className="w-full select-none" role="img" aria-label="Mapa de la estación">
      <rect x="0" y="0" width="100" height="100" fill="transparent" />
      {edges.map(([a, b]) => (
        <line
          key={`${a.code}-${b.code}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="var(--color-term-faint)"
          strokeWidth="0.8"
          strokeDasharray={a.status === "UNKNOWN" || b.status === "UNKNOWN" ? "1 1" : undefined}
        />
      ))}
      {sectors.map((s) => {
        const style = STYLE[s.status];
        const isSelected = s.code === selected;
        const lines = s.status === "UNKNOWN" && !s.name ? ["?"] : wrap(s.name ?? "?", 11);
        return (
          <g
            key={s.code}
            onClick={onSelect ? () => onSelect(s.code) : undefined}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            <rect
              x={s.x - W / 2}
              y={s.y - H / 2}
              width={W}
              height={H}
              rx="1.2"
              fill={style.fill}
              stroke={isSelected ? "#ffffff" : style.stroke}
              strokeWidth={isSelected ? 1 : 0.6}
              strokeDasharray={style.dash}
              className={style.cls}
            />
            {s.status === "DESTROYED" && (
              <path
                d={`M${s.x - W / 2 + 1} ${s.y - H / 2 + 1} L${s.x + W / 2 - 1} ${s.y + H / 2 - 1} M${s.x + W / 2 - 1} ${s.y - H / 2 + 1} L${s.x - W / 2 + 1} ${s.y + H / 2 - 1}`}
                stroke={style.stroke}
                strokeWidth="0.5"
              />
            )}
            {lines.map((line, i) => (
              <text
                key={i}
                x={s.x}
                y={s.y + (i - (lines.length - 1) / 2) * 3.4 + 1}
                textAnchor="middle"
                fontSize={lines[0] === "?" ? "5" : "2.3"}
                fill={style.text}
                fontFamily="inherit"
                style={{ pointerEvents: "none" }}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function MapLegend() {
  const entries = Object.keys(SECTOR_STATUS_LABEL) as SectorStatus[];
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((s) => (
        <span key={s} className={`rounded border px-1.5 py-0.5 text-[9px] tracking-widest ${SECTOR_TONE[s]}`}>
          {SECTOR_STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}
