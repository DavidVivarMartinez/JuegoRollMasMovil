package es.eclipse.backend.service;

import es.eclipse.backend.domain.GameModule;
import es.eclipse.backend.domain.Mission;
import es.eclipse.backend.domain.MissionKind;
import es.eclipse.backend.domain.MissionStatus;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.repository.MissionRepository;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.MissionDto;
import es.eclipse.backend.web.dto.Dtos.PlayerActionDto;
import es.eclipse.backend.web.dto.Requests.MissionRequest;
import es.eclipse.backend.web.dto.Requests.UpdateMissionRequest;
import es.eclipse.backend.web.error.NotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Misiones compartidas, oficiales y secretas. Las secretas y las ocultas nunca salen hacia otro jugador. */
@Service
public class MissionService {

    private final MissionRepository missions;
    private final PlayerRepository players;
    private final RealtimePublisher publisher;
    private final AuditService audit;
    private final PlayerActionService actions;

    public MissionService(MissionRepository missions, PlayerRepository players, RealtimePublisher publisher,
                          AuditService audit, PlayerActionService actions) {
        this.missions = missions;
        this.players = players;
        this.publisher = publisher;
        this.audit = audit;
        this.actions = actions;
    }

    @Transactional(readOnly = true)
    public List<MissionDto> forPlayer(UUID sessionId, UUID playerId) {
        return missions.findVisibleTo(sessionId, playerId).stream().map(MissionDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<MissionDto> forSession(UUID sessionId) {
        return missions.findBySessionIdOrderBySortOrderAscIdAsc(sessionId).stream().map(MissionDto::from).toList();
    }

    @Transactional
    public MissionDto create(EclipsePrincipal master, MissionRequest req) {
        UUID sessionId = master.sessionId();
        UUID playerId = req.playerId();
        if (playerId != null) {
            players.findByIdAndSessionIdAndRole(playerId, sessionId, Role.PLAYER)
                    .orElseThrow(() -> new NotFoundException("Jugador no encontrado"));
        }
        MissionKind kind = req.kind() != null ? req.kind() : (playerId == null ? MissionKind.SHARED : MissionKind.OFFICIAL);
        MissionStatus status = req.status() != null ? req.status() : MissionStatus.ACTIVE;
        int order = (int) missions.countBySessionId(sessionId) + 1;
        Mission saved = missions.save(new Mission(sessionId, playerId, req.code(), kind, req.title().trim(),
                req.description(), status, order));
        publish(sessionId, playerId);
        audit.log(sessionId, master.playerId(), master.name(), "MISSION_CREATE", saved.getTitle(), status.name());
        return MissionDto.from(saved);
    }

    @Transactional
    public MissionDto update(EclipsePrincipal master, Long id, UpdateMissionRequest req) {
        Mission mission = missions.findByIdAndSessionId(id, master.sessionId())
                .orElseThrow(() -> new NotFoundException("Misión no encontrada"));
        mission.update(req.title(), req.description(), req.status());
        publish(master.sessionId(), mission.getPlayerId());
        audit.log(master.sessionId(), master.playerId(), master.name(), "MISSION_UPDATE", mission.getTitle(),
                "status=" + mission.getStatus());
        return MissionDto.from(mission);
    }

    @Transactional
    public void delete(EclipsePrincipal master, Long id) {
        Mission mission = missions.findByIdAndSessionId(id, master.sessionId())
                .orElseThrow(() -> new NotFoundException("Misión no encontrada"));
        missions.delete(mission);
        publish(master.sessionId(), mission.getPlayerId());
        audit.log(master.sessionId(), master.playerId(), master.name(), "MISSION_DELETE", mission.getTitle(), null);
    }

    /** El jugador informa sobre una misión visible para él (el máster decide si la da por cumplida). */
    @Transactional
    public PlayerActionDto report(EclipsePrincipal me, Long id) {
        Mission mission = missions.findVisibleTo(me.sessionId(), me.playerId()).stream()
                .filter(m -> m.getId().equals(id)).findFirst()
                .orElseThrow(() -> new NotFoundException("Misión no encontrada"));
        return actions.record(me, GameModule.MISSIONS, "MISSION_REPORT", mission.getTitle());
    }

    /** Reenvía la lista completa a los afectados (todos si la misión es compartida) y al máster. */
    private void publish(UUID sessionId, UUID playerId) {
        if (playerId == null) {
            for (Player p : players.findBySessionIdAndRoleOrderByCreatedAtAsc(sessionId, Role.PLAYER)) {
                publisher.toPlayerState(p.getId(), "MISSIONS", forPlayer(sessionId, p.getId()));
            }
        } else {
            publisher.toPlayerState(playerId, "MISSIONS", forPlayer(sessionId, playerId));
        }
        publisher.toMaster(sessionId, "MISSIONS", forSession(sessionId));
    }
}
