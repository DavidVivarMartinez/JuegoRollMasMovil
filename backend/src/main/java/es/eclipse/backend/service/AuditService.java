package es.eclipse.backend.service;

import es.eclipse.backend.domain.AuditLog;
import es.eclipse.backend.repository.AuditLogRepository;
import es.eclipse.backend.web.dto.Dtos.AuditEntryDto;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Registro de acciones administrativas y de acceso. */
@Service
public class AuditService {

    private final AuditLogRepository repository;

    public AuditService(AuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void log(UUID sessionId, UUID actorId, String actorLabel, String action, String target, String details) {
        repository.save(new AuditLog(sessionId, actorId, actorLabel, action, truncate(target, 200), truncate(details, 2000)));
    }

    @Transactional(readOnly = true)
    public List<AuditEntryDto> recent(UUID sessionId) {
        return repository.findTop100BySessionIdOrderByCreatedAtDesc(sessionId).stream().map(AuditEntryDto::from).toList();
    }

    static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max - 3) + "...";
    }
}
