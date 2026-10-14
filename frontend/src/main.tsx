import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { adoptWindowSessionFromHash } from "./lib/auth";
import { registerServiceWorker } from "./lib/pwa";

// ventana de la TV abierta desde el panel del máster: coge su acceso antes de pintar nada
adoptWindowSessionFromHash();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
