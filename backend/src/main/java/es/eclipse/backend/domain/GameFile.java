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

/** Archivo restringido: de toda la tripulación ({@code playerId == null}) o privado de un jugador. */
@Entity
@Table(name = "game_file")
public class GameFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "player_id")
    private UUID playerId;

    @Column(length = 40)
    private String code;

    @Column(nullable = false, length = 120)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private FileClassification classification;

    @Column(length = 8000)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private FileStatus status;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected GameFile() {}

    public GameFile(UUID sessionId, UUID playerId, String code, String title, FileClassification classification,
                    String body, FileStatus status, int sortOrder) {
        this.sessionId = sessionId;
        this.playerId = playerId;
        this.code = code;
        this.title = title;
        this.classification = classification;
        this.body = body;
        this.status = status;
        this.sortOrder = sortOrder;
        this.updatedAt = Instant.now();
    }

    public void update(String title, FileClassification classification, String body, FileStatus status) {
        if (title != null && !title.isBlank()) this.title = title.trim();
        if (classification != null) this.classification = classification;
        if (body != null) this.body = body;
        if (status != null) this.status = status;
        this.updatedAt = Instant.now();
    }

    public boolean isShared() { return playerId == null; }

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public UUID getPlayerId() { return playerId; }
    public String getCode() { return code; }
    public String getTitle() { return title; }
    public FileClassification getClassification() { return classification; }
    public String getBody() { return body; }
    public FileStatus getStatus() { return status; }
    public int getSortOrder() { return sortOrder; }
    public Instant getUpdatedAt() { return updatedAt; }
}
