package es.eclipse.backend.repository;

import es.eclipse.backend.domain.GameModule;
import es.eclipse.backend.domain.ModuleState;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModuleStateRepository extends JpaRepository<ModuleState, Long> {

    List<ModuleState> findByPlayerId(UUID playerId);

    List<ModuleState> findBySessionId(UUID sessionId);

    Optional<ModuleState> findByPlayerIdAndModule(UUID playerId, GameModule module);
}
