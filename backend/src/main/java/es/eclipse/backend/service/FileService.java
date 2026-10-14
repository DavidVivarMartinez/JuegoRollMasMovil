package es.eclipse.backend.service;

import es.eclipse.backend.domain.FileClassification;
import es.eclipse.backend.domain.FileStatus;
import es.eclipse.backend.domain.GameFile;
import es.eclipse.backend.domain.GameModule;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.repository.GameFileRepository;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.FileDto;
import es.eclipse.backend.web.dto.Requests.FileRequest;
import es.eclipse.backend.web.dto.Requests.UpdateFileRequest;
import es.eclipse.backend.web.error.NotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Archivos restringidos. Los ocultos no se envían; los corruptos se envían ya ilegibles en parte. */
@Service
public class FileService {

    private final GameFileRepository files;
    private final PlayerRepository players;
    private final RealtimePublisher publisher;
    private final AuditService audit;
    private final PlayerActionService actions;

    public FileService(GameFileRepository files, PlayerRepository players, RealtimePublisher publisher,
                       AuditService audit, PlayerActionService actions) {
        this.files = files;
        this.players = players;
        this.publisher = publisher;
        this.audit = audit;
        this.actions = actions;
    }

    @Transactional(readOnly = true)
    public List<FileDto> forPlayer(UUID sessionId, UUID playerId) {
        return files.findVisibleTo(sessionId, playerId).stream().map(FileDto::forPlayer).toList();
    }

    @Transactional(readOnly = true)
    public List<FileDto> forSession(UUID sessionId) {
        return files.findBySessionIdOrderBySortOrderAscIdAsc(sessionId).stream().map(FileDto::forMaster).toList();
    }

    @Transactional
    public FileDto create(EclipsePrincipal master, FileRequest req) {
        UUID sessionId = master.sessionId();
        if (req.playerId() != null) {
            players.findByIdAndSessionIdAndRole(req.playerId(), sessionId, Role.PLAYER)
                    .orElseThrow(() -> new NotFoundException("Jugador no encontrado"));
        }
        FileClassification classification = req.classification() != null ? req.classification() : FileClassification.RESTRICTED;
        FileStatus status = req.status() != null ? req.status() : FileStatus.HIDDEN;
        int order = (int) files.countBySessionId(sessionId) + 1;
        GameFile saved = files.save(new GameFile(sessionId, req.playerId(), req.code(), req.title().trim(), classification,
                req.body(), status, order));
        publish(sessionId, saved.getPlayerId());
        audit.log(sessionId, master.playerId(), master.name(), "FILE_CREATE", saved.getTitle(), status.name());
        return FileDto.forMaster(saved);
    }

    @Transactional
    public FileDto update(EclipsePrincipal master, Long id, UpdateFileRequest req) {
        GameFile file = files.findByIdAndSessionId(id, master.sessionId())
                .orElseThrow(() -> new NotFoundException("Archivo no encontrado"));
        file.update(req.title(), req.classification(), req.body(), req.status());
        publish(master.sessionId(), file.getPlayerId());
        audit.log(master.sessionId(), master.playerId(), master.name(), "FILE_UPDATE", file.getTitle(),
                "status=" + file.getStatus());
        return FileDto.forMaster(file);
    }

    @Transactional
    public void delete(EclipsePrincipal master, Long id) {
        GameFile file = files.findByIdAndSessionId(id, master.sessionId())
                .orElseThrow(() -> new NotFoundException("Archivo no encontrado"));
        files.delete(file);
        publish(master.sessionId(), file.getPlayerId());
        audit.log(master.sessionId(), master.playerId(), master.name(), "FILE_DELETE", file.getTitle(), null);
    }

    /** El jugador abre un archivo visible para él: se devuelve su contenido y el máster se entera. */
    @Transactional
    public FileDto open(EclipsePrincipal me, Long id) {
        GameFile file = files.findVisibleTo(me.sessionId(), me.playerId()).stream()
                .filter(f -> f.getId().equals(id)).findFirst()
                .orElseThrow(() -> new NotFoundException("Archivo no encontrado"));
        actions.record(me, GameModule.FILES, "FILE_OPEN", file.getTitle());
        return FileDto.forPlayer(file);
    }

    private void publish(UUID sessionId, UUID playerId) {
        if (playerId == null) {
            for (Player p : players.findBySessionIdAndRoleOrderByCreatedAtAsc(sessionId, Role.PLAYER)) {
                publisher.toPlayerState(p.getId(), "FILES", forPlayer(sessionId, p.getId()));
            }
        } else {
            publisher.toPlayerState(playerId, "FILES", forPlayer(sessionId, playerId));
        }
        publisher.toMaster(sessionId, "FILES", forSession(sessionId));
    }
}
