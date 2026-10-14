package es.eclipse.backend.seed;

import es.eclipse.backend.config.AppProperties;
import es.eclipse.backend.domain.GameModule;
import es.eclipse.backend.domain.GameSession;
import es.eclipse.backend.domain.ModuleState;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.PlayerState;
import es.eclipse.backend.repository.GameSessionRepository;
import es.eclipse.backend.repository.ModuleStateRepository;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.repository.PlayerStateRepository;
import es.eclipse.backend.security.TokenService;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Crea la partida configurada en {@code app.seed} si la base de datos está vacía y, en cualquier caso,
 * carga el contenido de game-content.yml en la partida si todavía no lo tiene.
 */
@Component
public class SeedDataRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedDataRunner.class);

    private final AppProperties props;
    private final GameSessionRepository sessions;
    private final PlayerRepository players;
    private final PlayerStateRepository states;
    private final ModuleStateRepository modules;
    private final TokenService tokens;
    private final ContentSeeder contentSeeder;

    public SeedDataRunner(AppProperties props, GameSessionRepository sessions, PlayerRepository players,
                          PlayerStateRepository states, ModuleStateRepository modules, TokenService tokens,
                          ContentSeeder contentSeeder) {
        this.props = props;
        this.sessions = sessions;
        this.players = players;
        this.states = states;
        this.modules = modules;
        this.tokens = tokens;
        this.contentSeeder = contentSeeder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        AppProperties.Seed seed = props.seed();
        if (!seed.enabled()) {
            return;
        }
        GameSession existing = sessions.findAll().stream().findFirst().orElse(null);
        if (existing != null) {
            log.info("Seed omitido: ya existe la partida '{}'", existing.getName());
            contentSeeder.seedIfEmpty(existing.getId());
            return;
        }
        if (seed.masterCode() == null || seed.masterCode().isBlank() || seed.players().isEmpty()) {
            log.warn("Seed activado pero sin master-code o sin jugadores: no se crea nada");
            return;
        }

        GameSession session = sessions.save(new GameSession(UUID.randomUUID(), seed.sessionName()));
        players.save(Player.master(session.getId(), seed.masterName(), hash(seed.masterCode())));

        StringBuilder codes = new StringBuilder();
        codes.append("\n==========================================================\n");
        codes.append("  PROTOCOLO: ECLIPSE — códigos de acceso (solo desarrollo)\n");
        codes.append("----------------------------------------------------------\n");
        codes.append(String.format("  %-28s %s%n", "MÁSTER", seed.masterCode()));
        for (AppProperties.SeedPlayer sp : seed.players()) {
            Player player = players.save(Player.player(session.getId(), sp.name(), sp.character(), sp.characterCode(), hash(sp.code())));
            states.save(new PlayerState(player.getId(), sp.health(), sp.infection()));
            for (GameModule module : GameModule.values()) {
                modules.save(new ModuleState(session.getId(), player.getId(), module));
            }
            codes.append(String.format("  %-28s %s%n", sp.name() + " (" + sp.character() + ")", sp.code()));
        }
        codes.append("==========================================================");

        log.info("Partida '{}' creada con {} jugadores", session.getName(), seed.players().size());
        contentSeeder.seedIfEmpty(session.getId());
        if (seed.printCodes()) {
            log.warn("{}", codes);
        }
    }

    private String hash(String code) {
        return tokens.sha256Hex(tokens.normalizeCode(code));
    }
}
