import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import AlertFlash from "../components/AlertFlash";
import BottomNav, { type NavItem } from "../components/BottomNav";
import Countdown from "../components/Countdown";
import Icon, { type IconName } from "../components/Icon";
import LockOverlay from "../components/LockOverlay";
import MessageBubble from "../components/MessageBubble";
import StationMap, { MapLegend, SECTOR_TONE } from "../components/StationMap";
import StatusDot from "../components/StatusDot";
import { api, ApiError } from "../lib/api";
import { clearSession, loadSession } from "../lib/auth";
import { notify, primeAudio } from "../lib/notify";
import { useRealtime } from "../lib/realtime";
import { useKeepAlive } from "../lib/keepAlive";
import { useWakeLock } from "../lib/wakeLock";
import {
  CLASSIFICATION_LABEL,
  MISSION_STATUS_LABEL,
  MODULE_LABEL,
  SECTOR_STATUS_LABEL,
  SESSION_LABEL,
  type Biometrics,
  type GameFile,
  type GameModule,
  type Item,
  type Me,
  type Message,
  type Mission,
  type ModuleState,
  type Sector,
  type ServerEvent,
  type SessionDto,
} from "../lib/types";

type Tab = "DIRECT" | GameModule;

const MODULE_ICON: Record<GameModule, IconName> = {
  COMMS: "comms",
  MISSIONS: "missions",
  INVENTORY: "inventory",
  FILES: "files",
  MAP: "map",
  BIOMETRICS: "bio",
};

const NAV_LABEL: Record<GameModule, string> = {
  COMMS: "COMMS",
  MISSIONS: "MISIÓN",
  INVENTORY: "OBJETOS",
  FILES: "ARCHIVOS",
  MAP: "MAPA",
  BIOMETRICS: "BIO",
};

// ---------------------------------------------------------------- almacenamiento local de "visto"

