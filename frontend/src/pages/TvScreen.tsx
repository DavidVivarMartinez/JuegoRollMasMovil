import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SceneView from "../components/SceneView";
import { api, ApiError } from "../lib/api";
import { clearSession, loadSession } from "../lib/auth";
import { mapIdOf, sceneAspect } from "../lib/display";
import { useKeepAlive } from "../lib/keepAlive";
import { useMapImage } from "../lib/mapImages";
import { useRealtime } from "../lib/realtime";
import type { DisplayBootstrap, DisplayState, MapImage, Sector, ServerEvent, SessionDto } from "../lib/types";
import { useWakeLock } from "../lib/wakeLock";

/**
 * Pantalla de mesa: la TV conectada al ordenador. Sin controles: muestra a pantalla completa
 * lo que decide el máster (escena, fichas, niebla, efectos y cuenta atrás).
 */
export default function TvScreen() {
  const navigate = useNavigate();
  const session = loadSession();
  const token = session?.token ?? null;
  const sessionId = session?.sessionId ?? "";

  const [boot, setBoot] = useState<DisplayBootstrap | null>(null);
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  const [idle, setIdle] = useState(false);
  const [hint, setHint] = useState(true);
  const idleTimer = useRef<number | undefined>(undefined);

  useWakeLock();
  useKeepAlive();

  const resync = useCallback(async () => {
    try {
      setBoot(await api.display.bootstrap());
      setFailed(false);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setFailed(true);
    }
  }, []);

  useEffect(() => {
    void resync();
  }, [resync]);

  const onEvent = useCallback((_destination: string, event: ServerEvent) => {
    setBoot((prev) => {
      if (!prev) return prev;
      switch (event.type) {
        case "DISPLAY":
          return { ...prev, state: event.payload as DisplayState };
        case "MAPS":
          return { ...prev, maps: event.payload as MapImage[] };
        case "SESSION":
          return { ...prev, session: event.payload as SessionDto };
        case "MAP":
          return { ...prev, sectors: event.payload as Sector[] };
        default:
          return prev;
      }
    });
  }, []);

  const destinations = useMemo(() => [`/topic/session/${sessionId}`, `/topic/session/${sessionId}/display`], [sessionId]);
  const onAuthError = useCallback(() => {
    clearSession();
    navigate("/", { replace: true });
  }, [navigate]);
  const status = useRealtime({ token, destinations, onEvent, onConnected: resync, onAuthError });

  // pantalla completa y cursor oculto cuando no se mueve el ratón
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => setHint(false), 10000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [toggleFullscreen]);

  const wake = () => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 3000);
  };
  useEffect(() => {
    wake();
    return () => window.clearTimeout(idleTimer.current);
  }, []);

  const state = boot?.state;
  const sceneKey = state?.scene ?? "NONE";
  const imageUrl = useMapImage(mapIdOf(sceneKey));
  const aspect = sceneAspect(sceneKey, boot?.maps ?? []);
  const overlay = state?.overlay;

  if (!session) return null;

  return (
    <div
      className={`fixed inset-0 select-none overflow-hidden bg-black text-term-green ${idle ? "cursor-none" : ""}`}
      onMouseMove={wake}
      onPointerDown={wake}
      onDoubleClick={toggleFullscreen}
    >
      {!boot ? (
        <Splash subtitle={failed ? "SIN RESPUESTA DEL SERVIDOR · REINTENTANDO" : "ENLAZANDO CON LA ESTACIÓN"} />
      ) : sceneKey === "NONE" ? (
        <Splash subtitle="ESTACIÓN EREBUS-ORBITAL · CICLO 4471" />
      ) : (
        <div className={`absolute inset-0 p-[1.5vh] ${state?.glitch ? "glitch" : ""}`}>
          <SceneView
            sceneKey={sceneKey}
            scene={state?.scenes[sceneKey]}
            aspect={aspect}
            imageUrl={imageUrl}
            sectors={boot.sectors}
            variant="tv"
          />
        </div>
      )}

      <div className="scanlines pointer-events-none" />

      {state?.showCountdown && boot?.session.countdownEndsAt && (
        <TvCountdown label={boot.session.countdownLabel} endsAt={boot.session.countdownEndsAt} />
      )}

      {overlay?.type === "BLACKOUT" && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black pb-[4vh]">
          <span className="blink text-[1.2vw] tracking-[0.5em] text-term-faint">SIN SEÑAL</span>
        </div>
      )}
      {overlay?.type === "ALERT" && (
        <div className="alert-flash absolute inset-0 z-30 flex flex-col items-center justify-center gap-[2vh] px-[6vw] text-center">
          <div className="text-[1.4vw] tracking-[0.6em] text-term-red">// ALERTA //</div>
          <div className="text-[6vw] font-bold leading-none text-white drop-shadow-[0_0_24px_rgba(255,77,77,0.9)]">
            {overlay.title || "ALERTA"}
          </div>
          {overlay.text && <div className="max-w-[80vw] whitespace-pre-wrap text-[2.4vw] text-white/90">{overlay.text}</div>}
        </div>
      )}
      {overlay?.type === "MESSAGE" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 p-[5vw]">
          <div className="slide-in max-w-[80vw] rounded border border-term-green/60 bg-term-panel/90 p-[3vw] shadow-[0_0_60px_rgba(57,255,138,0.15)]">
            {overlay.title && <div className="text-[3vw] font-bold tracking-[0.15em] text-term-green">{overlay.title}</div>}
            {overlay.text && (
              <div className="mt-[2vh] whitespace-pre-wrap text-[2vw] leading-snug text-term-green/90">
                {overlay.text}
                <span className="blink">_</span>
              </div>
            )}
          </div>
        </div>
      )}

      {status !== "connected" && boot && (
        <div className="absolute bottom-3 left-3 z-40 rounded bg-black/80 px-2 py-1 text-xs tracking-widest text-term-red">
          SIN ENLACE · RECONECTANDO<span className="blink">_</span>
        </div>
      )}
      {!fullscreen && hint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[12vh] z-40 flex justify-center">
          <div className="rounded border border-term-green/60 bg-black/85 px-6 py-3 text-center text-lg tracking-widest">
            DOBLE CLIC O TECLA F: PANTALLA COMPLETA
          </div>
        </div>
      )}
      {!fullscreen && !idle && (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute bottom-3 right-3 z-40 rounded border border-term-green/60 bg-black/80 px-3 py-2 text-xs tracking-widest"
        >
          PANTALLA COMPLETA
        </button>
      )}
    </div>
  );
}

