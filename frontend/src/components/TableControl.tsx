import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { displayWindowUrl } from "../lib/auth";
import {
  ensureScene,
  FOG_DENSITIES,
  mapIdOf,
  resizeFog,
  sceneAspect,
  TOKEN_PALETTE,
} from "../lib/display";
import { isVideoType, prepareMedia, useMapImage } from "../lib/mapImages";
import { canPickScreens, listScreens, openTvWindow, type ScreenInfo } from "../lib/screens";
import type { DisplayFog, DisplayScene, DisplayState, MapImage, OverlayType, PlayerSummary, Sector, SessionDto } from "../lib/types";
import { Chip } from "./ContentManagers";
import CountdownControl from "./CountdownControl";
import Icon from "./Icon";
import SceneView, { type FogBrush, type SceneTool } from "./SceneView";

const OVERLAY_LABEL: Record<OverlayType, string> = {
  NONE: "NADA",
  BLACKOUT: "APAGÓN",
  ALERT: "ALERTA",
  MESSAGE: "MENSAJE",
};

const INPUT = "w-full rounded border border-term-line bg-term-bg px-3 py-2 text-term-green placeholder:text-term-faint";

/**
 * Control de la pantalla de mesa desde el móvil del máster. Todo cambio se aplica al momento en la vista previa
 * y se envía a la TV (los arrastres, unas diez veces por segundo).
 */
