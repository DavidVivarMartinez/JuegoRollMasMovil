import { useState } from "react";
import { api, ApiError } from "../lib/api";
import type { AccessCode } from "../lib/types";
import { Badge } from "./ContentManagers";

/**
 * Códigos de acceso de la partida. El servidor solo guarda el hash, así que un código se ve en claro
 * únicamente en el momento de cambiarlo: aquí se conservan los que se han cambiado en esta pantalla.
 */
export default function AccessCodes({
  codes,
  onChanged,
  onError,
}: {
  codes: AccessCode[];
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const [shown, setShown] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const change = async (playerId: string, code?: string) => {
    setBusy(playerId);
    try {
      const res = await api.master.changeCode(playerId, code);
      setShown((prev) => ({ ...prev, [playerId]: res.code }));
      setEditing(null);
      setDraft("");
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ACTION_REJECTED") onError(new Error(e.message));
      else onError(e);
    } finally {
      setBusy(null);
    }
  };

  const generateAll = async () => {
    if (!window.confirm("¿Generar códigos nuevos para todos? Los actuales dejarán de valer (quien ya está dentro sigue dentro).")) return;
    for (const c of codes) {
      // secuencial: así cada código se comprueba como único frente a los anteriores
      await change(c.playerId);
    }
  };

  const defaults = codes.filter((c) => c.defaultCode).length;
  const shownList = codes.filter((c) => shown[c.playerId]);

  return (
    <div className="space-y-3 rounded border border-term-line bg-term-panel p-3">
      <div className="mb-1 text-[10px] tracking-[0.3em] text-term-dim">CÓDIGOS DE ACCESO</div>
      {defaults > 0 ? (
        <p className="rounded border border-term-red/60 bg-term-red/10 px-3 py-2 text-[11px] leading-relaxed text-term-red">
          {defaults === codes.length ? "Todos usan" : `${defaults} usan`} el código de ejemplo, que es público en GitHub. Genera códigos
          nuevos antes de repartirlos.
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-term-dim">Todos los códigos son personalizados.</p>
      )}

      <ul className="space-y-2">
        {codes.map((c) => (
          <li key={c.playerId} className="rounded border border-term-line/70 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{c.role === "MASTER" ? "MÁSTER" : c.name}</div>
                <div className="text-[10px] tracking-widest text-term-dim">{c.role === "MASTER" ? "PANEL DE CONTROL" : c.characterName?.toUpperCase()}</div>
              </div>
              {c.defaultCode ? <Badge tone="red">EJEMPLO</Badge> : <Badge tone="green">PROPIO</Badge>}
            </div>

            {shown[c.playerId] && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded border border-term-green/60 bg-term-bg px-3 py-2">
                <span className="select-all text-lg font-bold tracking-[0.2em]">{shown[c.playerId]}</span>
                <span className="text-[9px] tracking-widest text-term-dim">NUEVO</span>
              </div>
            )}

            {editing === c.playerId ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.toUpperCase())}
                  maxLength={40}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="CÓDIGO"
                  className="h-11 min-w-0 flex-1 rounded border border-term-line bg-term-bg px-3 tracking-widest text-term-green placeholder:text-term-faint"
                />
                <button
                  type="button"
                  disabled={busy === c.playerId || draft.trim().length < 4}
                  onClick={() => void change(c.playerId, draft.trim())}
                  className="min-h-[44px] rounded border border-term-green/70 px-3 text-[11px] tracking-widest disabled:opacity-40"
                >
                  GUARDAR
                </button>
                <button type="button" onClick={() => setEditing(null)} className="min-h-[44px] rounded border border-term-line px-3 text-[11px] text-term-dim">
                  ✕
                </button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy === c.playerId}
                  onClick={() => void change(c.playerId)}
                  className="min-h-[40px] flex-1 rounded border border-term-green/70 text-[11px] tracking-widest active:bg-term-green/10 disabled:opacity-40"
                >
                  {busy === c.playerId ? "…" : "GENERAR"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(c.playerId);
                    setDraft("");
                  }}
                  className="min-h-[40px] flex-1 rounded border border-term-line text-[11px] tracking-widest text-term-dim"
                >
                  ESCRIBIR UNO
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => void generateAll()}
        disabled={busy !== null || codes.length === 0}
        className="min-h-[44px] w-full rounded border border-dashed border-term-amber text-[11px] tracking-widest text-term-amber disabled:opacity-40"
      >
        GENERAR CÓDIGOS NUEVOS PARA TODOS
      </button>

      {shownList.length > 0 && (
        <div className="rounded border border-term-amber/60 bg-term-bg p-3">
          <div className="text-[10px] tracking-widest text-term-amber">APÚNTALOS AHORA</div>
          <p className="mt-1 text-[11px] leading-relaxed text-term-dim">
            Por seguridad solo se guardan cifrados: al salir de esta pantalla no se podrán volver a ver (sí cambiar otra vez).
          </p>
          <pre className="mt-2 select-all whitespace-pre-wrap text-sm leading-relaxed text-term-green">
            {shownList.map((c) => `${(c.role === "MASTER" ? "MÁSTER" : c.name).padEnd(8)} ${shown[c.playerId]}`).join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
