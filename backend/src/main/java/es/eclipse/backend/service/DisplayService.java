package es.eclipse.backend.service;

import es.eclipse.backend.domain.DisplayStateRecord;
import es.eclipse.backend.domain.GameSession;
import es.eclipse.backend.domain.MapImage;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.repository.DisplayStateRepository;
import es.eclipse.backend.repository.GameSessionRepository;
import es.eclipse.backend.repository.MapImageRepository;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.DisplayDtos.DisplayBootstrap;
import es.eclipse.backend.web.dto.DisplayDtos.DisplayState;
import es.eclipse.backend.web.dto.DisplayDtos.Fog;
import es.eclipse.backend.web.dto.DisplayDtos.Overlay;
import es.eclipse.backend.web.dto.DisplayDtos.SceneState;
import es.eclipse.backend.web.dto.DisplayDtos.Token;
import es.eclipse.backend.web.dto.Dtos.SessionDto;
import es.eclipse.backend.web.dto.MapImageDto;
import es.eclipse.backend.web.error.ActionRejectedException;
import es.eclipse.backend.web.error.NotFoundException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Pantalla de mesa: estado (escena, fichas, niebla, efectos) y mapas subidos. Solo el máster escribe;
 * la TV y el propio máster leen. Todo lo que llega se acota y corrige antes de guardarse.
 */
@Service
public class DisplayService {

    public static final int MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    /** Los vídeos se guardan en la base de datos y se cargan enteros en memoria: el plan gratuito no da para más. */
    public static final int MAX_VIDEO_BYTES = 30 * 1024 * 1024;
    private static final Set<String> OVERLAYS = Set.of("NONE", "BLACKOUT", "ALERT", "MESSAGE");
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final Set<String> VIDEO_TYPES = Set.of("video/mp4", "video/webm");
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final int MAX_SCENES = 60;
    private static final int MAX_TOKENS = 40;

    private final DisplayStateRepository states;
    private final MapImageRepository maps;
    private final PlayerRepository players;
    private final GameSessionRepository sessions;
    private final MapService mapService;
    private final RealtimePublisher publisher;
    private final AuditService audit;
    private final JsonMapper json;

    public DisplayService(DisplayStateRepository states, MapImageRepository maps, PlayerRepository players,
                          GameSessionRepository sessions, MapService mapService, RealtimePublisher publisher,
                          AuditService audit, JsonMapper json) {
        this.states = states;
        this.maps = maps;
        this.players = players;
        this.sessions = sessions;
        this.mapService = mapService;
        this.publisher = publisher;
        this.audit = audit;
        this.json = json;
    }

    // ---------------------------------------------------------------- lectura

    @Transactional(readOnly = true)
    public DisplayBootstrap bootstrap(EclipsePrincipal me) {
        UUID sessionId = me.sessionId();
        GameSession session = sessions.findById(sessionId).orElseThrow(() -> new NotFoundException("Sesión no encontrada"));
        return new DisplayBootstrap(
                SessionDto.from(session),
                currentState(sessionId),
                maps.listInfo(sessionId),
                me.isMaster() ? mapService.forSession(sessionId) : mapService.forPlayer(sessionId));
    }

    @Transactional(readOnly = true)
    public DisplayState currentState(UUID sessionId) {
        Set<Long> mapIds = mapIds(sessionId);
        return states.findById(sessionId)
                .map(r -> sanitize(json.readValue(r.getStateJson(), DisplayState.class), mapIds))
                .orElseGet(() -> defaultState(sessionId));
    }

    @Transactional(readOnly = true)
    public MapImage image(UUID sessionId, Long id) {
        return maps.findByIdAndSessionId(id, sessionId).orElseThrow(() -> new NotFoundException("Mapa no encontrado"));
    }

    // ---------------------------------------------------------------- escritura (máster)

