import { clearSession, loadSession, UNAUTHORIZED_EVENT } from "./auth";
import { apiUrl } from "./config";
import type {
  ApiProblem,
  AuditEntry,
  CodeChanged,
  FileClassification,
  FileStatus,
  GameFile,
  GameModule,
  Item,
  JoinResponse,
  Me,
  Message,
  MessageType,
  Mission,
  MissionKind,
  MissionStatus,
  ModuleState,
  Overview,
  PlayerAction,
  PlayerState,
  Sector,
  SectorStatus,
  SessionDto,
  SessionStatus,
} from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly problem?: ApiProblem,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = loadSession();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (session) headers.Authorization = `Bearer ${session.token}`;

  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const problem = (data ?? {}) as ApiProblem;
    if (res.status === 401 && session) {
      // Token revocado o caducado: olvidamos la sesión y la app vuelve a la pantalla de acceso
      clearSession();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, problem.code, problem.detail ?? `Error ${res.status}`, problem);
  }
  return data as T;
}

export interface MissionInput {
  playerId: string | null;
  code?: string | null;
  kind?: MissionKind;
  title: string;
  description?: string | null;
  status?: MissionStatus;
}

export interface ItemInput {
  playerId: string;
  name: string;
  description?: string | null;
  quantity?: number;
  usable?: boolean;
  consumable?: boolean;
}

export interface FileInput {
  playerId: string | null;
  code?: string | null;
  title: string;
  classification?: FileClassification;
  body?: string | null;
  status?: FileStatus;
}

export const api = {
  join: (code: string) => request<JoinResponse>("POST", "/api/session/join", { code }),
  leave: () => request<void>("POST", "/api/session/leave"),

  me: () => request<Me>("GET", "/api/player/me"),
  myMessages: () => request<Message[]>("GET", "/api/player/messages"),
  markRead: (id: number) => request<Message>("POST", `/api/player/messages/${id}/read`),
  act: (module: GameModule | null, type: string, payload?: string) =>
    request<PlayerAction>("POST", "/api/player/actions", { module, type, payload }),
  reportMission: (id: number) => request<PlayerAction>("POST", `/api/player/missions/${id}/report`),
  useItem: (id: number) => request<Item[]>("POST", `/api/player/items/${id}/use`),
  openFile: (id: number) => request<GameFile>("POST", `/api/player/files/${id}/open`),

  master: {
    overview: () => request<Overview>("GET", "/api/master/overview"),
    messages: () => request<Message[]>("GET", "/api/master/messages"),
    send: (body: { recipientId: string | null; senderLabel: string; text: string; type: MessageType }) =>
      request<Message>("POST", "/api/master/messages", body),
    setModule: (playerId: string, module: GameModule, patch: { locked?: boolean; visible?: boolean }) =>
      request<ModuleState[]>("PATCH", `/api/master/players/${playerId}/modules/${module}`, patch),
    setState: (playerId: string, patch: { health?: number; infection?: number; privateVars?: string }) =>
      request<PlayerState>("PATCH", `/api/master/players/${playerId}/state`, patch),
    revoke: (playerId: string) => request<void>("POST", `/api/master/players/${playerId}/revoke`),
    /** Sin código: el servidor genera uno aleatorio. Devuelve el código en claro (única vez). */
    changeCode: (playerId: string, code?: string) =>
      request<CodeChanged>("POST", `/api/master/players/${playerId}/code`, code ? { code } : {}),
    setSession: (status: SessionStatus) => request<SessionDto>("PATCH", "/api/master/session", { status }),
    startCountdown: (label: string, seconds: number) =>
      request<SessionDto>("POST", "/api/master/countdown", { label, seconds }),
    clearCountdown: () => request<SessionDto>("DELETE", "/api/master/countdown"),
    actions: () => request<PlayerAction[]>("GET", "/api/master/actions"),
    audit: () => request<AuditEntry[]>("GET", "/api/master/audit"),

    createMission: (body: MissionInput) => request<Mission>("POST", "/api/master/missions", body),
    updateMission: (id: number, patch: { title?: string; description?: string; status?: MissionStatus }) =>
      request<Mission>("PATCH", `/api/master/missions/${id}`, patch),
    deleteMission: (id: number) => request<void>("DELETE", `/api/master/missions/${id}`),

    createItem: (body: ItemInput) => request<Item>("POST", "/api/master/items", body),
    updateItem: (
      id: number,
      patch: { name?: string; description?: string; quantity?: number; usable?: boolean; consumable?: boolean; playerId?: string },
    ) => request<Item>("PATCH", `/api/master/items/${id}`, patch),
    deleteItem: (id: number) => request<void>("DELETE", `/api/master/items/${id}`),

    createFile: (body: FileInput) => request<GameFile>("POST", "/api/master/files", body),
    updateFile: (id: number, patch: { title?: string; classification?: FileClassification; body?: string; status?: FileStatus }) =>
      request<GameFile>("PATCH", `/api/master/files/${id}`, patch),
    deleteFile: (id: number) => request<void>("DELETE", `/api/master/files/${id}`),

    updateSector: (code: string, patch: { status?: SectorStatus; note?: string }) =>
      request<Sector[]>("PATCH", `/api/master/map/${code}`, patch),
  },
};
