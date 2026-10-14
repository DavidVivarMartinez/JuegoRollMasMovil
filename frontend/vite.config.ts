import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// El servidor de desarrollo va por HTTPS con certificado autofirmado: los móviles necesitan un origen seguro
// para Wake Lock (pantalla encendida), instalación como app y, más adelante, Web Push.
// `npm run dev:http` (modo "http") lo desactiva si el certificado da problemas.
// Las llamadas a /api y /ws se reenvían al backend, así que los móviles solo necesitan la IP del PC.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "http" ? [] : [basicSsl()])],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // Sin changeOrigin: la cabecera Host llega tal cual al backend, que así ve la misma Origin que el navegador
    // y no aplica CORS (las peticiones son del mismo origen desde el punto de vista del móvil).
    proxy: {
      "/api": { target: "http://localhost:8090" },
      "/ws": { target: "ws://localhost:8090", ws: true },
    },
  },
}));
