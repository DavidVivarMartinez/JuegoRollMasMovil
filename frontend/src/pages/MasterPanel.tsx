import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import AccessCodes from "../components/AccessCodes";
import TableControl from "../components/TableControl";
import BottomNav, { type NavItem } from "../components/BottomNav";
import { Badge, Chip, Field, FileManager, ItemManager, MissionManager } from "../components/ContentManagers";
import Countdown from "../components/Countdown";
import Icon from "../components/Icon";
import { formatTime } from "../components/MessageBubble";
import StationMap, { MapLegend, SECTOR_TONE } from "../components/StationMap";
import StatusDot from "../components/StatusDot";
import { api, ApiError, type FileInput, type ItemInput, type MissionInput } from "../lib/api";
import { clearSession, loadSession } from "../lib/auth";
import { useRealtime } from "../lib/realtime";
import { useKeepAlive } from "../lib/keepAlive";
import { useWakeLock } from "../lib/wakeLock";
import {
  ALL_MODULES,
  MODULE_LABEL,
  SECTOR_STATUS_LABEL,
  SESSION_LABEL,
  type AuditEntry,
  type FileClassification,
  type FileStatus,
  type GameFile,
  type GameModule,
  type Item,
  type DisplayState,
  type MapImage,
  type Message,
  type MessageType,
  type Mission,
  type MissionStatus,
  type ModuleState,
  type Overview,
  type PlayerAction,
  type PlayerModules,
  type PlayerOverview,
  type PlayerState,
  type Presence,
  type Sector,
  type SectorStatus,
  type ServerEvent,
  type SessionDto,
  type SessionStatus,
} from "../lib/types";

type View = "crew" | "send" | "station" | "log" | "table";

interface FeedItem {
  key: string;
  ts: string;
  kind: "MESSAGE" | "READ" | "ACTION";
  playerId: string | null;
  label: string;
  body: string;
  tone: "green" | "red" | "cyan" | "amber" | "dim";
}

const SENDER_PRESETS = ["SISTEMA", "CORPORACIÓN", "NEXUS-7", "CONTROL DE TIERRA", "DESCONOCIDO"];
const SESSION_STATUSES: SessionStatus[] = ["LOBBY", "RUNNING", "PAUSED", "FINISHED"];
const SECTOR_STATUSES: SectorStatus[] = ["UNKNOWN", "OPEN", "LOCKED", "QUARANTINE", "DANGER", "DESTROYED"];
const SECTOR_CHIP_TONE: Record<SectorStatus, "green" | "red" | "cyan" | "amber" | "dim"> = {
  UNKNOWN: "dim",
  OPEN: "green",
  LOCKED: "amber",
  QUARANTINE: "red",
  DANGER: "red",
  DESTROYED: "dim",
};
const TYPE_LABEL: Record<MessageType, string> = { TEXT: "NORMAL", ALERT: "ALERTA", SYSTEM: "SISTEMA" };
const FEED_LIMIT = 300;
const COUNTDOWN_PRESETS = [1, 3, 5, 10, 15];

const NAV_ITEMS: NavItem[] = [
  { key: "crew", label: "TRIPULACIÓN", icon: "crew" },
  { key: "send", label: "TRANSMITIR", icon: "send" },
  { key: "station", label: "ESTACIÓN", icon: "map" },
  { key: "log", label: "REGISTRO", icon: "log" },
  { key: "table", label: "MESA", icon: "tv" },
];

function messageItem(m: Message): FeedItem {
  return {
    key: `msg-${m.id}`,
    ts: m.createdAt,
    kind: "MESSAGE",
    playerId: m.recipientId,
    label: `${m.senderLabel}${m.type !== "TEXT" ? ` [${TYPE_LABEL[m.type]}]` : ""}`,
    body: m.text,
    tone: m.type === "ALERT" ? "red" : m.type === "SYSTEM" ? "cyan" : "green",
  };
}

function readItem(m: Message): FeedItem {
  return {
    key: `read-${m.id}`,
    ts: m.readAt ?? new Date().toISOString(),
    kind: "READ",
    playerId: m.recipientId,
    label: "LEÍDO",
    body: m.text.length > 80 ? `${m.text.slice(0, 80)}…` : m.text,
    tone: "dim",
  };
}

function actionItem(a: PlayerAction): FeedItem {
  return {
    key: `act-${a.id}`,
    ts: a.createdAt,
    kind: "ACTION",
    playerId: a.playerId,
    label: `${a.type}${a.module ? ` @${MODULE_LABEL[a.module]}` : ""}`,
    body: a.payload ?? "",
    tone: "amber",
  };
}

function sortFeed(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)).slice(0, FEED_LIMIT);
}

const TONE_CLASS: Record<FeedItem["tone"], string> = {
  green: "text-term-green",
  red: "text-term-red",
  cyan: "text-term-cyan",
  amber: "text-term-amber",
  dim: "text-term-dim",
};

