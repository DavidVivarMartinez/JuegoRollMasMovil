# PROTOCOLO: ECLIPSE — terminal de partida

Web para la partida presencial de Halloween: cuatro jugadores entran desde el móvil con un código personal,
el máster controla la partida (también desde el móvil) y todo cambia en tiempo real por WebSocket.

- **Backend**: Java 21 · Spring Boot 4.1 (Web MVC, WebSocket/STOMP, Security, Data JPA, Flyway) · PostgreSQL 17
- **Frontend**: React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · @stomp/stompjs · PWA instalable
- **Documentos de diseño**: los dos PDF de historia y requisitos técnicos (no están en el repositorio)

## Estado actual (Fase 1 + Fase 2 del plan)

| Hecho | Pendiente |
|---|---|
| Acceso por código (o enlace `?code=XXX`), token revocable, roles MÁSTER / JUGADOR | Eventos programables y motor de eventos (Fase 4) |
| Mensajes privados y globales en tiempo real, persistidos y recuperados al reconectar | Contenido de Misiones, Inventario, Archivos y Mapa (Fase 3) |
| Bloquear / ocultar módulos por jugador; el backend rechaza acciones sobre módulos bloqueados | Cuenta atrás, apagones, pantallas de emergencia (Fase 5) |
| Salud e infección ocultas; el jugador solo ve una lectura biométrica derivada | Web Push (Fase 6) |
| Presencia (quién está conectado), acuses de lectura, acciones de jugador, auditoría | Despliegue con HTTPS y dominio |
| Alertas con vibración, pitido y pantalla roja en el móvil | |
| Todo pensado para móvil: PWA, pantalla siempre encendida, barra inferior, zonas seguras | |
| Contenido de la partida: misiones (tripulación, oficiales y secretas), inventario, archivos restringidos, plano de la estación y cuenta atrás | |

## Pantalla de mesa (TV)

Para la tele conectada al ordenador de la mesa. El ordenador abre la web y entra con el código de la pantalla
(`PANTALLA-MESA` por defecto, cámbialo en **ESTACIÓN → CÓDIGOS DE ACCESO**); pulsa **PANTALLA COMPLETA** y ya no hace falta tocarlo.
Todo se controla desde el móvil del máster, pestaña **MESA**:

- **Escena**: reposo (logo de la partida), plano de la estación en vivo o un mapa propio subido como imagen desde el móvil.
  Las fotos grandes se reducen en el móvil antes de subirlas (máx. 2560 px); se guardan en la base de datos.
- **Fichas**: una por jugador (aparecen solas) y las que añadas para PNJ, infectados u objetos. Arrastra o toca una ficha y
  luego el destino. El ojo la oculta en la tele. Cada escena recuerda sus posiciones.
- **Niebla de guerra** por casillas (8 a 24 de ancho): pincel REVELAR o CUBRIR pasando el dedo. En la tele es opaca con bordes
  suaves; en el móvil se ve translúcida. Los PNJ bajo la niebla no se ven; los jugadores, siempre.
- **Efectos**: apagón, alerta roja o mensaje a pantalla completa, interferencia y la cuenta atrás común en grande.

La tele solo puede leer (rol `DISPLAY`): no ve mensajes privados, misiones ni secretos, y el plano lo ve como los jugadores.

## Contenido de la partida

Todo el contenido inicial está en `backend/src/main/resources/game-content.yml` y se carga una vez por partida
(cuando aún no tiene misiones). Después se gestiona desde el panel del máster. Reglas que aplica el servidor:

- **Misiones**: las de la tripulación las ven todos; las oficiales y secretas solo su jugador. Una misión `HIDDEN` no viaja
  al móvil. El jugador puede «informar al mando»; el máster decide si queda cumplida o fallida.
- **Objetos**: cada jugador ve solo su inventario. «Usar» queda registrado para el máster; si el objeto es consumible se
  descuenta una unidad y desaparece al llegar a cero. El máster da, quita, ajusta cantidades o transfiere entre jugadores.
- **Archivos**: públicos de la estación o privados de un personaje. `HIDDEN` no se envía; `CORRUPTED` se envía con parte
  del texto sustituida por bloques (la corrupción se hace en servidor, el texto íntegro nunca sale). Abrir un archivo avisa al máster.
- **Plano**: el estado de cada sector es común. Los sectores `UNKNOWN` llegan sin nombre ni nota. La posición de las
  casillas se sincroniza con el YAML en cada arranque; el estado y la nota se conservan.
- **Cuenta atrás**: común a toda la partida, sincronizada con el reloj del servidor; al llegar a cero el móvil avisa.

