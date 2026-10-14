package es.eclipse.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "game_session")
public class GameSession {

    @Id
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SessionStatus status;

    @Column(name = "started_at")
    private Instant startedAt;

    /** Cuenta atrás común a toda la partida (null = ninguna activa). */
    @Column(name = "countdown_label", length = 120)
    private String countdownLabel;

    @Column(name = "countdown_ends_at")
    private Instant countdownEndsAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected GameSession() {}

    public GameSession(UUID id, String name) {
        this.id = id;
        this.name = name;
        this.status = SessionStatus.LOBBY;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public SessionStatus getStatus() { return status; }
    public Instant getStartedAt() { return startedAt; }
    public String getCountdownLabel() { return countdownLabel; }
    public Instant getCountdownEndsAt() { return countdownEndsAt; }
    public Instant getCreatedAt() { return createdAt; }

    public void setStatus(SessionStatus status) {
        this.status = status;
        if (status == SessionStatus.RUNNING && startedAt == null) {
            startedAt = Instant.now();
        }
    }

    public void startCountdown(String label, Instant endsAt) {
        this.countdownLabel = label;
        this.countdownEndsAt = endsAt;
    }

    public void clearCountdown() {
        this.countdownLabel = null;
        this.countdownEndsAt = null;
    }
}
