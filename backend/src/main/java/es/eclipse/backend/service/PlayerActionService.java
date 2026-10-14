package es.eclipse.backend.service;

import es.eclipse.backend.domain.GameModule;
import es.eclipse.backend.domain.PlayerAction;
import es.eclipse.backend.repository.PlayerActionRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.PlayerActionDto;
import es.eclipse.backend.web.dto.Requests.SubmitActionRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Acciones enviadas por jugadores. El backend es quien rechaza acciones sobre módulos bloqueados u ocultos. */
@Service
public class PlayerActionService {

    private final PlayerActionRepository actions;
    private final ModuleService modules;
    private final RealtimePublisher publisher;

    public PlayerActionService(PlayerActionRepository actions, ModuleService modules, RealtimePublisher publisher) {
        this.actions = actions;
        this.modules = modules;
        this.publisher = publisher;
    }

    @Transactional
    public PlayerActionDto submit(EclipsePrincipal me, SubmitActionRequest req) {
        return record(me, req.module(), req.type().trim(), req.payload());
    }

    /** Comprueba el módulo, guarda la acción y avisa al máster. Lo usan también misiones, inventario y archivos. */
    @Transactional
    public PlayerActionDto record(EclipsePrincipal me, GameModule module, String type, String payload) {
        if (module != null) {
            modules.assertUsable(me.playerId(), module);
        }
        PlayerAction saved = actions.save(new PlayerAction(me.sessionId(), me.playerId(), module, type, payload));
        PlayerActionDto dto = PlayerActionDto.from(saved);
        publisher.toMaster(me.sessionId(), "PLAYER_ACTION", dto);
        return dto;
    }

    @Transactional(readOnly = true)
    public List<PlayerActionDto> recent(UUID sessionId) {
        return actions.findTop100BySessionIdOrderByCreatedAtDesc(sessionId).stream().map(PlayerActionDto::from).toList();
    }
}