    @Transactional
    public DisplayState save(EclipsePrincipal master, DisplayState incoming) {
        UUID sessionId = master.sessionId();
        DisplayState clean = sanitize(incoming, mapIds(sessionId));
        String body = json.writeValueAsString(clean);
        states.findById(sessionId).ifPresentOrElse(r -> r.update(body), () -> states.save(new DisplayStateRecord(sessionId, body)));
        publisher.toDisplay(sessionId, "DISPLAY", clean);
        return clean;
    }

    @Transactional
    public MapImageDto upload(EclipsePrincipal master, String name, String contentType, int width, int height, byte[] data) {
        String type = contentType == null ? "" : contentType.split(";")[0].trim().toLowerCase();
        boolean video = VIDEO_TYPES.contains(type);
        if (!video && !IMAGE_TYPES.contains(type)) {
            throw new ActionRejectedException("Formato no admitido: imágenes JPG, PNG o WEBP; vídeos MP4 o WEBM");
        }
        if (data == null || data.length == 0) {
            throw new ActionRejectedException("El archivo está vacío");
        }
        if (data.length > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
            throw new ActionRejectedException(video ? "El vídeo supera 30 MB" : "La imagen supera 8 MB");
        }
        if (width < 16 || height < 16 || width > 10_000 || height > 10_000) {
            throw new ActionRejectedException("Dimensiones de imagen no válidas");
        }
        if (maps.countBySessionId(master.sessionId()) >= 40) {
            throw new ActionRejectedException("Máximo 40 mapas por partida: borra alguno");
        }
        String label = (name == null || name.isBlank()) ? "Mapa" : truncate(name.trim(), 80);
        MapImage saved = maps.save(new MapImage(master.sessionId(), label, type, width, height, data));
        publishMaps(master.sessionId());
        audit.log(master.sessionId(), master.playerId(), master.name(), "MAP_UPLOAD", label, (data.length / 1024) + " KB");
        return info(saved);
    }

    @Transactional
    public void deleteMap(EclipsePrincipal master, Long id) {
        UUID sessionId = master.sessionId();
        MapImage map = image(sessionId, id);
        maps.delete(map);
        maps.flush();
        // la escena de ese mapa desaparece; si estaba en pantalla, se vuelve al plano de la estación
        DisplayState current = currentState(sessionId);
        String key = "MAP:" + id;
        Map<String, SceneState> scenes = new LinkedHashMap<>(current.scenes());
        scenes.remove(key);
        String scene = key.equals(current.scene()) ? "STATION" : current.scene();
        save(master, new DisplayState(current.rev(), scene, scenes, current.overlay(), current.glitch(), current.showCountdown()));
        publishMaps(sessionId);
        audit.log(sessionId, master.playerId(), master.name(), "MAP_DELETE", map.getName(), null);
    }

    private void publishMaps(UUID sessionId) {
        publisher.toDisplay(sessionId, "MAPS", maps.listInfo(sessionId));
    }

    private static MapImageDto info(MapImage m) {
        return new MapImageDto(m.getId(), m.getName(), m.getContentType(), m.getWidth(), m.getHeight(), m.getSizeBytes(),
                m.getCreatedAt());
    }

    private Set<Long> mapIds(UUID sessionId) {
        return maps.listInfo(sessionId).stream().map(MapImageDto::id).collect(Collectors.toSet());
    }

    // ---------------------------------------------------------------- estado por defecto

    /** Plano de la estación con las fichas de los jugadores junto al hangar, sin niebla ni efectos. */
    DisplayState defaultState(UUID sessionId) {
        List<Player> crew = players.findBySessionIdAndRoleOrderByCreatedAtAsc(sessionId, Role.PLAYER);
        List<Token> tokens = new ArrayList<>();
        for (int i = 0; i < crew.size(); i++) {
            tokens.add(playerToken(crew.get(i), i));
        }
        Map<String, SceneState> scenes = new LinkedHashMap<>();
        scenes.put("STATION", new SceneState(tokens, new Fog(false, 12, 12, "0".repeat(144))));
        return new DisplayState("server", "STATION", scenes, new Overlay("NONE", null, null), false, true);
    }

