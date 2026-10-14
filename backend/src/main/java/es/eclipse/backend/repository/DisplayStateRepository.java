package es.eclipse.backend.repository;

import es.eclipse.backend.domain.DisplayStateRecord;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DisplayStateRepository extends JpaRepository<DisplayStateRecord, UUID> {
}
