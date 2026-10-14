package es.eclipse.backend.seed;

import es.eclipse.backend.config.GameContentProperties;
import es.eclipse.backend.config.GameContentProperties.CharacterContent;
import es.eclipse.backend.config.GameContentProperties.FileContent;
import es.eclipse.backend.config.GameContentProperties.ItemContent;
import es.eclipse.backend.config.GameContentProperties.MissionContent;
import es.eclipse.backend.config.GameContentProperties.SectorContent;
import es.eclipse.backend.domain.GameFile;
import es.eclipse.backend.domain.InventoryItem;
import es.eclipse.backend.domain.MapSector;
import es.eclipse.backend.domain.Mission;
import es.eclipse.backend.domain.MissionKind;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.repository.GameFileRepository;
import es.eclipse.backend.repository.InventoryItemRepository;
import es.eclipse.backend.repository.MapSectorRepository;
import es.eclipse.backend.repository.MissionRepository;
import es.eclipse.backend.repository.PlayerRepository;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Carga el contenido de game-content.yml en una partida que todavía no tiene contenido
 * (misiones, archivos ni sectores). Así una base de datos creada antes también recibe el contenido.
 */
@Component
public class ContentSeeder {

    private static final Logger log = LoggerFactory.getLogger(ContentSeeder.class);

    private final GameContentProperties content;
    private final PlayerRepository players;
    private final MissionRepository missions;
    private final InventoryItemRepository items;
    private final GameFileRepository files;
    private final MapSectorRepository sectors;

    public ContentSeeder(GameContentProperties content, PlayerRepository players, MissionRepository missions,
                         InventoryItemRepository items, GameFileRepository files, MapSectorRepository sectors) {
        this.content = content;
        this.players = players;
        this.missions = missions;
        this.items = items;
        this.files = files;
        this.sectors = sectors;
    }

    @Transactional
    public void seedIfEmpty(UUID sessionId) {
        if (missions.countBySessionId(sessionId) > 0 || files.countBySessionId(sessionId) > 0
                || sectors.countBySessionId(sessionId) > 0) {
            syncLayout(sessionId);
            return;
        }
        List<Player> crew = players.findBySessionIdAndRoleOrderByCreatedAtAsc(sessionId, Role.PLAYER);
        int missionOrder = 0;
        int fileOrder = 0;
        int sectorOrder = 0;

        for (MissionContent m : content.sharedMissions()) {
            missions.save(new Mission(sessionId, null, m.code(), MissionKind.SHARED, m.title(), m.description(),
                    m.status(), ++missionOrder));
        }
        for (FileContent f : content.sharedFiles()) {
            files.save(new GameFile(sessionId, null, f.code(), f.title(), f.classification(), f.body(), f.status(), ++fileOrder));
        }
        for (SectorContent s : content.sectors()) {
            sectors.save(new MapSector(sessionId, s.code(), s.name(), s.status(), s.note(), s.x(), s.y(), s.links(), ++sectorOrder));
        }

        int characterHits = 0;
        for (Player p : crew) {
            CharacterContent c = p.getCharacterCode() == null ? null : content.characters().get(p.getCharacterCode());
            if (c == null) {
                log.warn("Sin contenido para el personaje '{}' de {}", p.getCharacterCode(), p.getName());
                continue;
            }
            characterHits++;
            for (MissionContent m : c.missions()) {
                missions.save(new Mission(sessionId, p.getId(), m.code(), m.kind(), m.title(), m.description(),
                        m.status(), ++missionOrder));
            }
            for (ItemContent i : c.items()) {
                items.save(new InventoryItem(sessionId, p.getId(), i.name(), i.description(), i.quantity(), i.usable(), i.consumable()));
            }
            for (FileContent f : c.files()) {
                files.save(new GameFile(sessionId, p.getId(), f.code(), f.title(), f.classification(), f.body(), f.status(), ++fileOrder));
            }
        }
        log.info("Contenido cargado: {} misiones, {} archivos, {} sectores, {} personajes con contenido",
                missionOrder, fileOrder, sectorOrder, characterHits);
    }

    /** Alinea posición, nombre y enlaces de los sectores existentes con el YAML; crea los que falten. */
    private void syncLayout(UUID sessionId) {
        int order = (int) sectors.countBySessionId(sessionId);
        for (SectorContent s : content.sectors()) {
            MapSector existing = sectors.findBySessionIdAndCode(sessionId, s.code()).orElse(null);
            if (existing != null) {
                existing.updateLayout(s.name(), s.x(), s.y(), s.links());
            } else {
                sectors.save(new MapSector(sessionId, s.code(), s.name(), s.status(), s.note(), s.x(), s.y(), s.links(), ++order));
            }
        }
    }
}
