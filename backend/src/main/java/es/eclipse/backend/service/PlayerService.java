package es.eclipse.backend.service;

import es.eclipse.backend.domain.GameSession;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.repository.GameSessionRepository;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.BiometricsDto;
import es.eclipse.backend.web.dto.Dtos.MeDto;
import es.eclipse.backend.web.dto.Dtos.PlayerSummaryDto;
import es.eclipse.backend.web.dto.Dtos.SessionDto;
import es.eclipse.backend.web.error.NotFoundException;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Vista del propio participante: todo lo que el terminal necesita para pintarse (y para resincronizar al reconectar). */
@Service
public class PlayerService {

    private final PlayerRepository players;
    private final GameSessionRepository sessions;
    private final ModuleService modules;
    private final PlayerStateService states;
    private final MissionService missions;
    private final InventoryService inventory;
    private final FileService files;
    private final MapService map;

    public PlayerService(PlayerRepository players, GameSessionRepository sessions, ModuleService modules,
                         PlayerStateService states, MissionService missions, InventoryService inventory,
                         FileService files, MapService map) {
        this.players = players;
        this.sessions = sessions;
        this.modules = modules;
        this.states = states;
        this.missions = missions;
        this.inventory = inventory;
        this.files = files;
        this.map = map;
    }

    @Transactional
    public MeDto me(EclipsePrincipal me) {
        Player player = players.findById(me.playerId()).orElseThrow(() -> new NotFoundException("Jugador no encontrado"));
        GameSession session = sessions.findById(player.getSessionId())
                .orElseThrow(() -> new NotFoundException("Sesión no encontrada"));
        boolean isPlayer = player.getRole() == Role.PLAYER;
        BiometricsDto biometrics = isPlayer ? states.biometricsFor(player.getId()) : null;
        return new MeDto(
                PlayerSummaryDto.from(player),
                SessionDto.from(session),
                modules.forPlayer(player.getId()),
                biometrics,
                isPlayer ? missions.forPlayer(session.getId(), player.getId()) : List.of(),
                isPlayer ? inventory.forPlayer(player.getId()) : List.of(),
                isPlayer ? files.forPlayer(session.getId(), player.getId()) : List.of(),
                map.forPlayer(session.getId()),
                Instant.now());
    }
}
