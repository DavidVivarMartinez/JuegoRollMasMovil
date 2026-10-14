package es.eclipse.backend.security;

import es.eclipse.backend.domain.Role;
import java.util.List;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticatedPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/** Identidad autenticada en servidor. {@link #getName()} devuelve el id del jugador (clave de las colas /user). */
public record EclipsePrincipal(UUID playerId, UUID sessionId, Role role, String name, String characterName)
        implements AuthenticatedPrincipal {

    @Override
    public String getName() {
        return playerId.toString();
    }

    public boolean isMaster() {
        return role == Role.MASTER;
    }

    public Authentication toAuthentication() {
        return UsernamePasswordAuthenticationToken.authenticated(
                this, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
    }
}
