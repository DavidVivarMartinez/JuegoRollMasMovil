import { useEffect } from "react";

/**
 * Mantiene la pantalla del móvil encendida mientras la pestaña está visible (Screen Wake Lock API).
 * Requiere origen seguro (HTTPS). Si el navegador no lo soporta o lo deniega, simplemente no hace nada.
 * El sistema libera el bloqueo al ocultar la pestaña; lo volvemos a pedir al mostrarla o al primer toque.
 */
export function useWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (sentinel || document.visibilityState !== "visible") return;
      try {
        const s = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel = s;
        s.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        // denegado (batería baja, ajustes del sistema...): se reintentará con el siguiente gesto
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    const onGesture = () => void request();

    void request();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", onGesture, { passive: true });
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", onGesture);
      void sentinel?.release();
      sentinel = null;
    };
  }, [enabled]);
}
