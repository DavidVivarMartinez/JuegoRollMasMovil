package es.eclipse.backend.service;

import es.eclipse.backend.domain.GameModule;
import es.eclipse.backend.domain.ModuleState;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.repository.ModuleStateRepository;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.ModuleStateDto;
import es.eclipse.backend.web.dto.Dtos.PlayerModulesDto;
import es.eclipse.backend.web.dto.Requests.UpdateModuleRequest;
import es.eclipse.backend.web.error.ModuleLockedException;
import es.eclipse.backend.web.error.NotFoundException;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Bloqueo y visibilidad de módulos por jugador. */
@Service
public class ModuleService {

    private final ModuleStateRepository modules;
    private final PlayerRepository players;
    private final RealtimePublisher publisher;
    private final AuditService audit;

    public ModuleService(ModuleStateRepository modules, PlayerRepository players, RealtimePublisher publisher, AuditService audit) {
        this.modules = modules;
        this.players = players;
        this.publisher = publisher;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<ModuleStateDto> forPlayer(UUID playerId) {
        return merge(modules.findByPlayerId(playerId));
    }

    /** Lista completa de módulos: los que no tienen fila se consideran visibles y desbloqueados. */
    public static List<ModuleStateDto> merge(List<ModuleState> rows) {
        Map<GameModule, ModuleStateDto> byModule = new EnumMap<>(GameModule.class);
        for (GameModule module : GameModule.values()) {
            byModule.put(module, ModuleStateDto.defaults(module));
        }
        for (ModuleState row : rows) {
            byModule.put(row.getModule(), ModuleStateDto.from(row));
        }
        return List.copyOf(byModule.values());
    }

    @Transactional
    public List<ModuleStateDto> update(EclipsePrincipal master, UUID playerId, GameModule module, UpdateModuleRequest req) {
        Player target = players.findByIdAndSessionIdAndRole(playerId, master.sessionId(), Role.PLAYER)
                .orElseThrow(() -> new NotFoundException("Jugador no encontrado"));
        ModuleState state = modules.findByPlayerIdAndModule(playerId, module)
                .orElseGet(() -> new ModuleState(target.getSessionId(), playerId, module));
        state.update(req.locked(), req.visible());
        modules.save(state);

        List<ModuleStateDto> all = merge(modules.findByPlayerId(playerId));
        publisher.toPlayerState(playerId, "MODULES", all);
        publisher.toMaster(master.sessionId(), "MODULES", new PlayerModulesDto(playerId, all));
        audit.log(master.sessionId(), master.playerId(), master.name(), "MODULE_UPDATE",
                target.getName() + "/" + module, "locked=" + state.isLocked() + " visible=" + state.isVisible());
        return all;
    }

    /** Lanza {@link ModuleLockedException} si el módulo está bloqueado u oculto para el jugador. */
    @Transactional(readOnly = true)
    public void assertUsable(UUID playerId, GameModule module) {
        modules.findByPlayerIdAndModule(playerId, module)
                .filter(state -> !state.isUsable())
                .ifPresent(state -> {
                    throw new ModuleLockedException(module);
                });
    }
}
