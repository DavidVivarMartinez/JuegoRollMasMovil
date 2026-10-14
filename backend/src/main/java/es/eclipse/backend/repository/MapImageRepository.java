package es.eclipse.backend.repository;

import es.eclipse.backend.domain.MapImage;
import es.eclipse.backend.web.dto.MapImageDto;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MapImageRepository extends JpaRepository<MapImage, Long> {

    /** Solo metadatos: no carga los bytes de las imágenes. */
    @Query("""
            select new es.eclipse.backend.web.dto.MapImageDto(m.id, m.name, m.contentType, m.width, m.height, m.sizeBytes, m.createdAt)
            from MapImage m where m.sessionId = :sessionId order by m.createdAt asc, m.id asc
            """)
    List<MapImageDto> listInfo(@Param("sessionId") UUID sessionId);

    Optional<MapImage> findByIdAndSessionId(Long id, UUID sessionId);

    long countBySessionId(UUID sessionId);
}
