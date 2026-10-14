package es.eclipse.backend.repository;

import es.eclipse.backend.domain.PlayerState;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerStateRepository extends JpaRepository<PlayerState, UUID> {

    List<PlayerState> findByPlayerIdIn(Collection<UUID> playerIds);
}
