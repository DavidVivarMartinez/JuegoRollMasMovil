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

/** Estado de un módulo del terminal para un jugador concreto. Si no hay fila, el módulo está visible y desbloqueado. */
@Entity
@Table(name = "module_state", uniqueConstraints = @UniqueConstraint(name = "uq_module_state", columnNames = {"player_id", "module"}))
public class ModuleState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private GameModule module;

    @Column(nullable = false)
    private boolean locked;

    @Column(nullable = false)
    private boolean visible;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ModuleState() {}

    public ModuleState(UUID sessionId, UUID playerId, GameModule module) {
        this.sessionId = sessionId;
        this.playerId = playerId;
        this.module = module;
        this.locked = false;
        this.visible = true;
        this.updatedAt = Instant.now();
    }

    public void update(Boolean locked, Boolean visible) {
        if (locked != null) {
            this.locked = locked;
        }
        if (visible != null) {
            this.visible = visible;
        }
        this.updatedAt = Instant.now();
    }

    public boolean isUsable() { return visible && !locked; }

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public UUID getPlayerId() { return playerId; }
    public GameModule getModule() { return module; }
    public boolean isLocked() { return locked; }
    public boolean isVisible() { return visible; }
    public Instant getUpdatedAt() { return updatedAt; }
}
