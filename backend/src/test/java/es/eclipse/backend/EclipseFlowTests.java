package es.eclipse.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Type;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

/**
 * Criterios de aceptación del MVP contra la aplicación real (REST + STOMP) con H2.
 * Usa los códigos de la partida de ejemplo de application.yml.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class EclipseFlowTests {

    private static final HttpClient HTTP = HttpClient.newHttpClient();

    @Value("${local.server.port}")
    int port;

    private Joined master;
    private Joined ana;
    private Joined david;
    private ThreadPoolTaskScheduler scheduler;

    record Joined(String token, String playerId, String sessionId) {}

    record Resp(int status, String body) {}

    @BeforeAll
    void joinEveryone() throws Exception {
        master = join("ECLIPSE-MASTER");
        ana = join("cie 6618"); // el código se normaliza: da igual mayúsculas, espacios o guiones (CIE-6618)
        david = join("ING-7731");
        scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.initialize();
    }

    @AfterAll
    void shutdown() {
        if (scheduler != null) {
            scheduler.shutdown();
        }
    }

    @Test
    void invalidCodeIsRejected() throws Exception {
        Resp r = call("POST", "/api/session/join", null, "{\"code\":\"NO-EXISTE\"}");
        assertEquals(401, r.status());
        assertTrue(r.body().contains("INVALID_CODE"), r.body());
    }

    @Test
    void privateMessageReachesOnlyRecipientAndGlobalReachesAll() throws Exception {
        String privateText = "Solo-para-Ana-" + UUID.randomUUID();
        String globalText = "Para-todos-" + UUID.randomUUID();

        Resp sent = call("POST", "/api/master/messages", master.token(),
                "{\"recipientId\":\"" + ana.playerId() + "\",\"senderLabel\":\"CORPORACION\",\"text\":\"" + privateText + "\",\"type\":\"ALERT\"}");
        assertEquals(201, sent.status(), sent.body());
        assertTrue(sent.body().contains("\"scope\":\"PRIVATE\""), sent.body());

        Resp global = call("POST", "/api/master/messages", master.token(), "{\"text\":\"" + globalText + "\"}");
        assertEquals(201, global.status(), global.body());
        assertTrue(global.body().contains("\"scope\":\"GLOBAL\""), global.body());

        String anaInbox = call("GET", "/api/player/messages", ana.token(), null).body();
        String davidInbox = call("GET", "/api/player/messages", david.token(), null).body();
        assertTrue(anaInbox.contains(privateText));
        assertTrue(anaInbox.contains(globalText));
        assertFalse(davidInbox.contains(privateText), "David no debe ver el privado de Ana");
        assertTrue(davidInbox.contains(globalText));
    }

    @Test
    void playerCannotUseMasterEndpointsAndBadTokensAreRejected() throws Exception {
        assertEquals(403, call("GET", "/api/master/overview", david.token(), null).status());
        assertEquals(401, call("GET", "/api/player/me", "token-falso", null).status());
        assertEquals(401, call("GET", "/api/player/me", null, null).status());
    }

    @Test
    void lockedModuleIsRejectedByBackend() throws Exception {
        String path = "/api/master/players/" + ana.playerId() + "/modules/INVENTORY";
        Resp lock = call("PATCH", path, master.token(), "{\"locked\":true}");
        assertEquals(200, lock.status(), lock.body());

        String action = "{\"module\":\"INVENTORY\",\"type\":\"USE_ITEM\",\"payload\":\"linterna\"}";
        Resp anaTry = call("POST", "/api/player/actions", ana.token(), action);
        assertEquals(423, anaTry.status(), anaTry.body());
        assertTrue(anaTry.body().contains("MODULE_LOCKED"), anaTry.body());

        Resp davidTry = call("POST", "/api/player/actions", david.token(), action);
        assertEquals(201, davidTry.status(), davidTry.body());

        String me = call("GET", "/api/player/me", ana.token(), null).body();
        assertTrue(me.contains("\"module\":\"INVENTORY\",\"locked\":true"), me);

        assertEquals(200, call("PATCH", path, master.token(), "{\"locked\":false}").status());
    }

    @Test
    void infectionIsNeverSentToPlayers() throws Exception {
        String me = call("GET", "/api/player/me", ana.token(), null).body();
        assertFalse(me.contains("infection"), me);
        assertTrue(me.contains("\"biometrics\""), me);
        assertTrue(me.contains("\"anomaly\":true"), "Ana (67%) debe ver anomalías: " + me);

        String overview = call("GET", "/api/master/overview", master.token(), null).body();
        assertTrue(overview.contains("\"infection\":67"), overview);
    }

    @Test
    void websocketDeliversPrivateMessageOnlyToRecipient() throws Exception {
        WebSocketStompClient client = stompClient();
        BlockingQueue<String> anaInbox = new LinkedBlockingQueue<>();
        BlockingQueue<String> davidInbox = new LinkedBlockingQueue<>();
        StompSession anaSession = connect(client, ana.token(), new CountDownLatch(1));
        StompSession davidSession = connect(client, david.token(), new CountDownLatch(1));
        try {
            subscribe(anaSession, "/user/queue/messages", anaInbox);
            subscribe(davidSession, "/user/queue/messages", davidInbox);
            Thread.sleep(500); // dar tiempo al broker a registrar las suscripciones

            String text = "WS-privado-" + UUID.randomUUID();
            Resp sent = call("POST", "/api/master/messages", master.token(),
                    "{\"recipientId\":\"" + ana.playerId() + "\",\"text\":\"" + text + "\"}");
            assertEquals(201, sent.status(), sent.body());

            String received = anaInbox.poll(5, TimeUnit.SECONDS);
            assertNotNull(received, "Ana debería recibir el mensaje por WebSocket");
            assertTrue(received.contains(text), received);
            assertTrue(received.contains("\"type\":\"MESSAGE\""), received);
            assertNull(davidInbox.poll(1, TimeUnit.SECONDS), "David no debe recibir el privado de Ana");
        } finally {
            anaSession.disconnect();
            davidSession.disconnect();
        }
    }

    @Test
    void websocketRejectsInvalidTokenAndForeignTopics() throws Exception {
        WebSocketStompClient client = stompClient();

        StompHeaders bad = new StompHeaders();
        bad.add("Authorization", "Bearer no-vale");
        CompletableFuture<StompSession> future = client.connectAsync(wsUrl(), new WebSocketHttpHeaders(), bad,
                new StompSessionHandlerAdapter() {});
        assertThrows(Exception.class, () -> future.get(5, TimeUnit.SECONDS));

        CountDownLatch error = new CountDownLatch(1);
        StompSession davidSession = connect(client, david.token(), error);
        davidSession.subscribe("/topic/session/" + david.sessionId() + "/master", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
            }
        });
        boolean rejected = error.await(5, TimeUnit.SECONDS) || waitUntil(() -> !davidSession.isConnected(), 3000);
        assertTrue(rejected, "Un jugador no puede suscribirse al topic del máster");
    }

    // ---------------------------------------------------------------- contenido

    @Test
    void secretMissionsAndPrivateFilesStayWithTheirOwner() throws Exception {
        String anaMe = call("GET", "/api/player/me", ana.token(), null).body();
        String davidMe = call("GET", "/api/player/me", david.token(), null).body();

        assertTrue(anaMe.contains("\"code\":\"ACCIDENT\""), anaMe);
        assertTrue(anaMe.contains("\"code\":\"FIND_NEXUS7\""), anaMe);
        assertFalse(anaMe.contains("\"code\":\"EVAC_SHIP\""), "una misión oculta nunca viaja al jugador");
        assertFalse(anaMe.contains("\"code\":\"CORP_ORDER\""), "el secreto del ingeniero no viaja a Ana");
        assertTrue(davidMe.contains("\"code\":\"CORP_ORDER\""), davidMe);

        assertTrue(davidMe.contains("\"code\":\"CORP_DIRECTIVE\""), davidMe);
        assertFalse(anaMe.contains("CORP_DIRECTIVE"), "el archivo privado de David no viaja a Ana");
        assertFalse(anaMe.contains("PATIENT_01"), "un archivo oculto no viaja al jugador");
        assertTrue(anaMe.contains("\"code\":\"STATION_NOTICE\""), anaMe);

        assertTrue(anaMe.contains("\"code\":\"HANGAR\",\"name\":\"Hangar de atraque\""), anaMe);
        assertTrue(anaMe.contains("\"code\":\"EVAC\",\"name\":null"), "los sectores desconocidos llegan sin nombre");
    }

    @Test
    void masterUnlocksPrivateFileAndOnlyItsOwnerCanOpenIt() throws Exception {
        String overview = call("GET", "/api/master/overview", master.token(), null).body();
        long fileId = idOf(overview, "code", "PATIENT_01");

        assertEquals(200, call("PATCH", "/api/master/files/" + fileId, master.token(), "{\"status\":\"UNLOCKED\"}").status());
        assertTrue(call("GET", "/api/player/me", ana.token(), null).body().contains("PATIENT_01"));

        Resp open = call("POST", "/api/player/files/" + fileId + "/open", ana.token(), null);
        assertEquals(200, open.status(), open.body());
        assertTrue(open.body().contains("HUMANO ESTABLE"), open.body());
        assertEquals(404, call("POST", "/api/player/files/" + fileId + "/open", david.token(), null).status());

        assertEquals(200, call("PATCH", "/api/master/files/" + fileId, master.token(), "{\"status\":\"HIDDEN\"}").status());
    }

    @Test
    void corruptedFileNeverSendsTheFullText() throws Exception {
        String overview = call("GET", "/api/master/overview", master.token(), null).body();
        long fileId = idOf(overview, "code", "SERVICE_RECORD");
        Resp carlos = call("POST", "/api/session/join", null, "{\"code\":\"SEG-0917\"}");
        String token = field(carlos.body(), "token");
        Resp open = call("POST", "/api/player/files/" + fileId + "/open", token, null);
        assertEquals(200, open.status(), open.body());
        assertTrue(open.body().contains("\"status\":\"CORRUPTED\""), open.body());
        assertTrue(open.body().contains("█"), "debe llegar parcialmente ilegible");
        assertFalse(open.body().contains("borrado de memoria selectivo autorizado"), "el texto completo no debe salir");
    }

    @Test
    void usingAConsumableItemDecrementsAndNotifiesMaster() throws Exception {
        String me = call("GET", "/api/player/me", david.token(), null).body();
        long kitId = idOf(me, "name", "Kit de reparaci");
        long torchId = idOf(me, "name", "Linterna");

        Resp used = call("POST", "/api/player/items/" + kitId + "/use", david.token(), null);
        assertEquals(200, used.status(), used.body());
        assertTrue(used.body().contains("\"quantity\":1"), used.body());
        assertEquals(409, call("POST", "/api/player/items/" + torchId + "/use", david.token(), null).status());

        String actions = call("GET", "/api/master/actions", master.token(), null).body();
        assertTrue(actions.contains("USE_ITEM"), actions);
    }

    @Test
    void masterUpdatesSectorAndStartsCountdown() throws Exception {
        Resp sector = call("PATCH", "/api/master/map/PUENTE", master.token(), "{\"status\":\"OPEN\",\"note\":\"Compuerta abierta\"}");
        assertEquals(200, sector.status(), sector.body());
        String me = call("GET", "/api/player/me", david.token(), null).body();
        assertTrue(me.contains("\"code\":\"PUENTE\",\"name\":\"Puente de mando\",\"status\":\"OPEN\""), me);

        Resp countdown = call("POST", "/api/master/countdown", master.token(), "{\"label\":\"DESACOPLE\",\"seconds\":180}");
        assertEquals(200, countdown.status(), countdown.body());
        assertTrue(countdown.body().contains("\"countdownLabel\":\"DESACOPLE\""), countdown.body());
        assertTrue(call("GET", "/api/player/me", ana.token(), null).body().contains("\"countdownLabel\":\"DESACOPLE\""));
        assertEquals(200, call("DELETE", "/api/master/countdown", master.token(), null).status());
    }

    @Test
    void masterChangesAccessCodesAndDefaultsAreFlagged() throws Exception {
        String overview = call("GET", "/api/master/overview", master.token(), null).body();
        assertTrue(overview.contains("\"accessCodes\""), overview);
        assertTrue(overview.contains("\"name\":\"Laura\",\"role\":\"PLAYER\",\"characterName\":\"Médica\",\"defaultCode\":true"), overview);
        String lauraId = Pattern.compile("\"playerId\":\"([^\"]+)\",\"name\":\"Laura\"").matcher(overview).results()
                .findFirst().orElseThrow().group(1);

        // código elegido por el máster
        Resp custom = call("POST", "/api/master/players/" + lauraId + "/code", master.token(), "{\"code\":\"med-test-99\"}");
        assertEquals(200, custom.status(), custom.body());
        assertTrue(custom.body().contains("\"code\":\"MED-TEST-99\""), custom.body());
        assertEquals(401, call("POST", "/api/session/join", null, "{\"code\":\"MED-2048\"}").status(), "el código viejo ya no vale");
        assertEquals(200, call("POST", "/api/session/join", null, "{\"code\":\"MEDTEST99\"}").status());
        assertTrue(call("GET", "/api/master/overview", master.token(), null).body()
                .contains("\"name\":\"Laura\",\"role\":\"PLAYER\",\"characterName\":\"Médica\",\"defaultCode\":false"));

        // repetido o demasiado corto: rechazado
        assertEquals(409, call("POST", "/api/master/players/" + lauraId + "/code", master.token(), "{\"code\":\"ING-7731\"}").status());
        assertEquals(409, call("POST", "/api/master/players/" + lauraId + "/code", master.token(), "{\"code\":\"ab\"}").status());

        // generado por el servidor
        Resp generated = call("POST", "/api/master/players/" + lauraId + "/code", master.token(), null);
        assertEquals(200, generated.status(), generated.body());
        String code = field(generated.body(), "code");
        assertTrue(code.matches("MED-[A-Z2-9]{4}"), code);
        assertEquals(200, call("POST", "/api/session/join", null, "{\"code\":\"" + code + "\"}").status());

        // un jugador no puede cambiar códigos
        assertEquals(403, call("POST", "/api/master/players/" + lauraId + "/code", david.token(), null).status());

        // dejar a Laura como estaba para el resto de pruebas
        assertEquals(200, call("POST", "/api/master/players/" + lauraId + "/code", master.token(), "{\"code\":\"MED-2048\"}").status());
    }

    // ---------------------------------------------------------------- helpers

    /** Id del elemento cuyo campo {@code field} empieza por {@code valuePrefix} (DTOs con id, playerId, campo...). */
    private static long idOf(String json, String field, String valuePrefix) {
        Matcher m = Pattern.compile("\"id\":(\\d+),\"playerId\":(?:null|\"[^\"]*\"),\"" + field + "\":\"" + Pattern.quote(valuePrefix))
                .matcher(json);
        assertTrue(m.find(), "No se encontró " + field + "=" + valuePrefix + " en " + json);
        return Long.parseLong(m.group(1));
    }

    private String base() {
        return "http://localhost:" + port;
    }

    private String wsUrl() {
        return "ws://localhost:" + port + "/ws";
    }

    private Joined join(String code) throws Exception {
        Resp r = call("POST", "/api/session/join", null, "{\"code\":\"" + code + "\"}");
        assertEquals(200, r.status(), r.body());
        return new Joined(field(r.body(), "token"), field(r.body(), "playerId"), field(r.body(), "sessionId"));
    }

    private Resp call(String method, String path, String token, String json) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base() + path))
                .header("Content-Type", "application/json");
        if (token != null) {
            b.header("Authorization", "Bearer " + token);
        }
        b.method(method, json == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json));
        HttpResponse<String> r = HTTP.send(b.build(), HttpResponse.BodyHandlers.ofString());
        return new Resp(r.statusCode(), r.body());
    }

    private static String field(String json, String name) {
        Matcher m = Pattern.compile("\"" + name + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        assertTrue(m.find(), "Falta el campo " + name + " en " + json);
        return m.group(1);
    }

    private WebSocketStompClient stompClient() {
        // Conversor por defecto (SimpleMessageConverter): entrega el cuerpo como byte[] sea cual sea el content-type
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setTaskScheduler(scheduler);
        return client;
    }

    private StompSession connect(WebSocketStompClient client, String token, CountDownLatch errors) throws Exception {
        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + token);
        return client.connectAsync(wsUrl(), new WebSocketHttpHeaders(), headers, new StompSessionHandlerAdapter() {
            @Override
            public void handleException(StompSession session, StompCommand command, StompHeaders h, byte[] payload, Throwable ex) {
                errors.countDown();
            }

            @Override
            public void handleTransportError(StompSession session, Throwable ex) {
                errors.countDown();
            }

            @Override
            public void handleFrame(StompHeaders h, Object payload) {
                errors.countDown(); // frames ERROR del servidor
            }
        }).get(5, TimeUnit.SECONDS);
    }

    private static void subscribe(StompSession session, String destination, BlockingQueue<String> inbox) {
        session.subscribe(destination, new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return byte[].class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                inbox.add(payload instanceof byte[] bytes ? new String(bytes, StandardCharsets.UTF_8) : String.valueOf(payload));
            }
        });
    }

    private static boolean waitUntil(BooleanSupplier condition, long timeoutMs) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            if (condition.getAsBoolean()) {
                return true;
            }
            Thread.sleep(50);
        }
        return condition.getAsBoolean();
    }
}
