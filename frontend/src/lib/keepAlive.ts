import { useEffect } from "react";
import { apiUrl } from "./config";

/**
 * Ping periódico al backend mientras la pestaña está visible. El plan gratuito de Render apaga el servicio
 * tras 15 minutos sin peticiones HTTP; con un terminal abierto durante la partida nunca llega a dormirse.
 * Se usa mode "no-cors" para que no falle aunque la respuesta no sea legible desde otro origen.
 */
export function useKeepAlive(intervalMs = 4 * 60_000): void {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch(apiUrl("/actuator/health"), { mode: "no-cors", cache: "no-store" }).catch(() => undefined);
    };
    const timer = window.setInterval(ping, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
}
