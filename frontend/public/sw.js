// Service worker mínimo: hace la web instalable en la pantalla de inicio y será la base del Web Push (fase 6).
// No cachea nada a propósito: la partida necesita siempre datos frescos del servidor.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
