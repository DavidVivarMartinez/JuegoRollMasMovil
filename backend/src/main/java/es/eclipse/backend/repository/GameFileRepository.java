package es.eclipse.backend.repository;

import es.eclipse.backend.domain.GameFile;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GameFileRepository extends JpaRepository<GameFile, Long> {

    List<GameFile> findBySessionIdOrderBySortOrderAscIdAsc(UUID sessionId);

    Optional<GameFile> findByIdAndSessionId(Long id, UUID sessionId);

    long countBySessionId(UUID sessionId);

    /** Archivos compartidos y propios del jugador que no esten ocultos. */
    @Query("""
            select f from GameFile f
            where f.sessionId = :sessionId and (f.playerId is null or f.playerId = :playerId)
              and f.status <> es.eclipse.backend.domain.FileStatus.HIDDEN
            order by f.sortOrder asc, f.id asc
            """)
    List<GameFile> findVisibleTo(@Param("sessionId") UUID sessionId, @Param("playerId") UUID playerId);
}
