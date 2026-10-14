// Tipos espejo de los DTOs del backend (es.eclipse.backend.web.dto.Dtos)

export type Role = "MASTER" | "PLAYER" | "DISPLAY";
export type GameModule = "COMMS" | "MISSIONS" | "INVENTORY" | "FILES" | "MAP" | "BIOMETRICS";
export type MessageType = "TEXT" | "ALERT" | "SYSTEM";
export type SessionStatus = "LOBBY" | "RUNNING" | "PAUSED" | "FINISHED";
export type MissionKind = "SHARED" | "OFFICIAL" | "SECRET";
export type MissionStatus = "HIDDEN" | "ACTIVE" | "DONE" | "FAILED";
export type FileClassification = "PUBLIC" | "RESTRICTED" | "CLASSIFIED";
export type FileStatus = "HIDDEN" | "UNLOCKED" | "CORRUPTED";
export type SectorStatus = "UNKNOWN" | "OPEN" | "LOCKED" | "QUARANTINE" | "DANGER" | "DESTROYED";

export const ALL_MODULES: GameModule[] = ["COMMS", "MISSIONS", "INVENTORY", "FILES", "MAP", "BIOMETRICS"];

export const MODULE_LABEL: Record<GameModule, string> = {
  COMMS: "COMMS",
  MISSIONS: "MISIONES",
  INVENTORY: "INVENTARIO",
  FILES: "ARCHIVOS",
  MAP: "MAPA",
  BIOMETRICS: "BIO",
};

export const SESSION_LABEL: Record<SessionStatus, string> = {
  LOBBY: "EN ESPERA",
  RUNNING: "EN CURSO",
  PAUSED: "PAUSA",
  FINISHED: "FINALIZADA",
};

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  HIDDEN: "OCULTA",
  ACTIVE: "ACTIVA",
  DONE: "CUMPLIDA",
  FAILED: "FALLIDA",
};

export const MISSION_KIND_LABEL: Record<MissionKind, string> = {
  SHARED: "TRIPULACIÓN",
  OFFICIAL: "OFICIAL",
  SECRET: "SECRETA",
};

export const FILE_STATUS_LABEL: Record<FileStatus, string> = {
  HIDDEN: "OCULTO",
  UNLOCKED: "LEGIBLE",
  CORRUPTED: "CORRUPTO",
};

export const CLASSIFICATION_LABEL: Record<FileClassification, string> = {
  PUBLIC: "PÚBLICO",
  RESTRICTED: "RESTRINGIDO",
  CLASSIFIED: "CLASIFICADO",
};

export const SECTOR_STATUS_LABEL: Record<SectorStatus, string> = {
  UNKNOWN: "DESCONOCIDO",
  OPEN: "ACCESIBLE",
  LOCKED: "BLOQUEADO",
  QUARANTINE: "CUARENTENA",
  DANGER: "PELIGRO",
  DESTROYED: "DESTRUIDO",
};

export interface JoinResponse {
  token: string;
  role: Role;
  playerId: string;
  sessionId: string;
  name: string;
  characterName: string | null;
  characterCode: string | null;
}

export interface SessionDto {
  id: string;
  name: string;
  status: SessionStatus;
  startedAt: string | null;
  countdownLabel: string | null;
  countdownEndsAt: string | null;
}

export interface PlayerSummary {
  id: string;
  name: string;
  characterName: string | null;
  characterCode: string | null;
  role: Role;
}

export interface ModuleState {
  module: GameModule;
  locked: boolean;
  visible: boolean;
}

export interface Biometrics {
  health: number;
  status: string;
  anomaly: boolean;
}

export interface Mission {
  id: number;
  playerId: string | null;
  code: string | null;
  kind: MissionKind;
  title: string;
  description: string | null;
  status: MissionStatus;
  updatedAt: string;
}

