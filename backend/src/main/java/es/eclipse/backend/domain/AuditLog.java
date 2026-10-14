package es.eclipse.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_log")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_label", nullable = false, length = 80)
    private String actorLabel;

    @Column(nullable = false, length = 60)
    private String action;

    @Column(length = 200)
    private String target;

    @Column(length = 2000)
    private String details;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AuditLog() {}

    public AuditLog(UUID sessionId, UUID actorId, String actorLabel, String action, String target, String details) {
        this.sessionId = sessionId;
        this.actorId = actorId;
        this.actorLabel = actorLabel;
        this.action = action;
        this.target = target;
        this.details = details;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public UUID getActorId() { return actorId; }
    public String getActorLabel() { return actorLabel; }
    public String getAction() { return action; }
    public String getTarget() { return target; }
    public String getDetails() { return details; }
    public Instant getCreatedAt() { return createdAt; }
}
