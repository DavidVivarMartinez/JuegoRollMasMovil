package es.eclipse.backend.repository;

import es.eclipse.backend.domain.GameSession;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameSessionRepository extends JpaRepository<GameSession, UUID> {
}