Personajes del YAML, por `character-code`: `ENGINEER` (David), `MEDIC` (Laura), `SECURITY` (Carlos), `SCIENTIST` (Ana).
Los secretos de cada uno y los archivos que el máster debe ir desbloqueando en los actos III y IV están ahí dentro.

## Arrancar en local

Requisitos: Java 21, Node 20+, Docker Desktop en marcha. No hace falta Maven (se usa el wrapper).

```bash
# 1) Backend en el puerto 8090 (arranca solo el PostgreSQL de compose.yaml la primera vez)
cd backend
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run

# 2) Frontend, en otra terminal
cd frontend
npm install
npm run dev                     # https://localhost:5173  y  https://<IP-del-PC>:5173 para los móviles
```

Al arrancar, el backend crea la partida de ejemplo y escribe en el log los códigos de acceso:

| Quién | Código |
|---|---|
| Máster | `ECLIPSE-MASTER` |
| David · Ingeniero | `ING-7731` |
| Laura · Médica | `MED-2048` |
| Carlos · Seguridad | `SEG-0917` |
| Ana · Científica | `CIE-6618` |
| Pantalla de mesa (TV) | `PANTALLA-MESA` |

Los códigos no distinguen mayúsculas, espacios ni guiones (`cie 6618` vale). Están en `backend/src/main/resources/application.yml`
bajo `app.seed` y se cargan solos en la base de datos la primera vez que arranca el backend. Como son públicos en
GitHub, cámbialos desde el panel del máster: **ESTACIÓN → CÓDIGOS DE ACCESO** (generar aleatorios o escribir los tuyos).
El panel avisa mientras quede alguno de ejemplo. Solo se guardan hashes: un código se ve en claro únicamente al cambiarlo.

### Probar en los móviles

1. Móviles y PC en la misma Wi-Fi. Abre en el móvil `https://<IP-del-PC>:5173` (la IP la imprime Vite al arrancar).
2. El certificado de desarrollo es autofirmado: el navegador avisará una vez. En Android Chrome: «Configuración avanzada → Acceder»;
   en iPhone Safari: «Mostrar detalles → visitar este sitio web». Solo pasa en desarrollo; en la partida real se usará un dominio con HTTPS.
3. Para usarla a pantalla completa: menú del navegador → «Añadir a pantalla de inicio». En iPhone, hazlo solo cuando el servidor
   tenga certificado válido (en modo app no se puede aceptar un certificado autofirmado).
4. Si el certificado da guerra, `npm run dev:http` sirve en HTTP normal. Perderás la pantalla siempre encendida (Wake Lock exige HTTPS).

El servidor de Vite reenvía `/api` y `/ws` al backend en el puerto 8090, así que los móviles solo necesitan la IP del PC.

### Qué hace la web por ser móvil

- **PWA**: `manifest.webmanifest`, iconos (`npm run icons` los regenera), pantalla completa sin barra del navegador, color de barra de estado.
- **Pantalla encendida** mientras la pestaña está visible (Screen Wake Lock); se vuelve a pedir al desbloquear el móvil.
- **Reconexión inmediata** al volver del bloqueo o recuperar red: se reabre el WebSocket y se recarga el estado por REST, sin duplicar mensajes.
- **Ergonomía táctil**: barra de navegación inferior, botones de 44 px, campos a 16 px (iOS no hace zoom), sin retardo de doble toque,
  márgenes para el notch y la barra de gestos, sin "tirar para recargar".
- **Avisos**: vibración (Android), pitido sintetizado y pantalla roja en las alertas. El audio se desbloquea con el primer toque.
- **Máster en móvil**: tres pestañas (Tripulación · Transmitir · Registro) con chips y botones ±5 en vez de desplegables y sliders.
  En pantalla ancha (portátil) se ven las tres columnas a la vez.

## Pruebas

```bash
cd backend
./mvnw test
```

Los tests (`EclipseFlowTests`) levantan la aplicación con H2 en memoria y comprueban los criterios de aceptación:
un privado solo llega a su destinatario y un global a todos (REST y WebSocket), un jugador no puede usar endpoints
del máster, el backend rechaza acciones sobre módulos bloqueados, la infección nunca viaja al jugador y un token
inválido o una suscripción a un topic ajeno se rechazan en STOMP.

## Cómo está organizado

