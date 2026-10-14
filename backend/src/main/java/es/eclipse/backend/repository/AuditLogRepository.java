package es.eclipse.backend.repository;

import es.eclipse.backend.domain.AuditLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findTop100BySessionIdOrderByCreatedAtDesc(UUID sessionId);
}
