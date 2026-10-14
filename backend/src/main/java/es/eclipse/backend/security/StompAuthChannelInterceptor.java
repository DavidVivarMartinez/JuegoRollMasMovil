package es.eclipse.backend.security;

import es.eclipse.backend.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Autenticación y autorización del canal STOMP.
 * <p>CONNECT: valida el token (cabecera nativa {@code Authorization: Bearer ...}) y fija el usuario de la sesión.
 * SUBSCRIBE: solo permite colas propias y los topics de la propia partida (el del máster, solo al máster).
 * SEND: solo destinos {@code /app/**}.
 * Cualquier violación cierra la conexión con un frame ERROR.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompAuthChannelInterceptor.class);
    private static final String BEARER = "Bearer ";

    private final AuthService authService;

    public StompAuthChannelInterceptor(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        switch (accessor.getCommand()) {
            case CONNECT, STOMP -> {
                EclipsePrincipal principal = authService.authenticate(extractToken(accessor))
                        .orElseThrow(() -> new AccessDeniedException("TOKEN_INVALIDO"));
                accessor.setUser(principal.toAuthentication());
                log.debug("STOMP CONNECT de {} ({})", principal.name(), principal.role());
            }
            case SUBSCRIBE -> authorizeSubscription(requirePrincipal(accessor), accessor.getDestination());
            case SEND -> {
                requirePrincipal(accessor);
                String destination = accessor.getDestination();
                if (destination == null || !destination.startsWith("/app/")) {
                    throw new AccessDeniedException("DESTINO_NO_PERMITIDO");
                }
            }
            default -> {
                // CONNECTED, DISCONNECT, UNSUBSCRIBE, ACK...: sin restricciones
            }
        }
        return message;
    }

    private static String extractToken(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader("Authorization");
        if (header != null && header.startsWith(BEARER)) {
            return header.substring(BEARER.length());
        }
        return accessor.getFirstNativeHeader("token");
    }

    private static EclipsePrincipal requirePrincipal(StompHeaderAccessor accessor) {
        if (accessor.getUser() instanceof Authentication auth && auth.getPrincipal() instanceof EclipsePrincipal p) {
            return p;
        }
        throw new AccessDeniedException("NO_AUTENTICADO");
    }

    /** Visible para tests. */
    static void authorizeSubscription(EclipsePrincipal principal, String destination) {
        if (destination == null || destination.isBlank()) {
            throw new AccessDeniedException("DESTINO_VACIO");
        }
        // Las colas /user/queue/** las resuelve Spring contra el principal autenticado, nunca contra un id del cliente.
        if (destination.startsWith("/user/queue/")) {
            return;
        }
        String sessionTopic = "/topic/session/" + principal.sessionId();
        if (destination.equals(sessionTopic)) {
            return;
        }
        if (destination.equals(sessionTopic + "/master") && principal.isMaster()) {
            return;
        }
        throw new AccessDeniedException("SUSCRIPCION_NO_PERMITIDA");
    }
}