export default function TableControl({
  players,
  sectors,
  display,
  maps,
  tvOnline,
  session,
  clockOffset,
  onSessionChange,
  onChange,
  onMapsChanged,
  onClose,
  onError,
  onNotice,
}: {
  players: PlayerSummary[];
  sectors: Sector[];
  display: DisplayState | null;
  maps: MapImage[];
  tvOnline: boolean;
  session: SessionDto | null;
  clockOffset: number;
  onSessionChange: (s: SessionDto) => void;
  onChange: (next: DisplayState, immediate?: boolean) => void;
  onMapsChanged: () => void;
  onClose: () => void;
  onError: (e: unknown) => void;
  onNotice: (text: string) => void;
}) {
  const [tool, setTool] = useState<SceneTool>("move");
  const [brush, setBrush] = useState<FogBrush>("reveal");
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newToken, setNewToken] = useState({ label: "", color: TOKEN_PALETTE[0] });
  const [overlayDraft, setOverlayDraft] = useState({ title: "", text: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const sceneKey = display?.scene ?? "NONE";
  const aspect = sceneAspect(sceneKey, maps);
  const scene: DisplayScene | undefined = display?.scenes[sceneKey];
  const imageUrl = useMapImage(mapIdOf(sceneKey));

  // la escena actual siempre tiene la ficha de cada jugador
  useEffect(() => {
    if (!display || sceneKey === "NONE") return;
    const next = ensureScene(display, sceneKey, players, aspect);
    if (next !== display) onChange(next, true);
  }, [display, sceneKey, players, aspect, onChange]);

  useEffect(() => {
    setOverlayDraft({ title: display?.overlay.title ?? "", text: display?.overlay.text ?? "" });
    // solo al abrir o si cambia desde otro dispositivo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display?.overlay.type]);

  if (!display) {
    return (
      <Layer onClose={onClose} tvOnline={tvOnline}>
        <div className="py-10 text-center text-xs tracking-widest text-term-dim">
          CARGANDO MESA<span className="blink">_</span>
        </div>
      </Layer>
    );
  }

  // ---- cambios
  const patchScene = (patch: (s: DisplayScene) => DisplayScene, immediate = true) => {
    if (!scene) return;
    onChange({ ...display, scenes: { ...display.scenes, [sceneKey]: patch(scene) } }, immediate);
  };

  const goScene = (key: string) => {
    setSelected(null);
    const next = ensureScene({ ...display, scene: key }, key, players, sceneAspect(key, maps));
    onChange(next, true);
  };

  const moveToken = (id: string, x: number, y: number, final: boolean) =>
    patchScene((s) => ({ ...s, tokens: s.tokens.map((t) => (t.id === id ? { ...t, x, y } : t)) }), final);

  const setFog = (fog: DisplayFog, final = true) => patchScene((s) => ({ ...s, fog }), final);

  const addToken = () => {
    const label = newToken.label.trim();
    if (!label || !scene) return;
    const id = `npc-${Date.now().toString(36)}`;
    patchScene((s) => ({
      ...s,
      tokens: [...s.tokens, { id, label: label.slice(0, 24), color: newToken.color, x: 0.5, y: 0.5, visible: true, playerId: null }],
    }));
    setNewToken((t) => ({ ...t, label: "" }));
    setSelected(id);
    setTool("move");
  };

  const setOverlay = (type: OverlayType) =>
    onChange(
      {
        ...display,
        overlay: {
          type,
          title: type === "ALERT" || type === "MESSAGE" ? overlayDraft.title.trim() || null : null,
          text: type === "ALERT" || type === "MESSAGE" ? overlayDraft.text.trim() || null : null,
        },
      },
      true,
    );

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const prepared = await prepareMedia(file);
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Mapa";
      const map = await api.master.uploadMap(prepared.blob, name, prepared.width, prepared.height);
      onMapsChanged();
      onNotice(`MAPA SUBIDO: ${map.name.toUpperCase()}`);
      const key = `MAP:${map.id}`;
      const next = ensureScene({ ...display, scene: key }, key, players, map.width / map.height);
      onChange(next, true);
    } catch (e) {
      onError(e);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteMap = async (map: MapImage) => {
    if (!window.confirm(`¿Borrar el mapa "${map.name}"? Se perderán sus fichas y su niebla.`)) return;
    try {
      await api.master.deleteMap(map.id);
      onMapsChanged();
    } catch (e) {
      onError(e);
    }
  };

  const fog = scene?.fog;
  const selectedToken = scene?.tokens.find((t) => t.id === selected) ?? null;

  return (
    <Layer onClose={onClose} tvOnline={tvOnline}>
      <TvLauncher tvOnline={tvOnline} onError={onError} onNotice={onNotice} />

      {/* escena */}
      <Section title="ESCENA EN LA TV">
        <div className="flex flex-wrap gap-2">
          <Chip small active={sceneKey === "NONE"} tone="dim" onClick={() => goScene("NONE")}>
            REPOSO
          </Chip>
          <Chip small active={sceneKey === "STATION"} onClick={() => goScene("STATION")}>
            PLANO ESTACIÓN
          </Chip>
          {maps.map((m) => (
            <Chip key={m.id} small active={sceneKey === `MAP:${m.id}`} onClick={() => goScene(`MAP:${m.id}`)}>
              {isVideoType(m.contentType) ? "▶ " : ""}
              {m.name.toUpperCase()}
            </Chip>
          ))}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded border border-dashed border-term-green/70 px-2.5 text-[10px] tracking-widest disabled:opacity-40"
          >
            <Icon name="upload" className="h-3.5 w-3.5" />
            {uploading ? "SUBIENDO…" : "SUBIR MAPA / VÍDEO"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </div>
      </Section>

      {/* vista previa */}
      {sceneKey === "NONE" ? (
        <div className="rounded border border-term-line bg-black py-10 text-center text-[11px] tracking-widest text-term-dim">
          LA TV MUESTRA EL LOGO DE LA PARTIDA
        </div>
      ) : (
        <div className="rounded border border-term-line bg-black p-1">
          <SceneView
            sceneKey={sceneKey}
            scene={scene}
            aspect={aspect}
            imageUrl={imageUrl}
            isVideo={isVideoType(maps.find((m) => m.id === mapIdOf(sceneKey))?.contentType)}
            sectors={sectors}
            variant="master"
            fit="width"
            maxHeight={Math.round(window.innerHeight * 0.55)}
            tool={tool}
            fogBrush={brush}
            selectedToken={selected}
            onSelectToken={setSelected}
            onMoveToken={moveToken}
            onFogChange={setFog}
          />
        </div>
      )}

      {sceneKey !== "NONE" && scene && fog && (
        <>
          {/* herramientas */}
          <div className="grid grid-cols-2 gap-2">
            <ToolButton active={tool === "move"} onClick={() => setTool("move")}>
              MOVER FICHAS
            </ToolButton>
            <ToolButton
              active={tool === "fog"}
              onClick={() => {
                setTool("fog");
                setSelected(null);
                if (!fog.enabled) setFog({ ...fog, enabled: true });
              }}
            >
              PINTAR NIEBLA
            </ToolButton>
          </div>
          <p className="text-[10px] leading-relaxed text-term-faint">
            {tool === "move"
              ? selectedToken
                ? `${selectedToken.label}: arrástrala o toca donde quieras llevarla. Tócala otra vez para soltarla.`
                : "Toca una ficha para seleccionarla y arrástrala por el mapa."
              : brush === "reveal"
                ? "Pasa el dedo por las zonas que los jugadores ya pueden ver."
                : "Pasa el dedo por las zonas que quieres volver a ocultar."}
          </p>

          {tool === "fog" && (
            <Section title="NIEBLA DE GUERRA">
              <div className="mb-2 grid grid-cols-2 gap-2">
                <ToolButton active={brush === "reveal"} onClick={() => setBrush("reveal")}>
                  PINCEL: REVELAR
                </ToolButton>
                <ToolButton active={brush === "cover"} onClick={() => setBrush("cover")}>
                  PINCEL: CUBRIR
                </ToolButton>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip small active={fog.enabled} onClick={() => setFog({ ...fog, enabled: !fog.enabled })}>
                  {fog.enabled ? "ACTIVA" : "DESACTIVADA"}
                </Chip>
                <Chip small active={false} onClick={() => setFog({ ...fog, revealed: "1".repeat(fog.cols * fog.rows) })}>
                  REVELAR TODO
                </Chip>
                <Chip small active={false} tone="amber" onClick={() => setFog({ ...fog, revealed: "0".repeat(fog.cols * fog.rows) })}>
                  CUBRIR TODO
                </Chip>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10px] tracking-widest text-term-dim">
                CASILLAS
                {FOG_DENSITIES.map((n) => (
                  <Chip key={n} small active={fog.cols === n} onClick={() => setFog(resizeFog(fog, n, aspect))}>
                    {n}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {/* fichas */}
          <Section title="FICHAS">
            <ul className="space-y-1.5">
              {scene.tokens.map((t) => (
                <li
                  key={t.id}
                  className={`flex items-center gap-2 rounded border px-2 py-1.5 ${t.id === selected ? "border-white/70" : "border-term-line/70"}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setTool("move");
                      setSelected(t.id === selected ? null : t.id);
                    }}
                    className="flex min-h-[36px] min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="h-4 w-4 shrink-0 rounded-full border-2" style={{ borderColor: t.color, background: `${t.color}33` }} />
                    <span className={`truncate text-sm ${t.visible ? "" : "text-term-dim line-through"}`}>{t.label}</span>
                    {!t.playerId && <span className="text-[9px] tracking-widest text-term-dim">PNJ</span>}
                  </button>
                  <button
                    type="button"
                    aria-label={t.visible ? "Ocultar en la TV" : "Mostrar en la TV"}
                    onClick={() => patchScene((s) => ({ ...s, tokens: s.tokens.map((x) => (x.id === t.id ? { ...x, visible: !x.visible } : x)) }))}
                    className="flex h-9 w-9 items-center justify-center rounded border border-term-line text-term-dim"
                  >
                    <Icon name={t.visible ? "eye" : "eyeOff"} className="h-4 w-4" />
                  </button>
                  {!t.playerId && (
                    <button
                      type="button"
                      aria-label={`Quitar ${t.label}`}
                      onClick={() => {
                        if (selected === t.id) setSelected(null);
                        patchScene((s) => ({ ...s, tokens: s.tokens.filter((x) => x.id !== t.id) }));
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded border border-term-line text-term-dim active:text-term-red"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2 space-y-2 rounded border border-dashed border-term-line p-2">
              <input
                value={newToken.label}
                onChange={(e) => setNewToken((t) => ({ ...t, label: e.target.value }))}
                maxLength={24}
                placeholder="Nueva ficha: Infectado, Dra. Vey, Caja…"
                className={INPUT}
              />
              <div className="flex items-center gap-2">
                {TOKEN_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => setNewToken((t) => ({ ...t, color: c }))}
                    className={`h-8 w-8 rounded-full border-2 ${newToken.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""}`}
                    style={{ borderColor: c, background: `${c}44` }}
                  />
                ))}
                <button
                  type="button"
                  disabled={!newToken.label.trim()}
                  onClick={addToken}
                  className="ml-auto min-h-[40px] rounded border border-term-green/70 px-3 text-[11px] tracking-widest disabled:opacity-40"
                >
                  AÑADIR
                </button>
              </div>
            </div>
          </Section>
        </>
      )}

      {/* efectos */}
      <Section title="EFECTOS EN LA TV">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(OVERLAY_LABEL) as OverlayType[]).map((o) => (
            <Chip
              key={o}
              small
              active={display.overlay.type === o}
              tone={o === "ALERT" ? "red" : o === "BLACKOUT" ? "dim" : o === "MESSAGE" ? "cyan" : "green"}
              onClick={() => setOverlay(o)}
            >
              {OVERLAY_LABEL[o]}
            </Chip>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          <input
            value={overlayDraft.title}
            onChange={(e) => setOverlayDraft((d) => ({ ...d, title: e.target.value }))}
            maxLength={120}
            placeholder="Título (alerta o mensaje)"
            className={INPUT}
          />
          <textarea
            rows={2}
            value={overlayDraft.text}
            onChange={(e) => setOverlayDraft((d) => ({ ...d, text: e.target.value }))}
            maxLength={1000}
            placeholder="Texto: PROTOCOLO DE CONTENCIÓN ACTIVADO…"
            className={INPUT}
          />
          <p className="text-[10px] leading-relaxed text-term-faint">
            Escribe el texto y pulsa ALERTA o MENSAJE para mostrarlo. NADA lo quita.
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip small active={display.glitch} tone="amber" onClick={() => onChange({ ...display, glitch: !display.glitch }, true)}>
            INTERFERENCIA
          </Chip>
          <Chip small active={display.showCountdown} onClick={() => onChange({ ...display, showCountdown: !display.showCountdown }, true)}>
            MOSTRAR CUENTA ATRÁS EN TV
          </Chip>
        </div>
        <div className="mt-3">
          <CountdownControl
            title="CUENTA ATRÁS (TV Y MÓVILES)"
            session={session}
            offsetMs={clockOffset}
            onChange={onSessionChange}
            onError={onError}
          />
          {session?.countdownEndsAt && !display.showCountdown && (
            <p className="mt-2 text-[10px] leading-relaxed text-term-amber">
              Hay una cuenta atrás en marcha, pero está oculta en la TV: activa «MOSTRAR CUENTA ATRÁS EN TV».
            </p>
          )}
        </div>
      </Section>

      {/* mapas */}
      {maps.length > 0 && (
        <Section title="MAPAS SUBIDOS">
          <ul className="space-y-1.5">
            {maps.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded border border-term-line/70 px-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-sm">{m.name}</div>
                  <div className="text-[9px] tracking-widest text-term-dim">
                    {isVideoType(m.contentType) ? "VÍDEO · " : ""}
                    {m.width}×{m.height} · {m.sizeBytes >= 1048576 ? `${(m.sizeBytes / 1048576).toFixed(1)} MB` : `${Math.round(m.sizeBytes / 1024)} KB`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteMap(m)}
                  aria-label={`Borrar ${m.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded border border-term-line text-term-dim active:text-term-red"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="pb-4 text-[10px] leading-relaxed text-term-faint">
        En el ordenador de la tele abre la web y entra con el código de la PANTALLA (ESTACIÓN → CÓDIGOS DE ACCESO).
        Pulsa PANTALLA COMPLETA y no hace falta tocar nada más.
      </p>
    </Layer>
  );
}

function Layer({ children, onClose, tvOnline }: { children: ReactNode; onClose: () => void; tvOnline: boolean }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-term-bg text-term-green">
      <header className="safe-top shrink-0 border-b border-term-line">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 shrink-0 items-center rounded border border-term-line px-3 text-[11px] tracking-widest text-term-dim"
          >
            ← PANEL
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-[0.3em] text-term-dim">PANTALLA DE MESA</div>
            <div className="text-base font-bold leading-tight">MESA · TV</div>
          </div>
          <span className={`flex items-center gap-1.5 text-[10px] tracking-widest ${tvOnline ? "text-term-green" : "text-term-red"}`}>
            <span className={`h-2 w-2 rounded-full ${tvOnline ? "bg-term-green shadow-[0_0_8px_var(--color-term-green)]" : "bg-term-red"}`} />
            {tvOnline ? "TV CONECTADA" : "TV DESCONECTADA"}
          </span>
        </div>
      </header>
      <div className="safe-bottom min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 lg:mx-auto lg:w-full lg:max-w-3xl">
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-[10px] tracking-[0.3em] text-term-dim">{title}</div>
      {children}
    </section>
  );
}

function ToolButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] rounded border text-[11px] tracking-widest ${active ? "border-term-green bg-term-green/15" : "border-term-line text-term-dim"}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- abrir la TV en este ordenador

function TvLauncher({
  tvOnline,
  onError,
  onNotice,
}: {
  tvOnline: boolean;
  onError: (e: unknown) => void;
  onNotice: (text: string) => void;
}) {
  const [screens, setScreens] = useState<ScreenInfo[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const pickable = canPickScreens();

  const detect = async () => {
    setDetecting(true);
    try {
      // si se cierra la petición de permiso sin responder, la promesa no termina nunca: se corta a los 30 s
      const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 30000));
      setScreens(await Promise.race([listScreens(), timeout]));
    } catch {
      setScreens([]);
    } finally {
      setDetecting(false);
    }
  };

  const open = async (screen?: ScreenInfo) => {
    if (tvOnline && !window.confirm("Ya hay una tele conectada. Si la abres aquí, la otra se desconectará. ¿Seguir?")) return;
    // la ventana se abre en el mismo clic (si no, el navegador la bloquea) y luego se le da el acceso
    const win = openTvWindow(screen);
    if (!win) {
      onError(new Error("El navegador ha bloqueado la ventana: permite las ventanas emergentes para esta web"));
      return;
    }
    try {
      win.document.title = "NEXUS-7 · PANTALLA";
      win.document.body.style.cssText = "margin:0;background:#000;color:#39ff8a;font:16px monospace;display:flex;align-items:center;justify-content:center;height:100vh";
      win.document.body.textContent = "ENLAZANDO PANTALLA…";
    } catch {
      // ventana ya cargada con la TV: se recarga abajo
    }
    try {
      const r = await api.master.displayLink();
      win.location.href = displayWindowUrl({
        token: r.token,
        role: r.role,
        playerId: r.playerId,
        sessionId: r.sessionId,
        name: r.name,
        characterName: r.characterName,
      });
      win.focus();
      onNotice(screen ? `TV ABIERTA EN ${screen.label.toUpperCase()}` : "TV ABIERTA EN UNA VENTANA NUEVA");
    } catch (e) {
      win.close();
      onError(e);
    }
  };

  return (
    <Section title="TV EN ESTE ORDENADOR">
      <p className="mb-2 text-[11px] leading-relaxed text-term-dim">
        {tvOnline
          ? "La tele está conectada. Si quieres usar otra pantalla de este ordenador, ábrela aquí."
          : "Ninguna pantalla muestra la mesa. Ábrela en el monitor extra de este ordenador, o entra con el código de la PANTALLA en el ordenador de la tele."}
      </p>
      {pickable && screens === null && (
        <button
          type="button"
          disabled={detecting}
          onClick={() => void detect()}
          className="mb-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded border border-term-green/70 text-[11px] tracking-widest disabled:opacity-40"
        >
          <Icon name="tv" className="h-4 w-4" />
          {detecting ? "BUSCANDO PANTALLAS…" : "ELEGIR PANTALLA"}
        </button>
      )}
      {screens && screens.length === 0 && (
        <p className="mb-2 rounded border border-term-amber/60 bg-term-amber/10 px-3 py-2 text-[11px] leading-relaxed text-term-amber">
          El navegador no ha dado permiso para ver las pantallas. Abre la TV en una ventana y arrástrala al otro monitor, o permite
          «Gestión de ventanas» en el candado de la barra de direcciones y recarga.
        </p>
      )}
      {screens && screens.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {screens.map((s) => (
            <li key={s.index} className="flex items-center justify-between gap-2 rounded border border-term-line/70 px-2 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-sm">{s.label}</div>
                <div className="text-[9px] tracking-widest text-term-dim">
                  {s.width}×{s.height}
                  {s.isCurrent ? " · ESTA PANTALLA" : ""}
                  {s.isPrimary ? " · PRINCIPAL" : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void open(s)}
                className={`min-h-[40px] shrink-0 rounded border px-3 text-[11px] tracking-widest ${s.isCurrent ? "border-term-line text-term-dim" : "border-term-green bg-term-green/10"}`}
              >
                ABRIR AQUÍ
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => void open()}
        className="min-h-[40px] w-full rounded border border-dashed border-term-line text-[11px] tracking-widest text-term-dim"
      >
        ABRIR EN UNA VENTANA
      </button>
      <p className="mt-2 text-[10px] leading-relaxed text-term-faint">
        La ventana se puede arrastrar al otro monitor. En ella: doble clic o tecla F para pantalla completa.
      </p>
    </Section>
  );
}
