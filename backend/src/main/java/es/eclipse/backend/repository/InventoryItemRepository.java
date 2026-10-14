package es.eclipse.backend.repository;

import es.eclipse.backend.domain.InventoryItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {

    List<InventoryItem> findBySessionIdOrderByIdAsc(UUID sessionId);

    List<InventoryItem> findByPlayerIdOrderByIdAsc(UUID playerId);

    Optional<InventoryItem> findByIdAndSessionId(Long id, UUID sessionId);

    Optional<InventoryItem> findByIdAndPlayerId(Long id, UUID playerId);
}
