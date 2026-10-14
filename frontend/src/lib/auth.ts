import type { Role } from "./types";

const KEY = "eclipse.session";
export const UNAUTHORIZED_EVENT = "eclipse:unauthorized";

export interface StoredSession {
  token: string;
  role: Role;
  playerId: string;
  sessionId: string;
  name: string;
  characterName: string | null;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed && typeof parsed.token === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // modo privado sin almacenamiento: la sesión durará lo que dure la pestaña
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignorar
  }
}
