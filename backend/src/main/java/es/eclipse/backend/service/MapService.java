package es.eclipse.backend.service;

import es.eclipse.backend.domain.MapSector;
import es.eclipse.backend.repository.MapSectorRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.SectorDto;
import es.eclipse.backend.web.dto.Requests.UpdateSectorRequest;
import es.eclipse.backend.web.error.NotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Mapa de la estación: estado de cada sector, común a toda la partida. */
@Service
public class MapService {

    private final MapSectorRepository sectors;
    private final RealtimePublisher publisher;
    private final AuditService audit;

    public MapService(MapSectorRepository sectors, RealtimePublisher publisher, AuditService audit) {
        this.sectors = sectors;
        this.publisher = publisher;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<SectorDto> forPlayer(UUID sessionId) {
        return sectors.findBySessionIdOrderBySortOrderAscIdAsc(sessionId).stream().map(SectorDto::forPlayer).toList();
    }

    @Transactional(readOnly = true)
    public List<SectorDto> forSession(UUID sessionId) {
        return sectors.findBySessionIdOrderBySortOrderAscIdAsc(sessionId).stream().map(SectorDto::forMaster).toList();
    }

    @Transactional
    public List<SectorDto> update(EclipsePrincipal master, String code, UpdateSectorRequest req) {
        UUID sessionId = master.sessionId();
        MapSector sector = sectors.findBySessionIdAndCode(sessionId, code)
                .orElseThrow(() -> new NotFoundException("Sector no encontrado"));
        sector.update(req.status(), req.note());
        publisher.toSession(sessionId, "MAP", forPlayer(sessionId));
        List<SectorDto> all = forSession(sessionId);
        publisher.toMaster(sessionId, "MAP", all);
        audit.log(sessionId, master.playerId(), master.name(), "MAP_UPDATE", sector.getName(), "status=" + sector.getStatus());
        return all;
    }
}