export default function MasterPanel() {
  const navigate = useNavigate();
  const session = loadSession();
  const token = session?.token ?? null;
  const sessionId = session?.sessionId ?? "";

  const [view, setView] = useState<View>("crew");
  const viewRef = useRef<View>("crew");
  viewRef.current = view;
  const [unseenLog, setUnseenLog] = useState(0);
  const [sheetPlayer, setSheetPlayer] = useState<string | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [compose, setCompose] = useState({ recipientId: "", senderLabel: "SISTEMA", type: "TEXT" as MessageType, text: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ---- pantalla de mesa (TV)
  const [display, setDisplay] = useState<DisplayState | null>(null);
  const [maps, setMaps] = useState<MapImage[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const deviceId = useRef(Math.random().toString(36).slice(2, 10)).current;
  const revCounter = useRef(0);
  const pendingDisplay = useRef<DisplayState | null>(null);
  const savingDisplay = useRef(false);
  const flushTimer = useRef<number | undefined>(undefined);

  useWakeLock();
  useKeepAlive();

  const showError = useCallback((e: unknown) => {
    const text = e instanceof ApiError ? `${e.code ?? e.status}: ${e.message}` : "SIN RESPUESTA DEL SERVIDOR";
    setError(text);
    window.setTimeout(() => setError(null), 4000);
  }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2000);
  }, []);

  const resync = useCallback(async () => {
    try {
      const [ov, msgs, acts, table] = await Promise.all([
        api.master.overview(),
        api.master.messages(),
        api.master.actions(),
        api.display.bootstrap(),
      ]);
      setOverview(ov);
      setOnline(new Set(ov.connected ?? []));
      setMaps(table.maps);
      if (!pendingDisplay.current && !savingDisplay.current) setDisplay(table.state);
      setClockOffset(Date.parse(ov.serverTime) - Date.now());
      setFeed(sortFeed([...msgs.map(messageItem), ...msgs.filter((m) => m.readAt).map(readItem), ...acts.map(actionItem)]));
      setError(null);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) showError(e);
    }
  }, [showError]);

  useEffect(() => {
    void resync();
  }, [resync]);

  useEffect(() => {
    if (view === "log") setUnseenLog(0);
  }, [view, feed.length]);

  const addItem = useCallback((item: FeedItem) => {
    setFeed((prev) => {
      if (prev.some((i) => i.key === item.key)) return prev;
      if (viewRef.current !== "log") setUnseenLog((n) => n + 1);
      return sortFeed([item, ...prev]);
    });
  }, []);

  const patchPlayer = useCallback((playerId: string, patch: (p: PlayerOverview) => PlayerOverview) => {
    setOverview((prev) =>
      prev ? { ...prev, players: prev.players.map((p) => (p.player.id === playerId ? patch(p) : p)) } : prev,
    );
  }, []);

  const onEvent = useCallback(
    (_destination: string, event: ServerEvent) => {
      switch (event.type) {
        case "MESSAGE":
          addItem(messageItem(event.payload as Message));
          break;
        case "MESSAGE_READ":
          addItem(readItem(event.payload as Message));
          break;
        case "PLAYER_ACTION":
          addItem(actionItem(event.payload as PlayerAction));
          break;
        case "MODULES": {
          const pm = event.payload as PlayerModules;
          patchPlayer(pm.playerId, (p) => ({ ...p, modules: pm.modules }));
          break;
        }
        case "PLAYER_STATE": {
          const st = event.payload as PlayerState;
          patchPlayer(st.playerId, (p) => ({ ...p, state: st }));
          break;
        }
        case "PRESENCE": {
          const pr = event.payload as Presence;
          setOnline(new Set(pr.connected));
          setOverview((prev) =>
            prev
              ? { ...prev, players: prev.players.map((p) => ({ ...p, connected: pr.connected.includes(p.player.id) })) }
              : prev,
          );
          break;
        }
        case "SESSION":
          setOverview((prev) => (prev ? { ...prev, session: event.payload as SessionDto } : prev));
          break;
        case "MISSIONS":
          setOverview((prev) => (prev ? { ...prev, missions: event.payload as Mission[] } : prev));
          break;
        case "ITEMS":
          setOverview((prev) => (prev ? { ...prev, items: event.payload as Item[] } : prev));
          break;
        case "FILES":
          setOverview((prev) => (prev ? { ...prev, files: event.payload as GameFile[] } : prev));
          break;
        case "MAP":
          setOverview((prev) => (prev ? { ...prev, map: event.payload as Sector[] } : prev));
          break;
        case "DISPLAY": {
          const next = event.payload as DisplayState;
          // los ecos de mis propios cambios se ignoran (ya están aplicados y podrían ser más viejos)
          if (!next.rev?.startsWith(`${deviceId}:`)) setDisplay(next);
          break;
        }
        case "MAPS":
          setMaps(event.payload as MapImage[]);
          break;
        default:
          break;
      }
    },
    [addItem, patchPlayer, deviceId],
  );

  const destinations = useMemo(
    () => [`/topic/session/${sessionId}`, `/topic/session/${sessionId}/master`, `/topic/session/${sessionId}/display`],
    [sessionId],
  );
  const onAuthError = useCallback(() => {
    clearSession();
    navigate("/", { replace: true });
  }, [navigate]);
  const status = useRealtime({ token, destinations, onEvent, onConnected: resync, onAuthError });

  const players = overview?.players ?? [];
  const nameOf = (id: string | null) => players.find((p) => p.player.id === id)?.player.name ?? "?";
  const playerSummaries = useMemo(() => (overview?.players ?? []).map((p) => p.player), [overview?.players]);
  const tvId = overview?.accessCodes?.find((c) => c.role === "DISPLAY")?.playerId;
  const tvOnline = !!tvId && online.has(tvId);

  // ---- envío del estado de la mesa: de uno en uno y en orden; los arrastres se agrupan (~10 envíos por segundo)
  const flushDisplay = useCallback(async () => {
    window.clearTimeout(flushTimer.current);
    flushTimer.current = undefined;
    if (savingDisplay.current) return;
    const next = pendingDisplay.current;
    if (!next) return;
    pendingDisplay.current = null;
    savingDisplay.current = true;
    try {
      await api.master.saveDisplay(next);
    } catch (e) {
      showError(e);
    } finally {
      savingDisplay.current = false;
      if (pendingDisplay.current) void flushDisplay();
    }
  }, [showError]);

  const changeDisplay = useCallback(
    (next: DisplayState, immediate = false) => {
      const withRev = { ...next, rev: `${deviceId}:${++revCounter.current}` };
      setDisplay(withRev);
      pendingDisplay.current = withRev;
      if (immediate) void flushDisplay();
      else if (flushTimer.current === undefined) flushTimer.current = window.setTimeout(() => void flushDisplay(), 100);
    },
    [deviceId, flushDisplay],
  );

  const refreshMaps = useCallback(async () => {
    try {
      setMaps((await api.display.bootstrap()).maps);
    } catch (e) {
      showError(e);
    }
  }, [showError]);

  // ---- acciones del máster (envuelven la API con aviso de error)
  const guard = useCallback(
    async (action: () => Promise<unknown>, ok?: string) => {
      try {
        await action();
        if (ok) showNotice(ok);
      } catch (e) {
        showError(e);
        throw e;
      }
    },
    [showError, showNotice],
  );

  const send = async () => {
    const text = compose.text.trim();
    if (!text) return;
    setSending(true);
    try {
      const sent = await api.master.send({
        recipientId: compose.recipientId || null,
        senderLabel: compose.senderLabel.trim() || "SISTEMA",
        text,
        type: compose.type,
      });
      addItem(messageItem(sent));
      setCompose((c) => ({ ...c, text: "" }));
      showNotice(sent.recipientId ? `ENVIADO A ${nameOf(sent.recipientId).toUpperCase()}` : "ENVIADO A TODOS");
    } catch (e) {
      showError(e);
    } finally {
      setSending(false);
    }
  };

  const setModule = (playerId: string, module: GameModule, patch: { locked: boolean; visible: boolean }) =>
    guard(async () => {
      const modules = await api.master.setModule(playerId, module, patch);
      patchPlayer(playerId, (p) => ({ ...p, modules }));
    }).catch(() => undefined);

  const setState = (playerId: string, patch: { health?: number; infection?: number }) =>
    guard(async () => {
      const state = await api.master.setState(playerId, patch);
      patchPlayer(playerId, (p) => ({ ...p, state }));
    }).catch(() => undefined);

  const revoke = (p: PlayerOverview) => {
    if (!window.confirm(`¿Expulsar el dispositivo de ${p.player.name}? Tendrá que volver a introducir su código.`)) return;
    void guard(() => api.master.revoke(p.player.id), `${p.player.name.toUpperCase()} EXPULSADO`).catch(() => undefined);
  };

  const setSessionStatus = (s: SessionStatus) =>
    guard(async () => {
      const dto = await api.master.setSession(s);
      setOverview((prev) => (prev ? { ...prev, session: dto } : prev));
    }).catch(() => undefined);

  const applySession = (dto: SessionDto) => setOverview((prev) => (prev ? { ...prev, session: dto } : prev));

  // contenido: las listas se refrescan con el evento STOMP; aplicamos también la respuesta para no esperar
  const createMission = (input: MissionInput) =>
    guard(async () => {
      const m = await api.master.createMission(input);
      setOverview((prev) => (prev && !prev.missions.some((x) => x.id === m.id) ? { ...prev, missions: [...prev.missions, m] } : prev));
    }, "MISIÓN CREADA");
  const updateMission = (id: number, patch: { status?: MissionStatus; title?: string; description?: string }) =>
    guard(async () => {
      const m = await api.master.updateMission(id, patch);
      setOverview((prev) => (prev ? { ...prev, missions: prev.missions.map((x) => (x.id === id ? m : x)) } : prev));
    });
  const deleteMission = (id: number) =>
    guard(async () => {
      await api.master.deleteMission(id);
      setOverview((prev) => (prev ? { ...prev, missions: prev.missions.filter((x) => x.id !== id) } : prev));
    });

  const createItem = (input: ItemInput) =>
    guard(async () => {
      const i = await api.master.createItem(input);
      setOverview((prev) => (prev && !prev.items.some((x) => x.id === i.id) ? { ...prev, items: [...prev.items, i] } : prev));
    }, "OBJETO ENTREGADO");
  const updateItem = (id: number, patch: { quantity?: number; usable?: boolean; consumable?: boolean; playerId?: string }) =>
    guard(async () => {
      const i = await api.master.updateItem(id, patch);
      setOverview((prev) => (prev ? { ...prev, items: prev.items.map((x) => (x.id === id ? i : x)) } : prev));
    });
  const deleteItem = (id: number) =>
    guard(async () => {
      await api.master.deleteItem(id);
      setOverview((prev) => (prev ? { ...prev, items: prev.items.filter((x) => x.id !== id) } : prev));
    });

  const createFile = (input: FileInput) =>
    guard(async () => {
      const f = await api.master.createFile(input);
      setOverview((prev) => (prev && !prev.files.some((x) => x.id === f.id) ? { ...prev, files: [...prev.files, f] } : prev));
    }, "ARCHIVO CREADO");
  const updateFile = (id: number, patch: { status?: FileStatus; body?: string; title?: string; classification?: FileClassification }) =>
    guard(async () => {
      const f = await api.master.updateFile(id, patch);
      setOverview((prev) => (prev ? { ...prev, files: prev.files.map((x) => (x.id === id ? f : x)) } : prev));
    });
  const deleteFile = (id: number) =>
    guard(async () => {
      await api.master.deleteFile(id);
      setOverview((prev) => (prev ? { ...prev, files: prev.files.filter((x) => x.id !== id) } : prev));
    });

  const updateSector = (code: string, patch: { status?: SectorStatus; note?: string }) =>
    guard(async () => {
      const map = await api.master.updateSector(code, patch);
      setOverview((prev) => (prev ? { ...prev, map } : prev));
    }).catch(() => undefined);

  const toggleAudit = async () => {
    if (audit) {
      setAudit(null);
      return;
    }
    try {
      setAudit(await api.master.audit());
    } catch (e) {
      showError(e);
    }
  };

  const logout = async () => {
    if (!window.confirm("¿Cerrar el panel del máster en este dispositivo?")) return;
    try {
      await api.leave();
    } catch {
      // ignorar
    }
    clearSession();
    navigate("/", { replace: true });
  };

  if (!session) return null;

  const headline = (item: FeedItem) => {
    if (item.kind === "MESSAGE") return `${item.label} → ${item.playerId ? nameOf(item.playerId) : "TODOS"}`;
    if (item.kind === "READ") return `${nameOf(item.playerId)} LEYÓ`;
    return `${nameOf(item.playerId)} · ${item.label}`;
  };

  // En móvil se ve una sección a la vez (barra inferior); en pantallas grandes, varias columnas.
  const panel = (key: View) => `${view === key ? "flex" : "hidden"} min-h-0 flex-col lg:flex`;
  const navItems = NAV_ITEMS.map((item) => (item.key === "log" ? { ...item, badge: unseenLog } : item));
  const sheet = sheetPlayer ? players.find((p) => p.player.id === sheetPlayer) ?? null : null;

  return (
    <div className="scanlines flex h-full flex-col bg-term-bg text-term-green">
      <header className="safe-top shrink-0 border-b border-term-line bg-term-bg">
        <div className="flex items-center gap-2 px-4 pt-2.5">
          <div className="min-w-0 flex-1">
            <div className="whitespace-nowrap text-[10px] tracking-[0.4em] text-term-dim">PANEL DEL MÁSTER</div>
            <div className="truncate text-base font-bold leading-tight">{overview?.session.name ?? "..."}</div>
          </div>
          <button
            type="button"
            onClick={() => setView("table")}
            className="hidden h-11 shrink-0 items-center gap-2 rounded border border-term-line px-3 text-[11px] tracking-widest text-term-dim active:bg-white/10 lg:flex"
          >
            <Icon name="tv" className="h-5 w-5" />
            MESA
          </button>
          <button
            type="button"
            onClick={() => void resync()}
            aria-label="Recargar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-term-line text-term-dim active:bg-white/10"
          >
            <Icon name="refresh" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Salir"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-term-line text-term-dim active:bg-white/10"
          >
            <Icon name="exit" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-1.5">
          <StatusDot status={status} />
          <label className="flex items-center gap-2 text-[10px] tracking-widest text-term-dim">
            PARTIDA
            <select
              value={overview?.session.status ?? "LOBBY"}
              onChange={(e) => void setSessionStatus(e.target.value as SessionStatus)}
              className="h-9 rounded border border-term-line bg-term-panel px-2 text-[13px] tracking-widest text-term-green"
            >
              {SESSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SESSION_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      {overview && <Countdown compact label={overview.session.countdownLabel} endsAt={overview.session.countdownEndsAt} offsetMs={clockOffset} />}

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-4 lg:overflow-hidden">
        {/* Tripulación */}
        <section className={`${panel("crew")} gap-3 lg:overflow-y-auto`}>
          <div className="text-[10px] tracking-[0.3em] text-term-dim">TRIPULACIÓN</div>
          {players.length === 0 && <div className="text-xs text-term-faint">Cargando jugadores…</div>}
          {players.map((p) => (
            <PlayerCard
              key={p.player.id}
              p={p}
              counts={{
                missions: (overview?.missions ?? []).filter((m) => m.playerId === p.player.id && m.status === "ACTIVE").length,
                items: (overview?.items ?? []).filter((i) => i.playerId === p.player.id).length,
                files: (overview?.files ?? []).filter((f) => f.playerId === p.player.id && f.status !== "HIDDEN").length,
              }}
              onCompose={() => {
                setCompose((c) => ({ ...c, recipientId: p.player.id }));
                setView("send");
              }}
              onManage={() => setSheetPlayer(p.player.id)}
              onModule={(module, patch) => void setModule(p.player.id, module, patch)}
              onState={(patch) => void setState(p.player.id, patch)}
              onRevoke={() => revoke(p)}
            />
          ))}
        </section>

        {/* Transmisión */}
        <section className={`${panel("send")} gap-3 lg:overflow-y-auto`}>
          <div className="text-[10px] tracking-[0.3em] text-term-dim">TRANSMISIÓN</div>
          <div className="space-y-4 rounded border border-term-line bg-term-panel p-3">
            <Field label="DESTINATARIO">
              <div className="flex flex-wrap gap-2">
                <Chip active={compose.recipientId === ""} onClick={() => setCompose((c) => ({ ...c, recipientId: "" }))}>
                  TODOS
                </Chip>
                {players.map((p) => (
                  <Chip key={p.player.id} active={compose.recipientId === p.player.id} onClick={() => setCompose((c) => ({ ...c, recipientId: p.player.id }))}>
                    {p.player.name.toUpperCase()}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="TIPO">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TYPE_LABEL) as MessageType[]).map((t) => (
                  <Chip key={t} active={compose.type === t} tone={t === "ALERT" ? "red" : t === "SYSTEM" ? "cyan" : "green"} onClick={() => setCompose((c) => ({ ...c, type: t }))}>
                    {TYPE_LABEL[t]}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="REMITENTE">
              <div className="mb-2 flex flex-wrap gap-2">
                {SENDER_PRESETS.map((s) => (
                  <Chip key={s} active={compose.senderLabel === s} onClick={() => setCompose((c) => ({ ...c, senderLabel: s }))}>
                    {s}
                  </Chip>
                ))}
              </div>
              <input
                value={compose.senderLabel}
                onChange={(e) => setCompose((c) => ({ ...c, senderLabel: e.target.value }))}
                maxLength={80}
                autoCapitalize="characters"
                className="h-11 w-full rounded border border-term-line bg-term-bg px-3 text-term-green"
              />
            </Field>
            <Field label="MENSAJE">
              <textarea
                rows={4}
                value={compose.text}
                maxLength={2000}
                onChange={(e) => setCompose((c) => ({ ...c, text: e.target.value }))}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void send();
                }}
                placeholder="Se ha detectado una puerta bloqueada en el sector B…"
                className="w-full resize-y rounded border border-term-line bg-term-bg px-3 py-2 leading-snug text-term-green placeholder:text-term-faint"
              />
            </Field>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !compose.text.trim()}
              className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded border text-sm tracking-[0.2em] disabled:opacity-40 ${compose.type === "ALERT" ? "border-term-red bg-term-red/10 text-term-red" : "border-term-green bg-term-green/10"}`}
            >
              <Icon name="send" className="h-4 w-4" />
              {sending ? "ENVIANDO…" : compose.recipientId ? `ENVIAR A ${nameOf(compose.recipientId).toUpperCase()}` : "ENVIAR A TODOS"}
            </button>
            <div className="text-[10px] leading-relaxed text-term-faint">
              Una ALERTA hace vibrar el móvil y cubre la pantalla del jugador en rojo hasta que la toca.
            </div>
          </div>
        </section>

        {/* Estación */}
        <section className={`${panel("station")} gap-4 lg:overflow-y-auto`}>
          <div className="text-[10px] tracking-[0.3em] text-term-dim">ESTACIÓN</div>
          <CountdownControl session={overview?.session ?? null} onChange={applySession} onError={showError} />
          <MapEditor sectors={overview?.map ?? []} onUpdate={updateSector} />
          <div>
            <SubTitle>OBJETIVOS DE LA TRIPULACIÓN</SubTitle>
            <MissionManager missions={overview?.missions ?? []} scopePlayerId={null} onCreate={createMission} onUpdate={updateMission} onDelete={deleteMission} />
          </div>
          <div>
            <SubTitle>ARCHIVOS DE LA ESTACIÓN</SubTitle>
            <FileManager files={overview?.files ?? []} scopePlayerId={null} onCreate={createFile} onUpdate={updateFile} onDelete={deleteFile} />
          </div>
          {/* Solo si el backend ya gestiona códigos (una versión anterior no envía accessCodes) */}
          {overview?.accessCodes && (
            <div id="access-codes" className="scroll-mt-4">
              <AccessCodes codes={overview.accessCodes} onChanged={() => void resync()} onError={showError} />
            </div>
          )}
        </section>

        {/* Registro */}
        <section className={`${panel("log")} gap-3 lg:overflow-hidden`}>
          <div className="flex items-center justify-between text-[10px] tracking-[0.3em] text-term-dim">
            <span>{audit ? "AUDITORÍA" : "REGISTRO EN DIRECTO"}</span>
            <button type="button" onClick={() => void toggleAudit()} className="min-h-[44px] px-2 underline">
              {audit ? "VOLVER AL REGISTRO" : "VER AUDITORÍA"}
            </button>
          </div>
          <ul className="min-h-0 rounded border border-term-line bg-term-panel text-sm lg:flex-1 lg:overflow-y-auto">
            {audit
              ? audit.map((a) => (
                  <li key={a.id} className="border-b border-term-line/60 px-3 py-2.5 text-term-dim">
                    <div className="flex justify-between gap-2 text-[10px] tracking-widest">
                      <span>
                        {a.actorLabel} · {a.action}
                        {a.target ? ` → ${a.target}` : ""}
                      </span>
                      <time>{formatTime(a.createdAt)}</time>
                    </div>
                    {a.details && <div className="mt-0.5 whitespace-pre-wrap text-term-green/80">{a.details}</div>}
                  </li>
                ))
              : feed.map((item) => (
                  <li key={item.key} className={`border-b border-term-line/60 px-3 py-2.5 ${TONE_CLASS[item.tone]}`}>
                    <div className="flex justify-between gap-2 text-[10px] tracking-widest opacity-80">
                      <span>{headline(item)}</span>
                      <time>{formatTime(item.ts)}</time>
                    </div>
                    {item.body && <div className="mt-0.5 whitespace-pre-wrap">{item.body}</div>}
                  </li>
                ))}
            {!audit && feed.length === 0 && <li className="px-3 py-6 text-center text-term-faint">Sin actividad todavía</li>}
            {audit && audit.length === 0 && <li className="px-3 py-6 text-center text-term-faint">Sin entradas</li>}
          </ul>
        </section>
      </main>

      <BottomNav items={navItems} active={view} onSelect={(key) => setView(key as View)} className="lg:hidden" />

      {view === "table" && (
        <TableControl
          players={playerSummaries}
          sectors={overview?.map ?? []}
          display={display}
          maps={maps}
          tvOnline={tvOnline}
          onChange={changeDisplay}
          onMapsChanged={() => void refreshMaps()}
          onClose={() => setView("crew")}
          onError={showError}
          onNotice={showNotice}
        />
      )}

      {sheet && overview && (
        <PlayerSheet
          p={sheet}
          overview={overview}
          onClose={() => setSheetPlayer(null)}
          createMission={createMission}
          updateMission={updateMission}
          deleteMission={deleteMission}
          createItem={createItem}
          updateItem={updateItem}
          deleteItem={deleteItem}
          createFile={createFile}
          updateFile={updateFile}
          deleteFile={deleteFile}
        />
      )}

      {(error || notice) && (
        <div
          className={`pointer-events-none fixed inset-x-4 bottom-20 z-50 rounded border px-3 py-2 text-center text-xs tracking-widest lg:bottom-4 ${error ? "border-term-red bg-term-bg/95 text-term-red" : "border-term-green bg-term-bg/95 text-term-green"}`}
        >
          {error ?? notice}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- piezas

function SubTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[10px] tracking-[0.3em] text-term-dim">{children}</div>;
}

function nextModuleState(m: ModuleState): { locked: boolean; visible: boolean } {
  // libre → bloqueado → oculto → libre
  if (m.visible && !m.locked) return { locked: true, visible: true };
  if (m.visible && m.locked) return { locked: true, visible: false };
  return { locked: false, visible: true };
}

function PlayerCard({
  p,
  counts,
  onCompose,
  onManage,
  onModule,
  onState,
  onRevoke,
}: {
  p: PlayerOverview;
  counts: { missions: number; items: number; files: number };
  onCompose: () => void;
  onManage: () => void;
  onModule: (module: GameModule, patch: { locked: boolean; visible: boolean }) => void;
  onState: (patch: { health?: number; infection?: number }) => void;
  onRevoke: () => void;
}) {
  return (
    <section className="rounded border border-term-line bg-term-panel p-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-bold">{p.player.name}</div>
          <div className="text-[10px] tracking-widest text-term-dim">{p.player.characterName?.toUpperCase()}</div>
        </div>
        <span className={`mt-1 inline-flex items-center gap-1 text-[10px] tracking-widest ${p.connected ? "text-term-green" : "text-term-red"}`}>
          <span className={`h-2 w-2 rounded-full ${p.connected ? "bg-term-green shadow-[0_0_6px_var(--color-term-green)]" : "bg-term-red"}`} />
          {p.connected ? "ONLINE" : "OFFLINE"}
        </span>
      </header>

      <div className="mt-3 space-y-2">
        <Stepper label="SALUD" value={p.state.health} tone="green" onCommit={(v) => onState({ health: v })} />
        <Stepper label="INFECCIÓN" value={p.state.infection} tone="red" onCommit={(v) => onState({ infection: v })} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {ALL_MODULES.map((mod) => {
          const m = p.modules.find((x) => x.module === mod) ?? { module: mod, locked: false, visible: true };
          const cls = !m.visible
            ? "border-term-faint text-term-faint line-through"
            : m.locked
              ? "border-term-amber text-term-amber"
              : "border-term-green/70 text-term-green";
          return (
            <button
              key={mod}
              type="button"
              onClick={() => onModule(mod, nextModuleState(m))}
              title="Tocar para alternar: libre → bloqueado → oculto"
              className={`flex min-h-[40px] items-center justify-center gap-1 rounded border px-1 text-[10px] tracking-widest ${cls}`}
            >
              {m.visible && m.locked && <Icon name="lock" className="h-3 w-3" />}
              {MODULE_LABEL[mod]}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onManage}
        className="mt-3 flex min-h-[44px] w-full items-center justify-between rounded border border-term-line px-3 text-[11px] tracking-widest active:bg-white/5"
      >
        <span className="flex gap-2">
          <Badge tone="green">{counts.missions} MISIONES</Badge>
          <Badge tone="amber">{counts.items} OBJETOS</Badge>
          <Badge tone="cyan">{counts.files} ARCHIVOS</Badge>
        </span>
        <span className="text-term-dim">GESTIONAR ›</span>
      </button>

      <div className="mt-2 flex gap-2 text-[11px] tracking-widest">
        <button type="button" onClick={onCompose} className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded border border-term-green/60 active:bg-term-green/10">
          <Icon name="direct" className="h-4 w-4" />
          MENSAJE PRIVADO
        </button>
        <button type="button" onClick={onRevoke} className="min-h-[44px] rounded border border-term-red/50 px-3 text-term-red active:bg-term-red/10">
          EXPULSAR
        </button>
      </div>
    </section>
  );
}

/** Valor 0..100 con botones grandes de ±5 (cómodos con el pulgar) y barra para ver el nivel de un vistazo. */
function Stepper({ label, value, tone, onCommit }: { label: string; value: number; tone: "green" | "red"; onCommit: (v: number) => void }) {
  const color = tone === "red" ? "text-term-red" : "text-term-green";
  const bar = tone === "red" ? "bg-term-red" : "bg-term-green";
  const step = (delta: number) => onCommit(Math.max(0, Math.min(100, value + delta)));
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 text-[10px] tracking-widest text-term-dim">{label}</div>
      <button type="button" onClick={() => step(-5)} aria-label={`Bajar ${label}`} className="h-10 w-10 shrink-0 rounded border border-term-line text-lg active:bg-white/10">
        −
      </button>
      <div className="min-w-0 flex-1">
        <div className="h-2 w-full rounded bg-term-faint/40">
          <div className={`h-2 rounded ${bar}`} style={{ width: `${value}%` }} />
        </div>
      </div>
      <span className={`w-10 text-right text-sm font-bold ${color}`}>{value}</span>
      <button type="button" onClick={() => step(5)} aria-label={`Subir ${label}`} className="h-10 w-10 shrink-0 rounded border border-term-line text-lg active:bg-white/10">
        +
      </button>
    </div>
  );
}

// ---- ficha de jugador (misiones, objetos y archivos privados)

type SheetTab = "missions" | "items" | "files";

function PlayerSheet({
  p,
  overview,
  onClose,
  createMission,
  updateMission,
  deleteMission,
  createItem,
  updateItem,
  deleteItem,
  createFile,
  updateFile,
  deleteFile,
}: {
  p: PlayerOverview;
  overview: Overview;
  onClose: () => void;
  createMission: (input: MissionInput) => Promise<void>;
  updateMission: (id: number, patch: { status?: MissionStatus; title?: string; description?: string }) => Promise<void>;
  deleteMission: (id: number) => Promise<void>;
  createItem: (input: ItemInput) => Promise<void>;
  updateItem: (id: number, patch: { quantity?: number; usable?: boolean; consumable?: boolean; playerId?: string }) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
  createFile: (input: FileInput) => Promise<void>;
  updateFile: (id: number, patch: { status?: FileStatus; body?: string; title?: string; classification?: FileClassification }) => Promise<void>;
  deleteFile: (id: number) => Promise<void>;
}) {
  const [tab, setTab] = useState<SheetTab>("missions");
  const players = overview.players.map((x) => x.player);
  const tabs: Array<{ key: SheetTab; label: string }> = [
    { key: "missions", label: "MISIONES" },
    { key: "items", label: "OBJETOS" },
    { key: "files", label: "ARCHIVOS" },
  ];
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-term-bg lg:items-center lg:justify-center lg:bg-black/70 lg:p-6">
      <div className="flex h-full w-full flex-col lg:h-[85vh] lg:max-w-2xl lg:rounded lg:border lg:border-term-line lg:bg-term-bg">
        <header className="safe-top shrink-0 border-b border-term-line">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] tracking-[0.3em] text-term-dim">FICHA · {p.player.characterName?.toUpperCase()}</div>
              <div className="truncate text-base font-bold">{p.player.name}</div>
            </div>
            <button type="button" onClick={onClose} className="flex h-11 min-w-11 items-center justify-center rounded border border-term-line px-3 text-[11px] tracking-widest text-term-dim">
              CERRAR
            </button>
          </div>
          <div className="flex">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`relative min-h-[44px] flex-1 text-[11px] tracking-widest ${tab === t.key ? "text-term-green" : "text-term-dim"}`}
              >
                {t.label}
                {tab === t.key && <span className="absolute inset-x-4 bottom-0 h-0.5 bg-term-green" />}
              </button>
            ))}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {tab === "missions" && (
            <MissionManager missions={overview.missions} scopePlayerId={p.player.id} onCreate={createMission} onUpdate={updateMission} onDelete={deleteMission} />
          )}
          {tab === "items" && (
            <ItemManager items={overview.items} playerId={p.player.id} players={players} onCreate={createItem} onUpdate={updateItem} onDelete={deleteItem} />
          )}
          {tab === "files" && (
            <FileManager files={overview.files} scopePlayerId={p.player.id} onCreate={createFile} onUpdate={updateFile} onDelete={deleteFile} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- cuenta atrás

function CountdownControl({ session, onChange, onError }: { session: SessionDto | null; onChange: (s: SessionDto) => void; onError: (e: unknown) => void }) {
  const [label, setLabel] = useState("SECUENCIA DE DESACOPLE");
  const [minutes, setMinutes] = useState(5);
  const active = !!session?.countdownEndsAt;
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
      <SubTitle>CUENTA ATRÁS COMÚN</SubTitle>
      {active ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-term-dim">
            Activa: <span className="text-term-green">{session?.countdownLabel}</span>
          </div>
          <button type="button" onClick={() => void clear()} className="min-h-[44px] rounded border border-term-red px-4 text-[11px] tracking-widest text-term-red">
            CANCELAR
          </button>
        </div>
      ) : (
        <>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Etiqueta" className="h-11 w-full rounded border border-term-line bg-term-bg px-3 text-term-green" />
          <div className="flex flex-wrap gap-2">
            {COUNTDOWN_PRESETS.map((m) => (
              <button key={m} type="button" onClick={() => void start(m)} className="min-h-[44px] rounded border border-term-green/70 px-4 text-[11px] tracking-widest active:bg-term-green/10">
                {m} MIN
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 1)} className="h-11 w-20 rounded border border-term-line bg-term-bg px-2 text-center text-term-green" />
              <button type="button" onClick={() => void start(minutes)} className="min-h-[44px] rounded border border-term-line px-3 text-[11px] tracking-widest text-term-dim">
                INICIAR
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---- editor del mapa

function MapEditor({ sectors, onUpdate }: { sectors: Sector[]; onUpdate: (code: string, patch: { status?: SectorStatus; note?: string }) => Promise<void> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const sector = sectors.find((s) => s.code === selected) ?? null;
  useEffect(() => {
    setNote(sector?.note ?? "");
  }, [sector?.code, sector?.note]);
  return (
    <div className="space-y-3 rounded border border-term-line bg-term-panel p-3">
      <SubTitle>PLANO DE LA ESTACIÓN</SubTitle>
      <StationMap sectors={sectors} selected={selected} onSelect={(code) => setSelected(code === selected ? null : code)} />
      <MapLegend />
      {sector ? (
        <div className="space-y-2 rounded border border-term-line p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold">{sector.name}</div>
            <span className={`rounded border px-1.5 py-0.5 text-[9px] tracking-widest ${SECTOR_TONE[sector.status]}`}>{SECTOR_STATUS_LABEL[sector.status]}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SECTOR_STATUSES.map((s) => (
              <Chip key={s} small active={sector.status === s} tone={SECTOR_CHIP_TONE[s]} onClick={() => void onUpdate(sector.code, { status: s })}>
                {SECTOR_STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Nota visible para los jugadores" className="h-11 min-w-0 flex-1 rounded border border-term-line bg-term-bg px-3 text-term-green placeholder:text-term-faint" />
            <button type="button" onClick={() => void onUpdate(sector.code, { note })} className="min-h-[44px] rounded border border-term-green/70 px-3 text-[11px] tracking-widest">
              GUARDAR
            </button>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-term-faint">Toca un sector para cambiar su estado o su nota.</div>
      )}
    </div>
  );
}
