package es.eclipse.backend.repository;

import es.eclipse.backend.domain.Mission;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MissionRepository extends JpaRepository<Mission, Long> {

    List<Mission> findBySessionIdOrderBySortOrderAscIdAsc(UUID sessionId);

    Optional<Mission> findByIdAndSessionId(Long id, UUID sessionId);

    long countBySessionId(UUID sessionId);

    /** Misiones compartidas y propias del jugador, nunca las ocultas ni las de otros. */
    @Query("""
            select m from Mission m
            where m.sessionId = :sessionId and (m.playerId is null or m.playerId = :playerId)
              and m.status <> es.eclipse.backend.domain.MissionStatus.HIDDEN
            order by m.sortOrder asc, m.id asc
            """)
    List<Mission> findVisibleTo(@Param("sessionId") UUID sessionId, @Param("playerId") UUID playerId);
}
