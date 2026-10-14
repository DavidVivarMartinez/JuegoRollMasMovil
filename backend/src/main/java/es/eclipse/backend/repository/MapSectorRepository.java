package es.eclipse.backend.repository;

import es.eclipse.backend.domain.MapSector;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MapSectorRepository extends JpaRepository<MapSector, Long> {

    List<MapSector> findBySessionIdOrderBySortOrderAscIdAsc(UUID sessionId);

    Optional<MapSector> findBySessionIdAndCode(UUID sessionId, String code);

    long countBySessionId(UUID sessionId);
}
