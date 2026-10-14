import { Client, type IMessage } from "@stomp/stompjs";
import { useEffect, useRef, useState } from "react";
import { wsUrl } from "./config";
import type { ServerEvent } from "./types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface RealtimeOptions {
  token: string | null;
  /** Destinos STOMP a los que suscribirse en cada (re)conexión. */
  destinations: string[];
  onEvent: (destination: string, event: ServerEvent) => void;
  /** Se llama tras cada conexión (incluidas reconexiones): el momento de resincronizar por REST. */
  onConnected?: () => void;
  /** El servidor rechazó el token: hay que volver a entrar con el código. */
  onAuthError?: () => void;
}

const SOCKET_OPEN = 1;
/** Si el móvil estuvo bloqueado más de esto, damos el socket por muerto y reconectamos sin esperar al heartbeat. */
const STALE_AFTER_MS = 8_000;

/**
 * Conexión STOMP sobre WebSocket con reconexión automática. Los callbacks se guardan en refs para que
 * cambiarlos no fuerce una reconexión; solo el token o la lista de destinos reinician el cliente.
 * Al volver del bloqueo del móvil (o recuperar la red) fuerza una reconexión inmediata.
 */
export function useRealtime(options: RealtimeOptions): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const onEventRef = useRef(options.onEvent);
  const onConnectedRef = useRef(options.onConnected);
  const onAuthErrorRef = useRef(options.onAuthError);
  onEventRef.current = options.onEvent;
  onConnectedRef.current = options.onConnected;
  onAuthErrorRef.current = options.onAuthError;

  const destinationsKey = options.destinations.join("|");
  const { token } = options;

  useEffect(() => {
    if (!token) {
      setStatus("disconnected");
      return;
    }
    const destinations = destinationsKey.split("|").filter(Boolean);
    const client = new Client({
      brokerURL: wsUrl(),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 2500,
      // si el servidor no confirma la conexión a tiempo (red móvil, redespliegue), se corta y se reintenta
      connectionTimeout: 8000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setStatus("connected");
        for (const destination of destinations) {
          client.subscribe(destination, (frame: IMessage) => {
            try {
              onEventRef.current(destination, JSON.parse(frame.body) as ServerEvent);
            } catch (err) {
              console.error("Evento STOMP no válido", err);
            }
          });
        }
        onConnectedRef.current?.();
      },
      onStompError: (frame) => {
        const message = frame.headers["message"] ?? "";
        if (/TOKEN_INVALIDO|NO_AUTENTICADO/.test(message)) {
          client.reconnectDelay = 0; // no insistir con un token rechazado
          onAuthErrorRef.current?.();
        }
      },
      onWebSocketClose: () => setStatus((prev) => (prev === "connected" ? "disconnected" : prev)),
      onDisconnect: () => setStatus("disconnected"),
    });

    // --- reconexión inmediata al volver a la pestaña / recuperar la red
    let hiddenAt = 0;
    let bouncing = false;
    const bounce = () => {
      if (bouncing || !client.active) return;
      bouncing = true;
      setStatus("connecting");
      client
        .deactivate({ force: true })
        .catch(() => undefined)
        .finally(() => {
          bouncing = false;
          client.activate();
        });
    };
    const nudge = () => {
      if (document.visibilityState !== "visible") return;
      const socketOpen = client.webSocket?.readyState === SOCKET_OPEN;
      const stale = hiddenAt > 0 && Date.now() - hiddenAt > STALE_AFTER_MS;
      hiddenAt = 0;
      if (!socketOpen || stale) bounce();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else nudge();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", nudge);
    window.addEventListener("pageshow", nudge);

    setStatus("connecting");
    client.activate();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", nudge);
      window.removeEventListener("pageshow", nudge);
      void client.deactivate();
    };
  }, [token, destinationsKey]);

  return status;
}
