import { useEffect, useRef, useState } from "react";

/**
 * Cuenta atrás común de la partida. Usa el reloj del servidor (offsetMs = servidor − móvil) para que
 * todos los terminales vayan sincronizados aunque la hora del teléfono esté mal.
 */
export default function Countdown({
  label,
  endsAt,
  offsetMs = 0,
  onExpire,
  compact = false,
}: {
  label: string | null;
  endsAt: string | null;
  offsetMs?: number;
  onExpire?: () => void;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
  }, [endsAt]);

  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now() + offsetMs);
    const timer = window.setInterval(() => setNow(Date.now() + offsetMs), 250);
    return () => window.clearInterval(timer);
  }, [endsAt, offsetMs]);

  const remaining = endsAt ? Math.max(0, Date.parse(endsAt) - now) : 0;
  const total = Math.ceil(remaining / 1000);

  useEffect(() => {
    if (endsAt && total === 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire?.();
    }
  }, [endsAt, total, onExpire]);

  if (!endsAt) return null;

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const text = `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const tone = total === 0 ? "text-term-red blink" : total <= 10 ? "text-term-red" : total <= 60 ? "text-term-amber" : "text-term-green";

  return (
    <div className={`flex items-center justify-between gap-3 border-b border-term-line bg-term-panel px-4 ${compact ? "py-1" : "py-1.5"}`}>
      <span className="truncate text-[10px] tracking-[0.3em] text-term-dim">{total === 0 ? "TIEMPO AGOTADO" : (label ?? "CUENTA ATRÁS")}</span>
      <span className={`shrink-0 font-bold tabular-nums ${compact ? "text-base" : "text-xl"} ${tone}`}>{text}</span>
    </div>
  );
}
