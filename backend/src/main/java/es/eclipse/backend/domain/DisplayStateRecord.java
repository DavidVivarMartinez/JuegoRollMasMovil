package es.eclipse.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Estado de la pantalla de mesa guardado como JSON (ver DisplayService para el formato). */
@Entity
@Table(name = "display_state")
public class DisplayStateRecord {

    @Id
    @Column(name = "session_id")
    private UUID sessionId;

    @Column(name = "state_json", nullable = false, length = 200000)
    private String stateJson;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected DisplayStateRecord() {}

    public DisplayStateRecord(UUID sessionId, String stateJson) {
        this.sessionId = sessionId;
        this.stateJson = stateJson;
        this.updatedAt = Instant.now();
    }

    public void update(String stateJson) {
        this.stateJson = stateJson;
        this.updatedAt = Instant.now();
    }

    public UUID getSessionId() { return sessionId; }
    public String getStateJson() { return stateJson; }
    public Instant getUpdatedAt() { return updatedAt; }
}
