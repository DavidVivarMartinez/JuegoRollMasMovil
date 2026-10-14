package es.eclipse.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;

/** Sector del mapa de la estación. Estado compartido por toda la partida. */
@Entity
@Table(name = "map_sector", uniqueConstraints = @UniqueConstraint(name = "uq_map_sector", columnNames = {"session_id", "code"}))
public class MapSector {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(nullable = false, length = 30)
    private String code;

    @Column(nullable = false, length = 80)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private SectorStatus status;

    @Column(length = 500)
    private String note;

    @Column(nullable = false)
    private int x;

    @Column(nullable = false)
    private int y;

    /** Códigos de sectores conectados, separados por comas (para dibujar los corredores). */
    @Column(length = 200)
    private String links;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MapSector() {}

    public MapSector(UUID sessionId, String code, String name, SectorStatus status, String note, int x, int y,
                     String links, int sortOrder) {
        this.sessionId = sessionId;
        this.code = code;
        this.name = name;
        this.status = status;
        this.note = note;
        this.x = x;
        this.y = y;
        this.links = links;
        this.sortOrder = sortOrder;
        this.updatedAt = Instant.now();
    }

    public void update(SectorStatus status, String note) {
        if (status != null) this.status = status;
        if (note != null) this.note = note;
        this.updatedAt = Instant.now();
    }

    /** Solo la disposición en el plano (no toca estado ni nota): se sincroniza con game-content.yml al arrancar. */
    public void updateLayout(String name, int x, int y, String links) {
        if (name != null && !name.isBlank()) this.name = name;
        this.x = x;
        this.y = y;
        this.links = links;
    }

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public SectorStatus getStatus() { return status; }
    public String getNote() { return note; }
    public int getX() { return x; }
    public int getY() { return y; }
    public String getLinks() { return links; }
    public int getSortOrder() { return sortOrder; }
    public Instant getUpdatedAt() { return updatedAt; }
}