```
compose.yaml                      PostgreSQL para desarrollo
backend/
  src/main/resources/application.yml      configuración y partida de ejemplo (app.seed)
  src/main/resources/game-content.yml     misiones, objetos, archivos y plano iniciales (prefijo game.*)
  src/main/resources/db/migration/        Flyway (V1 esquema, V2 contenido, V3 pantalla de mesa)
  src/main/java/es/eclipse/backend/
    config/      SecurityConfig (token Bearer, roles), WebSocketConfig (STOMP), AppProperties, GameContentProperties
    security/    EclipsePrincipal, TokenService, filtro HTTP, interceptor STOMP, limitador de intentos
    domain/      GameSession, Player, Message, PlayerState, ModuleState, PlayerAction, AuditLog,
                 Mission, InventoryItem, GameFile, MapSector
    service/     Auth, Message, Module, PlayerState, PlayerAction, Presence, Master, RealtimePublisher,
                 Mission, Inventory, File, Map
    web/         SessionController, PlayerController, MasterController, ApiExceptionHandler, dto/
    seed/        SeedDataRunner (partida y códigos), ContentSeeder (contenido del YAML)
frontend/
  public/        manifest.webmanifest, sw.js, icons/
  scripts/       make-icons.mjs (genera los iconos PNG sin dependencias)
  src/lib/       api.ts (REST), realtime.ts (STOMP con reconexión), auth.ts, notify.ts, wakeLock.ts, pwa.ts, types.ts
  src/pages/     JoinPage, TvScreen (pantalla de mesa), PlayerTerminal (DIRECTO, COMMS, MISIÓN, OBJETOS, ARCHIVOS, MAPA, BIO),
                 MasterPanel (Tripulación con ficha por jugador, Transmitir, Estación, Registro)
  src/components/ BottomNav, Icon, MessageBubble, LockOverlay, AlertFlash, StatusDot,
                 StationMap (plano SVG), Countdown, ContentManagers (gestores de misiones, objetos y archivos),
                 SceneView (mapa, niebla y fichas), TableControl (MESA del máster), AccessCodes
```

### API REST

| Método | Ruta | Quién | Para qué |
|---|---|---|---|
| POST | `/api/session/join` | público | Entrar con código → token |
| POST | `/api/session/leave` | autenticado | Revocar el token del dispositivo |
| GET | `/api/player/me` | jugador | Identidad, sesión, módulos permitidos, biometría |
| GET | `/api/player/messages` | jugador | Globales de su partida + privados propios |
| POST | `/api/player/messages/{id}/read` | jugador | Acuse de lectura de un privado |
| POST | `/api/player/actions` | jugador | Acción (`module`, `type`, `payload`); 423 si el módulo está bloqueado |
| POST | `/api/player/missions/{id}/report` | jugador | Informar sobre una misión visible |
| POST | `/api/player/items/{id}/use` | jugador | Usar un objeto propio (409 si no es usable); devuelve el inventario |
| POST | `/api/player/files/{id}/open` | jugador | Abrir un archivo visible (texto corrupto si procede) |
| POST / PATCH / DELETE | `/api/master/missions[/{id}]` | máster | Crear, cambiar estado o texto, borrar |
| POST / PATCH / DELETE | `/api/master/items[/{id}]` | máster | Dar, ajustar o transferir (`playerId`), quitar |
| POST / PATCH / DELETE | `/api/master/files[/{id}]` | máster | Crear, cambiar estado o texto, borrar |
| PATCH | `/api/master/map/{code}` | máster | `{status, note}` de un sector |
| POST / DELETE | `/api/master/countdown` | máster | Iniciar `{label, seconds}` o cancelar la cuenta atrás |
| POST | `/api/master/players/{id}/code` | máster | Cambiar `{code}` o generar el código de un participante |
| GET | `/api/display/bootstrap` | TV y máster | Estado de la mesa, mapas, plano y sesión |
| GET | `/api/display/maps/{id}/image` | TV y máster | Imagen de un mapa |
| PUT | `/api/master/display` | máster | Estado completo de la mesa (el servidor lo acota y corrige) |
| POST / DELETE | `/api/master/maps[/{id}]` | máster | Subir (`?name&width&height`, cuerpo = imagen) o borrar un mapa |
| GET | `/api/master/overview` | máster | Jugadores, conexión, estado oculto y módulos |
| POST | `/api/master/messages` | máster | Mensaje privado (`recipientId`) o global (sin destinatario) |
| PATCH | `/api/master/players/{id}/modules/{module}` | máster | `{locked, visible}` |
| PATCH | `/api/master/players/{id}/state` | máster | `{health, infection, privateVars}` |
| POST | `/api/master/players/{id}/revoke` | máster | Expulsar dispositivo |
| PATCH | `/api/master/session` | máster | Estado de la partida |
| GET | `/api/master/messages` · `/actions` · `/audit` | máster | Historiales |

Los errores vuelven como `application/problem+json` con un campo `code` (`INVALID_CODE`, `MODULE_LOCKED`, `FORBIDDEN`, …).

