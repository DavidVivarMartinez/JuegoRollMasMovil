import type { ConnectionStatus } from "../lib/realtime";

const STYLE: Record<ConnectionStatus, { dot: string; label: string }> = {
  connected: { dot: "bg-term-green shadow-[0_0_8px_var(--color-term-green)]", label: "ENLACE OK" },
  connecting: { dot: "bg-term-amber blink", label: "ENLAZANDO" },
  disconnected: { dot: "bg-term-red blink", label: "SIN ENLACE" },
};

export default function StatusDot({ status }: { status: ConnectionStatus }) {
  const s = STYLE[status];
  return (
    <span className="flex items-center gap-1.5 text-[10px] tracking-widest text-term-dim">
      <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
