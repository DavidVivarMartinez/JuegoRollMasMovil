package es.eclipse.backend.repository;

import es.eclipse.backend.domain.Message;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, Long> {

    /** Mensajes globales de la sesión más los privados dirigidos al jugador. Nunca los privados de otros. */
    @Query("""
            select m from Message m
            where m.sessionId = :sessionId and (m.recipientId is null or m.recipientId = :playerId)
            order by m.createdAt asc, m.id asc
            """)
    List<Message> findVisibleTo(@Param("sessionId") UUID sessionId, @Param("playerId") UUID playerId);

    List<Message> findBySessionIdOrderByCreatedAtAscIdAsc(UUID sessionId);

    Optional<Message> findByIdAndRecipientId(Long id, UUID recipientId);
}