### Canales STOMP (`/ws`)

El token va en la cabecera `Authorization: Bearer …` del CONNECT. El servidor cierra la conexión ante cualquier
suscripción no permitida.

| Destino | Quién recibe | Eventos (`type`) |
|---|---|---|
| `/user/queue/messages` | el propio jugador | `MESSAGE` (privado) |
| `/user/queue/state` | el propio jugador | `MODULES`, `BIOMETRICS`, `MISSIONS`, `ITEMS`, `FILES` (listas completas ya filtradas) |
| `/topic/session/{sessionId}` | toda la partida | `MESSAGE` (global), `SESSION` (estado y cuenta atrás), `MAP` |
| `/topic/session/{sessionId}/display` | TV y máster | `DISPLAY` (estado de la mesa), `MAPS` |
| `/topic/session/{sessionId}/master` | solo el máster | `MESSAGE`, `MESSAGE_READ`, `MODULES`, `PLAYER_STATE`, `PRESENCE`, `PLAYER_ACTION`, `SESSION`, `MISSIONS`, `ITEMS`, `FILES`, `MAP` |

Cada evento llega como `{ "type": "...", "payload": {...}, "ts": "..." }`. Al reconectar, el cliente vuelve a pedir
`/api/player/me` y `/api/player/messages` y descarta duplicados por id.

## Despliegue: backend en Render, frontend en Netlify

El repositorio ya trae todo lo necesario: `render.yaml` (Blueprint con el servicio Docker y un PostgreSQL),
`backend/Dockerfile`, el perfil `prod` y `netlify.toml`. El móvil habla con Render directamente para `/api` y `/ws`
(Netlify no reenvía WebSockets), por eso el frontend necesita la URL del backend al compilar.

### 1. Backend en Render

1. Abre https://render.com/deploy?repo=https://github.com/DavidVivarMartinez/JuegoRollMasMovil (equivale a
   **New → Blueprint** con este repositorio) y acepta `render.yaml`.
2. Solo pide un **Blueprint Name**: es una etiqueta, pon cualquiera (por ejemplo `protocolo-eclipse`). Pulsa **Apply**.
3. Render crea la base de datos y el backend. El primer arranque tarda unos minutos (compila la imagen). Cuando el health check esté en verde,
   la URL será `https://protocolo-eclipse-api.onrender.com` (o con sufijo si el nombre estaba cogido). Apúntala.
4. Comprueba `https://protocolo-eclipse-api.onrender.com/actuator/health` → `{"status":"UP"}`.

Notas:
- El plan **free** se apaga tras 15 minutos sin tráfico y tarda ~1 minuto en despertar. La web hace un ping cada
  4 minutos mientras hay un terminal abierto, así que durante la partida no se duerme; aun así, para el día de la
  partida es más seguro pasarlo a **starter** (7 $/mes, se puede volver a free después). Abre el panel del máster
  un par de minutos antes de empezar.
- El PostgreSQL gratuito de Render **caduca a los 30 días** y se borra. Para algo duradero usa Neon (gratis):
  en el servicio de Render define `SPRING_DATASOURCE_URL=jdbc:postgresql://<host>/<db>?sslmode=require`,
  `SPRING_DATASOURCE_USERNAME` y `SPRING_DATASOURCE_PASSWORD`, y elimina las variables `DB_*`.
- `FRONTEND_ORIGIN` vale `https://nexus-7-terminal.netlify.app`, el sitio de Netlify. Es lo que permite
  CORS y el WebSocket desde el frontend; si cambias el nombre del sitio, cámbialo también en Render.

### 2. Frontend en Netlify

1. En Netlify: **Add new site → Import an existing project**, elige el repositorio. `netlify.toml` ya fija
   `base = frontend`, `npm run build` y `publish = dist`.
2. Antes del primer deploy, en **Site configuration → Environment variables** añade
   `VITE_API_URL = https://protocolo-eclipse-api.onrender.com` (sin barra final).
3. Deploy. La web queda en `https://nexus-7-terminal.netlify.app` con HTTPS real: los móviles pueden instalarla desde
   «Añadir a pantalla de inicio» sin avisos, también en iPhone.
4. Si cambias el nombre del sitio o pones dominio propio, actualiza `FRONTEND_ORIGIN` en Render.

### Alternativa: todo en un solo host

`cd frontend && npm run build`, copiar `frontend/dist/*` a `backend/src/main/resources/static/` y desplegar solo el backend
(ya reenvía `/player` y `/master` a `index.html`). Sin CORS ni `VITE_API_URL`; se pierde la CDN de Netlify, que para
cinco móviles no importa.
