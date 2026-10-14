package es.eclipse.backend.service;

import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.PresenceDto;
import java.security.Principal;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/** Quién tiene el terminal conectado ahora mismo (por WebSocket). Se publica al máster en cada cambio. */
@Component
public class PresenceService {

    /** sessionId -> playerId -> ids de conexiones WebSocket abiertas (un jugador puede tener varias pestañas). */
    private final Map<UUID, Map<UUID, Set<String>>> connections = new ConcurrentHashMap<>();
    private final RealtimePublisher publisher;

    public PresenceService(RealtimePublisher publisher) {
        this.publisher = publisher;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        principalOf(event.getUser()).ifPresent(p -> {
            String wsSessionId = SimpMessageHeaderAccessor.getSessionId(event.getMessage().getHeaders());
            playersOf(p.sessionId()).computeIfAbsent(p.playerId(), k -> ConcurrentHashMap.newKeySet()).add(wsSessionId);
            broadcast(p.sessionId());
        });
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        principalOf(event.getUser()).ifPresent(p -> {
            Map<UUID, Set<String>> players = playersOf(p.sessionId());
            Set<String> open = players.get(p.playerId());
            if (open != null) {
                open.remove(event.getSessionId());
                if (open.isEmpty()) {
                    players.remove(p.playerId());
                }
            }
            broadcast(p.sessionId());
        });
    }

    public Set<UUID> connectedPlayers(UUID sessionId) {
        return Set.copyOf(playersOf(sessionId).keySet());
    }

    private Map<UUID, Set<String>> playersOf(UUID sessionId) {
        return connections.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>());
    }

    private void broadcast(UUID sessionId) {
        publisher.toMaster(sessionId, "PRESENCE", new PresenceDto(connectedPlayers(sessionId)));
    }

    private static Optional<EclipsePrincipal> principalOf(Principal user) {
        if (user instanceof Authentication auth && auth.getPrincipal() instanceof EclipsePrincipal p) {
            return Optional.of(p);
        }
        return Optional.empty();
    }
}
