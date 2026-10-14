/** Registra el service worker solo en producción (en desarrollo interferiría con la recarga en caliente). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // sin service worker la web funciona igual; solo pierde la instalación "como app" en Android
    });
  });
}

/** true cuando la web se abrió desde el icono de la pantalla de inicio. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