function loadNumber(key: string): number {
  try {
    return Number(sessionStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function loadSet(key: string): Set<number> {
  try {
    return new Set<number>(JSON.parse(sessionStorage.getItem(key) ?? "[]") as number[]);
  } catch {
    return new Set();
  }
}

function store(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin almacenamiento
  }
}

/** Ids vistos de una lista; marca todos como vistos mientras la pestaña está activa. Devuelve los no vistos. */
function useSeen(key: string, ids: number[], active: boolean): number {
  const [seen, setSeen] = useState(() => loadSet(key));
  const unseen = ids.filter((id) => !seen.has(id)).length;
  useEffect(() => {
    if (!active || unseen === 0) return;
    setSeen((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      store(key, [...next]);
      return next;
    });
  }, [active, unseen, ids, key]);
  return unseen;
}

export default function PlayerTerminal() {
  const navigate = useNavigate();
  const session = loadSession();
  const token = session?.token ?? null;
  const sessionId = session?.sessionId ?? "";

  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tab, setTab] = useState<Tab>("DIRECT");
  const [flash, setFlash] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [seenDirect, setSeenDirect] = useState(() => loadNumber("eclipse.seenDirect"));
  const [seenComms, setSeenComms] = useState(() => loadNumber("eclipse.seenComms"));
  const [acked, setAcked] = useState(() => loadSet("eclipse.acked"));
  const [clockOffset, setClockOffset] = useState(0);

  useWakeLock(); // pantalla encendida durante la partida
  useKeepAlive(); // evita que el backend gratuito de Render se duerma mientras hay un terminal abierto

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  // ---- carga y resincronización (al entrar, al reconectar y al volver a la pestaña)
  const resync = useCallback(async () => {
    try {
      const [profile, history] = await Promise.all([api.me(), api.myMessages()]);
      setMe(profile);
      setMessages(history);
      setClockOffset(Date.parse(profile.serverTime) - Date.now());
      setError(null);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setError("SIN RESPUESTA DEL SERVIDOR");
    }
  }, []);

  useEffect(() => {
    void resync();
  }, [resync]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [resync]);

  // ---- tiempo real
  const onEvent = useCallback(
    (_destination: string, event: ServerEvent) => {
      switch (event.type) {
        case "MESSAGE": {
          const msg = event.payload as Message;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          notify(msg.type === "ALERT" ? "alert" : "message");
          if (msg.type === "ALERT") setFlash(msg);
          break;
        }
        case "MODULES":
          setMe((prev) => (prev ? { ...prev, modules: event.payload as ModuleState[] } : prev));
          break;
        case "BIOMETRICS":
          setMe((prev) => (prev ? { ...prev, biometrics: event.payload as Biometrics } : prev));
          break;
        case "MISSIONS": {
          const missions = event.payload as Mission[];
          setMe((prev) => {
            if (!prev) return prev;
            const known = new Set(prev.missions.map((m) => m.id));
            if (missions.some((m) => !known.has(m.id))) {
              notify("message");
              showToast("NUEVA MISIÓN RECIBIDA");
            }
            return { ...prev, missions };
          });
          break;
        }
        case "ITEMS": {
          const items = event.payload as Item[];
          setMe((prev) => {
            if (!prev) return prev;
            const known = new Set(prev.items.map((i) => i.id));
            if (items.some((i) => !known.has(i.id))) {
              notify("message");
              showToast("OBJETO AÑADIDO AL INVENTARIO");
            }
            return { ...prev, items };
          });
          break;
        }
        case "FILES": {
          const files = event.payload as GameFile[];
          setMe((prev) => {
            if (!prev) return prev;
            const known = new Set(prev.files.map((f) => f.id));
            if (files.some((f) => !known.has(f.id))) {
              notify("message");
              showToast("ARCHIVO DESBLOQUEADO");
            }
            return { ...prev, files };
          });
          break;
        }
        case "MAP":
          setMe((prev) => (prev ? { ...prev, map: event.payload as Sector[] } : prev));
          break;
        case "SESSION": {
          const next = event.payload as SessionDto;
          setMe((prev) => {
            if (prev && next.countdownEndsAt && next.countdownEndsAt !== prev.session.countdownEndsAt) notify("message");
            return prev ? { ...prev, session: next } : prev;
          });
          break;
        }
        default:
          break;
      }
    },
    [showToast],
  );

  const destinations = useMemo(
    () => ["/user/queue/messages", "/user/queue/state", `/topic/session/${sessionId}`],
    [sessionId],
  );
  const onAuthError = useCallback(() => {
    clearSession();
    navigate("/", { replace: true });
  }, [navigate]);
  const status = useRealtime({ token, destinations, onEvent, onConnected: resync, onAuthError });

  // ---- derivados
  const modules = me?.modules ?? [];
  const visibleKey = modules
    .filter((m) => m.visible)
    .map((m) => `${m.module}:${m.locked ? 1 : 0}`)
    .join(",");
  const visibleModules = useMemo<ModuleState[]>(
    () =>
      visibleKey
        ? visibleKey.split(",").map((entry) => {
            const [module, locked] = entry.split(":");
            return { module: module as GameModule, locked: locked === "1", visible: true };
          })
        : [],
    [visibleKey],
  );

  useEffect(() => {
    if (tab !== "DIRECT" && !visibleModules.some((m) => m.module === tab)) setTab("DIRECT");
  }, [visibleModules, tab]);

  const direct = messages.filter((m) => m.scope === "PRIVATE");
  const broadcast = messages.filter((m) => m.scope === "GLOBAL");
  const maxDirectId = direct.reduce((max, m) => Math.max(max, m.id), 0);
  const maxCommsId = broadcast.reduce((max, m) => Math.max(max, m.id), 0);
  const unreadDirect = direct.filter((m) => m.id > seenDirect).length;
  const unreadComms = broadcast.filter((m) => m.id > seenComms).length;

  useEffect(() => {
    if (tab === "DIRECT" && maxDirectId > seenDirect) {
      setSeenDirect(maxDirectId);
      store("eclipse.seenDirect", maxDirectId);
    }
    if (tab === "COMMS" && maxCommsId > seenComms) {
      setSeenComms(maxCommsId);
      store("eclipse.seenComms", maxCommsId);
    }
  }, [tab, maxDirectId, seenDirect, maxCommsId, seenComms]);

  const missionIds = useMemo(() => (me?.missions ?? []).map((m) => m.id), [me?.missions]);
  const fileIds = useMemo(() => (me?.files ?? []).map((f) => f.id), [me?.files]);
  const unseenMissions = useSeen("eclipse.seenMissions", missionIds, tab === "MISSIONS");
  const unseenFiles = useSeen("eclipse.seenFiles", fileIds, tab === "FILES");

  const ackPrivate = async (id: number) => {
    try {
      const updated = await api.markRead(id);
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch {
      showToast("NO SE PUDO CONFIRMAR");
    }
  };

  const ackBroadcast = async (id: number) => {
    try {
      await api.act("COMMS", "ACK_BROADCAST", String(id));
      setAcked((prev) => {
        const next = new Set(prev);
        next.add(id);
        store("eclipse.acked", [...next]);
        return next;
      });
    } catch (e) {
      showToast(e instanceof ApiError && e.code === "MODULE_LOCKED" ? "COMUNICACIONES BLOQUEADAS" : "ERROR DE ENLACE");
    }
  };

  const reportMission = async (mission: Mission) => {
    try {
      await api.reportMission(mission.id);
      showToast("INFORME ENVIADO AL MANDO");
    } catch (e) {
      showToast(e instanceof ApiError && e.code === "MODULE_LOCKED" ? "MÓDULO BLOQUEADO" : "ERROR DE ENLACE");
    }
  };

  const useItem = async (item: Item) => {
    try {
      const items = await api.useItem(item.id);
      setMe((prev) => (prev ? { ...prev, items } : prev));
      showToast(`USADO: ${item.name.toUpperCase()}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "MODULE_LOCKED") showToast("INVENTARIO BLOQUEADO");
      else if (e instanceof ApiError && e.code === "ACTION_REJECTED") showToast(e.message.toUpperCase());
      else showToast("ERROR DE ENLACE");
    }
  };

  const logout = async () => {
    if (!window.confirm("¿Desconectar este dispositivo? Tendrás que volver a introducir tu código.")) return;
    try {
      await api.leave();
    } catch {
      // da igual: borramos la sesión local de todas formas
    }
    clearSession();
    navigate("/", { replace: true });
  };

  if (!session) return null;

  const moduleState = (module: GameModule) => visibleModules.find((m) => m.module === module);
  const badgeFor = (module: GameModule) => {
    if (module === "COMMS") return unreadComms;
    if (module === "MISSIONS") return unseenMissions;
    if (module === "FILES") return unseenFiles;
    return undefined;
  };
  const navItems: NavItem[] = [
    { key: "DIRECT", label: "DIRECTO", icon: "direct", badge: unreadDirect },
    ...visibleModules.map<NavItem>((m) => ({
      key: m.module,
      label: NAV_LABEL[m.module],
      icon: MODULE_ICON[m.module],
      badge: badgeFor(m.module),
      tone: m.locked ? "locked" : "normal",
    })),
  ];

  return (
    <div className="scanlines flex h-full flex-col bg-term-bg text-term-green" onPointerDown={primeAudio}>
      <header className="safe-top shrink-0 border-b border-term-line bg-term-bg">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-[0.3em] text-term-dim">NEXUS-7 // TERMINAL</div>
            <div className="truncate text-base font-bold leading-tight">
              {(me?.player.characterName ?? session.characterName ?? "TRIPULANTE").toUpperCase()}
              <span className="ml-2 text-xs font-normal text-term-dim">{me?.player.name ?? session.name}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] tracking-widest text-term-dim">
              <span>{me ? SESSION_LABEL[me.session.status] : "..."}</span>
              <StatusDot status={status} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Desconectar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-term-line text-term-dim active:bg-white/10"
          >
            <Icon name="exit" className="h-5 w-5" />
          </button>
        </div>
        {error && <div className="bg-term-red/15 py-1 text-center text-[10px] tracking-widest text-term-red">{error}</div>}
      </header>
      {me && (
        <Countdown
          label={me.session.countdownLabel}
          endsAt={me.session.countdownEndsAt}
          offsetMs={clockOffset}
          onExpire={() => notify("alert")}
        />
      )}

      <main className="relative flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {tab === "DIRECT" && (
          <Feed empty="SIN MENSAJES DIRECTOS" count={direct.length}>
            <p className="mb-3 text-[10px] leading-relaxed text-term-faint">Canal directo cifrado. Solo tú ves estos mensajes.</p>
            {direct.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                action={{ label: "ACUSAR RECIBO", done: !!m.readAt, onClick: () => void ackPrivate(m.id) }}
              />
            ))}
          </Feed>
        )}
        {tab !== "DIRECT" && (
          <ModuleView module={tab} state={moduleState(tab)}>
            {tab === "COMMS" && (
              <Feed empty="SIN COMUNICACIONES" count={broadcast.length}>
                {broadcast.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    action={{ label: "CONFIRMAR RECEPCIÓN", done: acked.has(m.id), onClick: () => void ackBroadcast(m.id) }}
                  />
                ))}
              </Feed>
            )}
            {tab === "MISSIONS" && <MissionList missions={me?.missions ?? []} onReport={(m) => void reportMission(m)} />}
            {tab === "INVENTORY" && <ItemList items={me?.items ?? []} onUse={(i) => void useItem(i)} />}
            {tab === "FILES" && <FileBrowser files={me?.files ?? []} onToast={showToast} />}
            {tab === "MAP" && <MapView sectors={me?.map ?? []} />}
            {tab === "BIOMETRICS" && <BioPanel bio={me?.biometrics ?? null} />}
          </ModuleView>
        )}
      </main>

      <BottomNav items={navItems} active={tab} onSelect={(key) => setTab(key as Tab)} />

      {flash && <AlertFlash message={flash} onDismiss={() => setFlash(null)} />}
      {toast && (
        <div className="pointer-events-none fixed inset-x-4 bottom-20 z-40 rounded border border-term-amber bg-term-bg/95 px-3 py-2 text-center text-xs tracking-widest text-term-amber">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- subcomponentes

function Feed({ empty, count, children }: { empty: string; count: number; children: ReactNode }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);
  return (
    <div className="space-y-2">
      {children}
      {count === 0 && <div className="py-10 text-center text-xs tracking-widest text-term-faint">{empty}</div>}
      <div ref={endRef} />
    </div>
  );
}

function ModuleView({ module, state, children }: { module: GameModule; state?: ModuleState; children: ReactNode }) {
  const locked = state?.locked ?? false;
  if (locked) {
    return (
      <div className="relative min-h-[60vh]">
        <LockOverlay title={module === "COMMS" ? "COMUNICACIONES BLOQUEADAS" : `${MODULE_LABEL[module]}: BLOQUEADO`} />
      </div>
    );
  }
  return <div className="relative min-h-full">{children}</div>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[10px] tracking-[0.3em] text-term-dim">{children}</div>;
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center text-[11px] tracking-widest text-term-faint">
      {children}
      <span className="blink">_</span>
    </div>
  );
}

// ---- misiones

function MissionList({ missions, onReport }: { missions: Mission[]; onReport: (m: Mission) => void }) {
  if (missions.length === 0) return <EmptyNote>SIN ÓRDENES ASIGNADAS</EmptyNote>;
  const shared = missions.filter((m) => m.kind === "SHARED");
  const own = missions.filter((m) => m.kind !== "SHARED");
  const card = (m: Mission) => {
    const secret = m.kind === "SECRET";
    const done = m.status === "DONE";
    const failed = m.status === "FAILED";
    const border = failed ? "border-term-red/70" : done ? "border-term-cyan/60" : secret ? "border-term-amber/70" : "border-term-line";
    return (
      <article key={m.id} className={`slide-in rounded border-l-2 bg-term-panel px-3 py-2.5 ${border}`}>
        <div className="flex items-start justify-between gap-2">
          <div className={`text-[15px] font-bold leading-snug ${done ? "line-through opacity-70" : ""}`}>{m.title}</div>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] tracking-widest ${
              failed ? "border-term-red text-term-red" : done ? "border-term-cyan text-term-cyan" : secret ? "border-term-amber text-term-amber" : "border-term-dim text-term-dim"
            }`}
          >
            {secret && m.status === "ACTIVE" ? "SOLO TÚ" : MISSION_STATUS_LABEL[m.status]}
          </span>
        </div>
        {m.description && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-snug text-term-green/85">{m.description}</p>}
        {m.status === "ACTIVE" && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onReport(m)}
              className="min-h-[40px] rounded border border-current px-3 text-[11px] tracking-widest text-term-dim active:bg-white/10"
            >
              INFORMAR AL MANDO
            </button>
          </div>
        )}
      </article>
    );
  };
  return (
    <div className="space-y-4">
      {own.length > 0 && (
        <section>
          <SectionTitle>TUS ÓRDENES</SectionTitle>
          <div className="space-y-2">{own.map(card)}</div>
        </section>
      )}
      {shared.length > 0 && (
        <section>
          <SectionTitle>OBJETIVOS DE LA TRIPULACIÓN</SectionTitle>
          <div className="space-y-2">{shared.map(card)}</div>
        </section>
      )}
    </div>
  );
}

// ---- inventario

function ItemList({ items, onUse }: { items: Item[]; onUse: (i: Item) => void }) {
  if (items.length === 0) return <EmptyNote>INVENTARIO VACÍO</EmptyNote>;
  return (
    <div className="space-y-2">
      <SectionTitle>EQUIPO ASIGNADO</SectionTitle>
      {items.map((i) => (
        <article key={i.id} className="slide-in flex items-center gap-3 rounded border border-term-line bg-term-panel px-3 py-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-term-line text-term-dim">
            <Icon name="inventory" className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[15px] font-bold">{i.name}</span>
              {(i.consumable || i.quantity !== 1) && <span className="shrink-0 text-xs text-term-dim">×{i.quantity}</span>}
            </div>
            {i.description && <p className="text-xs leading-snug text-term-dim">{i.description}</p>}
          </div>
          {i.usable && (
            <button
              type="button"
              onClick={() => onUse(i)}
              className="min-h-[44px] shrink-0 rounded border border-term-green/70 px-3 text-[11px] tracking-widest active:bg-term-green/10"
            >
              USAR
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

// ---- archivos

function FileBrowser({ files, onToast }: { files: GameFile[]; onToast: (t: string) => void }) {
  const [openFile, setOpenFile] = useState<GameFile | null>(null);
  const [loading, setLoading] = useState(false);

  const open = async (f: GameFile) => {
    setLoading(true);
    try {
      setOpenFile(await api.openFile(f.id));
    } catch (e) {
      onToast(e instanceof ApiError && e.code === "MODULE_LOCKED" ? "ARCHIVOS BLOQUEADOS" : "ARCHIVO NO DISPONIBLE");
    } finally {
      setLoading(false);
    }
  };

  if (openFile) {
    const corrupted = openFile.status === "CORRUPTED";
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setOpenFile(null)} className="min-h-[40px] text-[11px] tracking-widest text-term-dim">
          ← VOLVER AL ÍNDICE
        </button>
        <div className={`rounded border bg-term-panel ${corrupted ? "border-term-red/60" : "border-term-line"}`}>
          <div className="border-b border-term-line px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-[10px] tracking-widest">
              <span className={openFile.classification === "CLASSIFIED" ? "text-term-red" : openFile.classification === "RESTRICTED" ? "text-term-amber" : "text-term-dim"}>
                {CLASSIFICATION_LABEL[openFile.classification]}
              </span>
              {corrupted && <span className="text-term-red blink">ARCHIVO DAÑADO</span>}
            </div>
            <div className="mt-0.5 text-base font-bold leading-snug">{openFile.title}</div>
          </div>
          <pre className={`whitespace-pre-wrap px-3 py-3 font-mono text-[13px] leading-relaxed ${corrupted ? "glitch text-term-green/80" : "text-term-green"}`}>
            {openFile.body ?? ""}
          </pre>
        </div>
      </div>
    );
  }

  if (files.length === 0) return <EmptyNote>SIN ARCHIVOS ACCESIBLES</EmptyNote>;
  return (
    <div className="space-y-2">
      <SectionTitle>ARCHIVOS ACCESIBLES · {files.length}</SectionTitle>
      {files.map((f) => (
        <button
          key={f.id}
          type="button"
          disabled={loading}
          onClick={() => void open(f)}
          className="slide-in flex w-full items-center gap-3 rounded border border-term-line bg-term-panel px-3 py-2.5 text-left active:bg-white/5"
        >
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded border ${f.status === "CORRUPTED" ? "border-term-red/60 text-term-red" : "border-term-line text-term-dim"}`}>
            <Icon name="files" className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold">{f.title}</div>
            <div className="flex gap-2 text-[10px] tracking-widest">
              <span className={f.classification === "CLASSIFIED" ? "text-term-red" : f.classification === "RESTRICTED" ? "text-term-amber" : "text-term-dim"}>
                {CLASSIFICATION_LABEL[f.classification]}
              </span>
              {f.playerId && <span className="text-term-amber">PRIVADO</span>}
              {f.status === "CORRUPTED" && <span className="text-term-red">DAÑADO</span>}
            </div>
          </div>
          <span className="text-term-dim">›</span>
        </button>
      ))}
    </div>
  );
}

// ---- mapa

function MapView({ sectors }: { sectors: Sector[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const sector = sectors.find((s) => s.code === selected) ?? null;
  if (sectors.length === 0) return <EmptyNote>SIN DATOS CARTOGRÁFICOS</EmptyNote>;
  return (
    <div className="space-y-3">
      <SectionTitle>ESTACIÓN EREBUS-ORBITAL · PLANO</SectionTitle>
      <div className="rounded border border-term-line bg-term-panel p-2">
        <StationMap sectors={sectors} selected={selected} onSelect={(code) => setSelected(code === selected ? null : code)} />
      </div>
      <div className="min-h-[72px] rounded border border-term-line bg-term-panel px-3 py-2.5">
        {sector ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[15px] font-bold">{sector.name ?? "SECTOR SIN IDENTIFICAR"}</div>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] tracking-widest ${SECTOR_TONE[sector.status]}`}>{SECTOR_STATUS_LABEL[sector.status]}</span>
            </div>
            <p className="mt-1 text-xs leading-snug text-term-dim">{sector.note ?? (sector.status === "UNKNOWN" ? "Sin datos. Hay que explorarlo." : "Sin observaciones.")}</p>
          </>
        ) : (
          <p className="text-xs text-term-faint">Toca un sector para ver su estado.</p>
        )}
      </div>
      <MapLegend />
    </div>
  );
}

// ---- biometría

function BioPanel({ bio }: { bio: Biometrics | null }) {
  if (!bio) return <EmptyNote>SIN LECTURA BIOMÉTRICA</EmptyNote>;
  const danger = bio.status.startsWith("ERROR");
  const tone = danger ? "text-term-red" : bio.anomaly ? "text-term-amber" : "text-term-green";
  return (
    <div className={`space-y-5 ${bio.anomaly ? "glitch" : ""}`}>
      <div>
        <div className="flex justify-between text-[10px] tracking-widest text-term-dim">
          <span>CONSTANTES VITALES</span>
          <span className="text-term-green">{bio.health}%</span>
        </div>
        <div className="mt-1 h-2.5 w-full rounded bg-term-faint/40">
          <div
            className={`h-2.5 rounded ${bio.health < 30 ? "bg-term-red" : bio.health < 60 ? "bg-term-amber" : "bg-term-green"}`}
            style={{ width: `${bio.health}%` }}
          />
        </div>
      </div>
      <div>
        <div className="text-[10px] tracking-widest text-term-dim">ESTADO DEL IMPLANTE</div>
        <div className={`mt-1 text-lg font-bold ${tone}`}>{bio.status}</div>
      </div>
      <div>
        <div className="text-[10px] tracking-widest text-term-dim">SENSOR</div>
        <div className={`mt-1 text-sm ${danger ? "text-term-red" : "text-term-green"}`}>
          {danger ? "RECALIBRANDO" : "OPERATIVO"}
          <span className="blink">_</span>
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-term-faint">
        Lectura proporcionada por el implante biométrico estándar de la corporación. Los resultados pueden tardar en
        actualizarse y no sustituyen a una evaluación médica.
      </p>
    </div>
  );
}
