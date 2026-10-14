package es.eclipse.backend.repository;

import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.Role;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerRepository extends JpaRepository<Player, UUID> {

    Optional<Player> findByAccessCodeHash(String accessCodeHash);

    Optional<Player> findByTokenHash(String tokenHash);

    Optional<Player> findByIdAndSessionIdAndRole(UUID id, UUID sessionId, Role role);

    List<Player> findBySessionIdAndRoleOrderByCreatedAtAsc(UUID sessionId, Role role);
}
