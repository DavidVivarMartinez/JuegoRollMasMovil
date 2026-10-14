package es.eclipse.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Variables ocultas del jugador. La infección NUNCA se envía al jugador; solo una lectura biométrica derivada. */
@Entity
@Table(name = "player_state")
public class PlayerState {

    @Id
    @Column(name = "player_id")
    private UUID playerId;

    @Column(nullable = false)
    private int health;

    @Column(nullable = false)
    private int infection;

    @Column(name = "private_vars", nullable = false, length = 4000)
    private String privateVars;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PlayerState() {}

    public PlayerState(UUID playerId, int health, int infection) {
        this.playerId = playerId;
        this.health = clamp(health);
        this.infection = clamp(infection);
        this.privateVars = "{}";
        this.updatedAt = Instant.now();
    }

    private static int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }

    public void update(Integer health, Integer infection, String privateVars) {
        if (health != null) {
            this.health = clamp(health);
        }
        if (infection != null) {
            this.infection = clamp(infection);
        }
        if (privateVars != null) {
            this.privateVars = privateVars;
        }
        this.updatedAt = Instant.now();
    }

    public UUID getPlayerId() { return playerId; }
    public int getHealth() { return health; }
    public int getInfection() { return infection; }
    public String getPrivateVars() { return privateVars; }
    public Instant getUpdatedAt() { return updatedAt; }
}
