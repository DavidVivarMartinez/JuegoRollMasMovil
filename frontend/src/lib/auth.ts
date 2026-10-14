import type { Role } from "./types";

const KEY = "eclipse.session";
/** Sesión propia de una ventana (la TV abierta desde el panel del máster en otro monitor). */
const WINDOW_KEY = "eclipse.window-session";
export const UNAUTHORIZED_EVENT = "eclipse:unauthorized";

export interface StoredSession {
  token: string;
  role: Role;
  playerId: string;
  sessionId: string;
  name: string;
  characterName: string | null;
}

/** Pantalla de inicio de cada rol. */
export function homeFor(role: Role): string {
  return role === "MASTER" ? "/master" : role === "DISPLAY" ? "/tv" : "/player";
}

function parse(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed && typeof parsed.token === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function windowSession(): StoredSession | null {
  try {
    return parse(sessionStorage.getItem(WINDOW_KEY));
  } catch {
    return null;
  }
}

/** La sesión de esta ventana tiene prioridad; si no hay, la del navegador (la normal). */
export function loadSession(): StoredSession | null {
  const own = windowSession();
  if (own) return own;
  try {
    return parse(localStorage.getItem(KEY));
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

/** Cierra la sesión de esta ventana si tiene una propia (sin tocar la del máster); si no, la del navegador. */
export function clearSession(): void {
  try {
    if (windowSession()) {
      sessionStorage.removeItem(WINDOW_KEY);
      return;
    }
    localStorage.removeItem(KEY);
  } catch {
    // ignorar
  }
}

// ---------------------------------------------------------------- ventana de la TV

const HASH_PARAM = "pantalla";

/** URL de la pantalla de mesa con su acceso en el fragmento (#), que nunca viaja al servidor. */
export function displayWindowUrl(session: StoredSession): string {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(session))));
  return `${window.location.origin}/tv#${HASH_PARAM}=${encodeURIComponent(encoded)}`;
}

/**
 * Si esta ventana se abrió con un acceso en el fragmento, lo guarda como sesión propia de la ventana
 * y limpia la URL. Debe llamarse antes de pintar la app (la ruta /tv comprueba el rol al entrar).
 */
export function adoptWindowSessionFromHash(): void {
  const hash = window.location.hash;
  if (!hash.startsWith(`#${HASH_PARAM}=`)) return;
  try {
    const encoded = decodeURIComponent(hash.slice(HASH_PARAM.length + 2));
    const session = parse(decodeURIComponent(escape(atob(encoded))));
    if (session) sessionStorage.setItem(WINDOW_KEY, JSON.stringify(session));
  } catch {
    // acceso mal formado: se ignora y la ventana pedirá código
  }
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}
