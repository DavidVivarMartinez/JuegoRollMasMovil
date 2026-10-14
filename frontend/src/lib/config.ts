/**
 * Dónde está el backend.
 * - Vacío (desarrollo): mismo origen; el proxy de Vite reenvía /api y /ws al backend local.
 * - VITE_API_URL (Netlify): URL pública del backend en Render, p. ej. https://eclipse-backend.onrender.com
 */
const raw = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim();
export const API_BASE = raw.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** URL del WebSocket STOMP. Netlify no reenvía WebSockets, así que el móvil habla directamente con el backend. */
export function wsUrl(): string {
  if (API_BASE) {
    const url = new URL("/ws", API_BASE);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}
