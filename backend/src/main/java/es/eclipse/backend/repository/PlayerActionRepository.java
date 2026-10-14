package es.eclipse.backend.repository;

import es.eclipse.backend.domain.PlayerAction;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerActionRepository extends JpaRepository<PlayerAction, Long> {

    List<PlayerAction> findTop100BySessionIdOrderByCreatedAtDesc(UUID sessionId);
}
