import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { homeFor, loadSession, saveSession } from "../lib/auth";
import { primeAudio } from "../lib/notify";
import { isStandalone } from "../lib/pwa";

export default function JoinPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoSubmitted = useRef(false);

  // Si ya hay sesión guardada en este móvil, directos al panel que toque
  useEffect(() => {
    const session = loadSession();
    if (session) navigate(homeFor(session.role), { replace: true });
  }, [navigate]);

  const submit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setBusy(true);
      setError(null);
      try {
        const r = await api.join(trimmed);
        saveSession({
          token: r.token,
          role: r.role,
          playerId: r.playerId,
          sessionId: r.sessionId,
          name: r.name,
          characterName: r.characterName,
        });
        navigate(homeFor(r.role), { replace: true });
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.code === "INVALID_CODE") setError("CÓDIGO RECHAZADO");
          else if (e.code === "TOO_MANY_REQUESTS") setError("DEMASIADOS INTENTOS · ESPERA UN MINUTO");
          else setError(`ERROR ${e.status}`);
        } else {
          setError("SIN RESPUESTA DEL SERVIDOR");
        }
      } finally {
        setBusy(false);
      }
    },
    [navigate],
  );

  // Enlace con código (?code=XXX): entra solo
  useEffect(() => {
    const fromLink = params.get("code");
    if (fromLink && !autoSubmitted.current && !loadSession()) {
      autoSubmitted.current = true;
      void submit(fromLink);
    }
  }, [params, submit]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    primeAudio();
    void submit(code);
  };

  return (
    <div className="scanlines safe-top safe-bottom flex min-h-full flex-col items-center justify-center overflow-y-auto bg-term-bg px-4 py-10 text-term-green">
      <div className="w-full max-w-sm">
        <div className="text-[10px] tracking-[0.4em] text-term-dim">CORPORACIÓN · ESTACIÓN ORBITAL EREBUS</div>
        <h1 className="mt-2 text-2xl font-bold tracking-widest">
          NEXUS-7 <span className="text-term-dim">//</span> TERMINAL
        </h1>
        <p className="mt-4 text-xs leading-relaxed text-term-dim">
          Introduce tu código de identificación personal para enlazar este dispositivo con el sistema de la nave.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-[10px] tracking-widest text-term-dim">CÓDIGO DE ACCESO</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder="XXX-0000"
              className="mt-1 w-full rounded border border-term-line bg-term-panel px-3 py-3 text-center text-xl tracking-[0.3em] text-term-green outline-none placeholder:text-term-faint focus:border-term-green"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="min-h-[52px] w-full rounded border border-term-green bg-term-green/10 text-sm tracking-[0.3em] active:bg-term-green/20 disabled:opacity-40"
          >
            {busy ? "ENLAZANDO..." : "CONECTAR"}
          </button>
          {error && (
            <div className="rounded border border-term-red/60 bg-term-red/10 px-3 py-2 text-center text-xs tracking-widest text-term-red">
              {error}
            </div>
          )}
        </form>

        {!isStandalone() && (
          <p className="mt-8 rounded border border-term-line/60 px-3 py-2 text-[10px] leading-relaxed text-term-dim">
            CONSEJO: añade esta página a la pantalla de inicio del móvil (menú del navegador → «Añadir a pantalla de
            inicio») para usarla a pantalla completa como una app.
          </p>
        )}
        <p className="mt-6 text-[10px] leading-relaxed text-term-faint">
          AVISO: el acceso no autorizado a sistemas de la corporación constituye un delito según el Código Orbital 2187/4.
        </p>
      </div>
    </div>
  );
}
