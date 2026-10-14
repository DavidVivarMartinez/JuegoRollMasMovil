package es.eclipse.backend.service;

import es.eclipse.backend.domain.GameSession;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.repository.GameSessionRepository;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.security.TokenService;
import es.eclipse.backend.web.error.InvalidCodeException;
import es.eclipse.backend.web.error.NotFoundException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Entrada con código y resolución de tokens. Entrar de nuevo con el mismo código rota el token (revoca el anterior). */
@Service
public class AuthService {

    private final PlayerRepository players;
    private final GameSessionRepository sessions;
    private final TokenService tokens;
    private final AuditService audit;

    public AuthService(PlayerRepository players, GameSessionRepository sessions, TokenService tokens, AuditService audit) {
        this.players = players;
        this.sessions = sessions;
        this.tokens = tokens;
        this.audit = audit;
    }

    @Transactional
    public JoinResult join(String rawCode) {
        String code = tokens.normalizeCode(rawCode);
        if (code.isEmpty()) {
            throw new InvalidCodeException();
        }
        Player player = players.findByAccessCodeHash(tokens.sha256Hex(code)).orElseThrow(InvalidCodeException::new);
        GameSession session = sessions.findById(player.getSessionId())
                .orElseThrow(() -> new NotFoundException("Sesión no encontrada"));

        String token = tokens.newToken();
        player.issueToken(tokens.sha256Hex(token), Instant.now());
        audit.log(session.getId(), player.getId(), player.getName(), "JOIN", player.getRole().name(), null);
        return new JoinResult(token, player, session);
    }

    @Transactional(readOnly = true)
    public Optional<EclipsePrincipal> authenticate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        return players.findByTokenHash(tokens.sha256Hex(rawToken.trim())).map(AuthService::principalOf);
    }

    /** Cierra la sesión del propio participante. */
    @Transactional
    public void revoke(UUID playerId) {
        players.findById(playerId).ifPresent(Player::revokeToken);
    }

    /** El máster expulsa a un jugador de su partida: tendrá que volver a introducir el código. */
    @Transactional
    public void revokeBy(EclipsePrincipal master, UUID playerId) {
        Player player = players.findById(playerId)
                .filter(p -> p.getSessionId().equals(master.sessionId()))
                .orElseThrow(() -> new NotFoundException("Jugador no encontrado"));
        player.revokeToken();
        audit.log(master.sessionId(), master.playerId(), master.name(), "REVOKE_TOKEN", player.getName(), null);
    }

    public static EclipsePrincipal principalOf(Player p) {
        return new EclipsePrincipal(p.getId(), p.getSessionId(), p.getRole(), p.getName(), p.getCharacterName());
    }

    public record JoinResult(String token, Player player, GameSession session) {}
}