export interface Item {
  id: number;
  playerId: string;
  name: string;
  description: string | null;
  quantity: number;
  usable: boolean;
  consumable: boolean;
}

export interface GameFile {
  id: number;
  playerId: string | null;
  code: string | null;
  title: string;
  classification: FileClassification;
  status: FileStatus;
  body: string | null;
  updatedAt: string;
}

export interface Sector {
  id: number;
  code: string;
  name: string | null;
  status: SectorStatus;
  note: string | null;
  x: number;
  y: number;
  links: string[];
}

export interface Me {
  player: PlayerSummary;
  session: SessionDto;
  modules: ModuleState[];
  biometrics: Biometrics | null;
  missions: Mission[];
  items: Item[];
  files: GameFile[];
  map: Sector[];
  serverTime: string;
}

export interface Message {
  id: number;
  scope: "GLOBAL" | "PRIVATE";
  recipientId: string | null;
  senderLabel: string;
  text: string;
  type: MessageType;
  createdAt: string;
  readAt: string | null;
}

export interface PlayerState {
  playerId: string;
  health: number;
  infection: number;
  privateVars: string;
  updatedAt: string | null;
}

export interface PlayerOverview {
  player: PlayerSummary;
  connected: boolean;
  state: PlayerState;
  modules: ModuleState[];
  tokenIssuedAt: string | null;
}

export interface AccessCode {
  playerId: string;
  name: string;
  role: Role;
  characterName: string | null;
  /** true si sigue con el código de ejemplo del repositorio (público) */
  defaultCode: boolean;
}

export interface CodeChanged {
  playerId: string;
  name: string;
  code: string;
}

export interface Overview {
  session: SessionDto;
  players: PlayerOverview[];
  missions: Mission[];
  items: Item[];
  files: GameFile[];
  map: Sector[];
  accessCodes: AccessCode[];
  /** ids de los participantes con el terminal conectado ahora mismo (jugadores y pantalla de mesa) */
  connected: string[];
  serverTime: string;
}

export interface PlayerModules {
  playerId: string;
  modules: ModuleState[];
}

export interface Presence {
  connected: string[];
}

export interface PlayerAction {
  id: number;
  playerId: string;
  module: GameModule | null;
  type: string;
  payload: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  actorId: string | null;
  actorLabel: string;
  action: string;
  target: string | null;
  details: string | null;
  createdAt: string;
}

export interface ServerEvent<T = unknown> {
  type: string;
  payload: T;
  ts: string;
}

export interface ApiProblem {
  status?: number;
  code?: string;
  detail?: string;
  module?: string;
  fields?: Record<string, string>;
}

// ---------------------------------------------------------------- pantalla de mesa (TV)

export type OverlayType = "NONE" | "BLACKOUT" | "ALERT" | "MESSAGE";

export interface DisplayToken {
  id: string;
  label: string;
  color: string;
  /** posición relativa a la escena, de 0 a 1 */
  x: number;
  y: number;
  visible: boolean;
  /** ficha de un jugador; null para PNJ, infectados... */
  playerId: string | null;
}

export interface DisplayFog {
  enabled: boolean;
  cols: number;
  rows: number;
  /** cols*rows caracteres: '1' visible, '0' cubierto, por filas */
  revealed: string;
}

export interface DisplayScene {
  tokens: DisplayToken[];
  fog: DisplayFog;
}

export interface DisplayOverlay {
  type: OverlayType;
  title: string | null;
  text: string | null;
}

export interface DisplayState {
  rev: string | null;
  /** "NONE", "STATION" o "MAP:<id>" */
  scene: string;
  scenes: Record<string, DisplayScene>;
  overlay: DisplayOverlay;
  glitch: boolean;
  showCountdown: boolean;
}

export interface MapImage {
  id: number;
  name: string;
  contentType: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
}

export interface DisplayBootstrap {
  session: SessionDto;
  state: DisplayState;
  maps: MapImage[];
  sectors: Sector[];
}
