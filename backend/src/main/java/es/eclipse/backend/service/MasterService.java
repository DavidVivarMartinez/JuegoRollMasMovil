package es.eclipse.backend.service;

import es.eclipse.backend.domain.GameSession;
import es.eclipse.backend.domain.ModuleState;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.PlayerState;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.domain.SessionStatus;
import es.eclipse.backend.repository.GameSessionRepository;
import es.eclipse.backend.repository.ModuleStateRepository;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.repository.PlayerStateRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.OverviewDto;
import es.eclipse.backend.web.dto.Dtos.PlayerOverviewDto;
import es.eclipse.backend.web.dto.Dtos.PlayerStateDto;
import es.eclipse.backend.web.dto.Dtos.PlayerSummaryDto;
import es.eclipse.backend.web.dto.Dtos.SessionDto;
import es.eclipse.backend.web.error.NotFoundException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Vista completa de la partida para el panel del máster (incluye variables ocultas y todo el contenido). */
@Service
public class MasterService {

    private final GameSessionRepository sessions;
    private final PlayerRepository players;
    private final PlayerStateRepository states;
    private final ModuleStateRepository modules;
    private final PresenceService presence;
    private final RealtimePublisher publisher;
    private final AuditService audit;
    private final MissionService missions;
    private final InventoryService inventory;
    private final FileService files;
    private final MapService map;

    public MasterService(GameSessionRepository sessions, PlayerRepository players, PlayerStateRepository states,
                         ModuleStateRepository modules, PresenceService presence, RealtimePublisher publisher,
                         AuditService audit, MissionService missions, InventoryService inventory, FileService files,
                         MapService map) {
        this.sessions = sessions;
        this.players = players;
        this.states = states;
        this.modules = modules;
        this.presence = presence;
        this.publisher = publisher;
        this.audit = audit;
        this.missions = missions;
        this.inventory = inventory;
        this.files = files;
        this.map = map;
    }

    @Transactional(readOnly = true)
    public OverviewDto overview(EclipsePrincipal master) {
        UUID sessionId = master.sessionId();
        GameSession session = sessions.findById(sessionId).orElseThrow(() -> new NotFoundException("Sesión no encontrada"));
        List<Player> crew = players.findBySessionIdAndRoleOrderByCreatedAtAsc(sessionId, Role.PLAYER);
        List<UUID> ids = crew.stream().map(Player::getId).toList();

        Map<UUID, PlayerState> stateById = states.findByPlayerIdIn(ids).stream()
                .collect(Collectors.toMap(PlayerState::getPlayerId, Function.identity()));
        Map<UUID, List<ModuleState>> modulesById = modules.findBySessionId(sessionId).stream()
                .collect(Collectors.groupingBy(ModuleState::getPlayerId));
        Set<UUID> connected = presence.connectedPlayers(sessionId);

        List<PlayerOverviewDto> overview = crew.stream().map(p -> new PlayerOverviewDto(
                PlayerSummaryDto.from(p),
                connected.contains(p.getId()),
                stateById.containsKey(p.getId()) ? PlayerStateDto.from(stateById.get(p.getId())) : PlayerStateDto.defaults(p.getId()),
                ModuleService.merge(modulesById.getOrDefault(p.getId(), List.of())),
                p.getTokenIssuedAt())).toList();

        return new OverviewDto(SessionDto.from(session), overview, missions.forSession(sessionId),
                inventory.forSession(sessionId), files.forSession(sessionId), map.forSession(sessionId), Instant.now());
    }

    @Transactional
    public SessionDto setStatus(EclipsePrincipal master, SessionStatus status) {
        GameSession session = requireSession(master);
        session.setStatus(status);
        SessionDto dto = broadcast(session);
        audit.log(session.getId(), master.playerId(), master.name(), "SESSION_STATUS", session.getName(), status.name());
        return dto;
    }

    /** Cuenta atrás común: todos los terminales la muestran en cabecera. */
    @Transactional
    public SessionDto startCountdown(EclipsePrincipal master, String label, int seconds) {
        GameSession session = requireSession(master);
        String text = (label == null || label.isBlank()) ? "CUENTA ATRÁS" : label.trim();
        session.startCountdown(text, Instant.now().plus(Duration.ofSeconds(seconds)));
        SessionDto dto = broadcast(session);
        audit.log(session.getId(), master.playerId(), master.name(), "COUNTDOWN_START", text, seconds + "s");
        return dto;
    }

    @Transactional
    public SessionDto clearCountdown(EclipsePrincipal master) {
        GameSession session = requireSession(master);
        session.clearCountdown();
        SessionDto dto = broadcast(session);
        audit.log(session.getId(), master.playerId(), master.name(), "COUNTDOWN_CLEAR", session.getName(), null);
        return dto;
    }

    private GameSession requireSession(EclipsePrincipal master) {
        return sessions.findById(master.sessionId()).orElseThrow(() -> new NotFoundException("Sesión no encontrada"));
    }

    private SessionDto broadcast(GameSession session) {
        SessionDto dto = SessionDto.from(session);
        publisher.toSession(session.getId(), "SESSION", dto);
        publisher.toMaster(session.getId(), "SESSION", dto);
        return dto;
    }
}
