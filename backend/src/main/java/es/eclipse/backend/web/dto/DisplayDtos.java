package es.eclipse.backend.web.dto;

import es.eclipse.backend.web.dto.Dtos.SectorDto;
import es.eclipse.backend.web.dto.Dtos.SessionDto;
import java.util.List;
import java.util.Map;

/**
 * Pantalla de mesa (TV). El máster envía el estado completo y el servidor lo valida, lo guarda y lo reenvía a la TV.
 * Coordenadas de fichas en [0,1] relativas a la escena; la niebla es una rejilla cols×rows de '0' (oculto) y '1' (visible).
 */
public final class DisplayDtos {

    private DisplayDtos() {}

    /**
     * @param rev           identificador del cambio (lo pone el cliente para reconocer sus propios ecos)
     * @param scene         "NONE", "STATION" o "MAP:&lt;id&gt;"
     * @param scenes        estado de cada escena visitada (fichas y niebla), por clave de escena
     * @param overlay       efecto a pantalla completa
     * @param glitch        interferencia visual sobre el mapa
     * @param showCountdown mostrar la cuenta atrás común en grande
     */
    public record DisplayState(String rev, String scene, Map<String, SceneState> scenes, Overlay overlay,
                               boolean glitch, boolean showCountdown) {}

    public record SceneState(List<Token> tokens, Fog fog) {}

    /** {@code playerId} enlaza la ficha con un jugador; nulo para PNJ, infectados, objetos... */
    public record Token(String id, String label, String color, double x, double y, boolean visible, String playerId) {}

    public record Fog(boolean enabled, int cols, int rows, String revealed) {}

    /** type: NONE · BLACKOUT (pantalla negra) · ALERT (alerta roja) · MESSAGE (texto a pantalla completa) */
    public record Overlay(String type, String title, String text) {}

    /** Todo lo que necesita la TV (o el control de mesa del máster) para pintarse al entrar o al reconectar. */
    public record DisplayBootstrap(SessionDto session, DisplayState state, List<MapImageDto> maps, List<SectorDto> sectors) {}
}