    static Token playerToken(Player p, int index) {
        return new Token("p-" + p.getId(), p.getName(), colorFor(p.getCharacterCode()),
                0.05 + index * 0.065, 0.64, true, p.getId().toString());
    }

    static String colorFor(String characterCode) {
        if (characterCode == null) {
            return "#e0e0e0";
        }
        return switch (characterCode) {
            case "ENGINEER" -> "#ffb347";
            case "MEDIC" -> "#39ff8a";
            case "SECURITY" -> "#4d8bff";
            case "SCIENTIST" -> "#c77dff";
            default -> "#e0e0e0";
        };
    }

    // ---------------------------------------------------------------- validación

    /** Acota y corrige el estado: nunca rechaza, para que un fallo menor del cliente no deje la TV sin actualizar. */
    static DisplayState sanitize(DisplayState s, Set<Long> mapIds) {
        if (s == null) {
            return new DisplayState("server", "STATION", Map.of(), new Overlay("NONE", null, null), false, true);
        }
        Map<String, SceneState> scenes = new LinkedHashMap<>();
        if (s.scenes() != null) {
            for (Map.Entry<String, SceneState> e : s.scenes().entrySet()) {
                if (scenes.size() >= MAX_SCENES) {
                    break;
                }
                if (validScene(e.getKey(), mapIds) && !"NONE".equals(e.getKey())) {
                    scenes.put(e.getKey(), sanitizeScene(e.getValue()));
                }
            }
        }
        String scene = validScene(s.scene(), mapIds) ? s.scene() : "STATION";
        Overlay o = s.overlay();
        Overlay overlay = (o == null || o.type() == null || !OVERLAYS.contains(o.type()))
                ? new Overlay("NONE", null, null)
                : new Overlay(o.type(), truncate(o.title(), 120), truncate(o.text(), 1000));
        return new DisplayState(truncate(s.rev(), 60), scene, scenes, overlay, s.glitch(), s.showCountdown());
    }

    private static boolean validScene(String key, Set<Long> mapIds) {
        if (key == null) {
            return false;
        }
        if (key.equals("NONE") || key.equals("STATION")) {
            return true;
        }
        if (key.startsWith("MAP:")) {
            try {
                return mapIds.contains(Long.parseLong(key.substring(4)));
            } catch (NumberFormatException e) {
                return false;
            }
        }
        return false;
    }

    private static SceneState sanitizeScene(SceneState scene) {
        List<Token> tokens = new ArrayList<>();
        if (scene != null && scene.tokens() != null) {
            for (Token t : scene.tokens()) {
                if (t == null || t.id() == null || t.id().isBlank() || tokens.size() >= MAX_TOKENS) {
                    continue;
                }
                String color = t.color() != null && COLOR.matcher(t.color()).matches() ? t.color() : "#ff4d4d";
                tokens.add(new Token(truncate(t.id(), 40), truncate(t.label() == null ? "?" : t.label(), 24), color,
                        clamp01(t.x()), clamp01(t.y()), t.visible(), truncate(t.playerId(), 40)));
            }
        }
        Fog f = scene == null ? null : scene.fog();
        int cols = f == null ? 12 : Math.max(2, Math.min(40, f.cols()));
        int rows = f == null ? 12 : Math.max(1, Math.min(40, f.rows()));
        StringBuilder revealed = new StringBuilder(cols * rows);
        String raw = f == null || f.revealed() == null ? "" : f.revealed();
        for (int i = 0; i < cols * rows; i++) {
            revealed.append(i < raw.length() && raw.charAt(i) == '1' ? '1' : '0');
        }
        return new SceneState(tokens, new Fog(f != null && f.enabled(), cols, rows, revealed.toString()));
    }

    private static double clamp01(double v) {
        if (Double.isNaN(v)) {
            return 0.5;
        }
        return Math.max(0, Math.min(1, v));
    }

    private static String truncate(String v, int max) {
        if (v == null) {
            return null;
        }
        return v.length() <= max ? v : v.substring(0, max);
    }
}