function Splash({ subtitle }: { subtitle: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2vh] text-center">
      <div className="text-[1.2vw] tracking-[0.6em] text-term-dim">CORPORACIÓN · NEXUS-7</div>
      <div className="glitch text-[6vw] font-bold tracking-[0.15em] text-term-green drop-shadow-[0_0_30px_rgba(57,255,138,0.5)]">
        PROTOCOLO: ECLIPSE
      </div>
      <div className="text-[1.2vw] tracking-[0.4em] text-term-dim">
        {subtitle}
        <span className="blink">_</span>
      </div>
    </div>
  );
}

function TvCountdown({ label, endsAt }: { label: string | null; endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  const total = Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const tone = total === 0 ? "text-term-red blink" : total <= 10 ? "text-term-red" : total <= 60 ? "text-term-amber" : "text-term-green";
  return (
    <div className="absolute right-[2vw] top-[2vh] z-20 rounded border border-term-line bg-black/80 px-[1.5vw] py-[1vh] text-right">
      <div className="text-[0.9vw] tracking-[0.4em] text-term-dim">{total === 0 ? "TIEMPO AGOTADO" : (label ?? "CUENTA ATRÁS")}</div>
      <div className={`text-[4vw] font-bold leading-none tabular-nums ${tone}`}>
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </div>
    </div>
  );
}
