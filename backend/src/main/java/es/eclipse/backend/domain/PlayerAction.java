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

/** Acción enviada por un jugador desde su terminal (respuesta, elección, uso de objeto...). */
@Entity
@Table(name = "player_action")
public class PlayerAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private GameModule module;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(length = 4000)
    private String payload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PlayerAction() {}

    public PlayerAction(UUID sessionId, UUID playerId, GameModule module, String type, String payload) {
        this.sessionId = sessionId;
        this.playerId = playerId;
        this.module = module;
        this.type = type;
        this.payload = payload;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public UUID getPlayerId() { return playerId; }
    public GameModule getModule() { return module; }
    public String getType() { return type; }
    public String getPayload() { return payload; }
    public Instant getCreatedAt() { return createdAt; }
}
