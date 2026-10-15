import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { SessionDto } from "../lib/types";

const PRESETS = [1, 3, 5, 10, 15];

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Iniciar o cancelar la cuenta atrás común (móviles de los jugadores y TV). Se usa en ESTACIÓN y en MESA.
 * offsetMs = hora del servidor − hora de este dispositivo, para mostrar el mismo tiempo que ven los demás.
 */
export default function CountdownControl({
  session,
  offsetMs = 0,
  onChange,
  onError,
  title = "CUENTA ATRÁS COMÚN",
}: {
  session: SessionDto | null;
  offsetMs?: number;
  onChange: (s: SessionDto) => void;
  onError: (e: unknown) => void;
  title?: string;
}) {
  const [label, setLabel] = useState("SECUENCIA DE DESACOPLE");
  const [minutes, setMinutes] = useState(5);
  const [now, setNow] = useState(() => Date.now());
  const endsAt = session?.countdownEndsAt ? Date.parse(session.countdownEndsAt) : null;

  useEffect(() => {
    if (!endsAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [endsAt]);

  const remaining = endsAt ? endsAt - (now + offsetMs) : 0;

  const start = async (mins: number) => {
    try {
      onChange(await api.master.startCountdown(label.trim() || "CUENTA ATRÁS", Math.max(1, Math.round(mins * 60))));
    } catch (e) {
      onError(e);
    }
  };
  const clear = async () => {
    try {
      onChange(await api.master.clearCountdown());
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="space-y-3 rounded border border-term-line bg-term-panel p-3">
      <div className="text-[10px] tracking-[0.3em] text-term-dim">{title}</div>
      {endsAt ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[10px] tracking-widest text-term-dim">{session?.countdownLabel}</div>
            <div className={`text-2xl font-bold tabular-nums ${remaining <= 0 ? "blink text-term-red" : remaining <= 60_000 ? "text-term-amber" : "text-term-green"}`}>
              {remaining <= 0 ? "AGOTADO" : formatRemaining(remaining)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void clear()}
            className="min-h-[44px] shrink-0 rounded border border-term-red px-4 text-[11px] tracking-widest text-term-red"
          >
            {remaining <= 0 ? "QUITAR" : "CANCELAR"}
          </button>
        </div>
      ) : (
        <>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
            placeholder="Etiqueta"
            className="h-11 w-full rounded border border-term-line bg-term-bg px-3 text-term-green"
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => void start(m)}
                className="min-h-[44px] rounded border border-term-green/70 px-4 text-[11px] tracking-widest active:bg-term-green/10"
              >
                {m} MIN
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value) || 1)}
                className="h-11 w-20 rounded border border-term-line bg-term-bg px-2 text-center text-term-green"
              />
              <button
                type="button"
                onClick={() => void start(minutes)}
                className="min-h-[44px] rounded border border-term-line px-3 text-[11px] tracking-widest text-term-dim"
              >
                INICIAR
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
