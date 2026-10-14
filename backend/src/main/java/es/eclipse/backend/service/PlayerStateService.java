package es.eclipse.backend.service;

import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.PlayerState;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.repository.PlayerStateRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.BiometricsDto;
import es.eclipse.backend.web.dto.Dtos.PlayerStateDto;
import es.eclipse.backend.web.dto.Requests.UpdateStateRequest;
import es.eclipse.backend.web.error.NotFoundException;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Variables ocultas (salud, infección, privadas). El jugador solo recibe la lectura biométrica derivada. */
@Service
public class PlayerStateService {

    private final PlayerStateRepository states;
    private final PlayerRepository players;
    private final RealtimePublisher publisher;
    private final AuditService audit;

    public PlayerStateService(PlayerStateRepository states, PlayerRepository players, RealtimePublisher publisher, AuditService audit) {
        this.states = states;
        this.players = players;
        this.publisher = publisher;
        this.audit = audit;
    }

    @Transactional
    public PlayerState getOrCreate(UUID playerId) {
        return states.findById(playerId).orElseGet(() -> states.save(new PlayerState(playerId, 100, 0)));
    }

    @Transactional
    public BiometricsDto biometricsFor(UUID playerId) {
        return BiometricsDto.from(getOrCreate(playerId));
    }

    @Transactional
    public PlayerStateDto update(EclipsePrincipal master, UUID playerId, UpdateStateRequest req) {
        Player target = players.findByIdAndSessionIdAndRole(playerId, master.sessionId(), Role.PLAYER)
                .orElseThrow(() -> new NotFoundException("Jugador no encontrado"));
        PlayerState state = getOrCreate(playerId);
        state.update(req.health(), req.infection(), req.privateVars());

        PlayerStateDto dto = PlayerStateDto.from(state);
        publisher.toPlayerState(playerId, "BIOMETRICS", BiometricsDto.from(state));
        publisher.toMaster(master.sessionId(), "PLAYER_STATE", dto);
        audit.log(master.sessionId(), master.playerId(), master.name(), "STATE_UPDATE", target.getName(),
                "health=" + state.getHealth() + " infection=" + state.getInfection());
        return dto;
    }
}
