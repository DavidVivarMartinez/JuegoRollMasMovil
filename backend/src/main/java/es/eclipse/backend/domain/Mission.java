package es.eclipse.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Misión de la tripulación ({@code playerId == null}) o de un jugador concreto (oficial o secreta). */
@Entity
@Table(name = "mission")
public class Mission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "player_id")
    private UUID playerId;

    @Column(length = 40)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private MissionKind kind;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private MissionStatus status;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Mission() {}

    public Mission(UUID sessionId, UUID playerId, String code, MissionKind kind, String title, String description,
                   MissionStatus status, int sortOrder) {
        this.sessionId = sessionId;
        this.playerId = playerId;
        this.code = code;
        this.kind = kind;
        this.title = title;
        this.description = description;
        this.status = status;
        this.sortOrder = sortOrder;
        this.updatedAt = Instant.now();
    }

    public void update(String title, String description, MissionStatus status) {
        if (title != null && !title.isBlank()) this.title = title.trim();
        if (description != null) this.description = description;
        if (status != null) this.status = status;
        this.updatedAt = Instant.now();
    }

    public boolean isShared() { return playerId == null; }

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public UUID getPlayerId() { return playerId; }
    public String getCode() { return code; }
    public MissionKind getKind() { return kind; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public MissionStatus getStatus() { return status; }
    public int getSortOrder() { return sortOrder; }
    public Instant getUpdatedAt() { return updatedAt; }
}
