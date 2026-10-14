package es.eclipse.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Participante de la partida: el máster y cada jugador. Solo se guardan hashes del código y del token. */
@Entity
@Table(name = "player")
public class Player {

    @Id
    private UUID id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Role role;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "character_name", length = 80)
    private String characterName;

    @Column(name = "character_code", length = 30)
    private String characterCode;

    @Column(name = "access_code_hash", nullable = false, length = 64)
    private String accessCodeHash;

    @Column(name = "token_hash", length = 64)
    private String tokenHash;

    @Column(name = "token_issued_at")
    private Instant tokenIssuedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Player() {}

    private Player(UUID sessionId, Role role, String name, String characterName, String characterCode, String accessCodeHash) {
        this.id = UUID.randomUUID();
        this.sessionId = sessionId;
        this.role = role;
        this.name = name;
        this.characterName = characterName;
        this.characterCode = characterCode;
        this.accessCodeHash = accessCodeHash;
        this.createdAt = Instant.now();
    }

    public static Player master(UUID sessionId, String name, String accessCodeHash) {
        return new Player(sessionId, Role.MASTER, name, null, null, accessCodeHash);
    }

    public static Player player(UUID sessionId, String name, String characterName, String characterCode, String accessCodeHash) {
        return new Player(sessionId, Role.PLAYER, name, characterName, characterCode, accessCodeHash);
    }

    public void issueToken(String tokenHash, Instant at) {
        this.tokenHash = tokenHash;
        this.tokenIssuedAt = at;
    }

    public void revokeToken() {
        this.tokenHash = null;
        this.tokenIssuedAt = null;
    }

    public UUID getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public Role getRole() { return role; }
    public String getName() { return name; }
    public String getCharacterName() { return characterName; }
    public String getCharacterCode() { return characterCode; }
    public String getAccessCodeHash() { return accessCodeHash; }
    public String getTokenHash() { return tokenHash; }
    public Instant getTokenIssuedAt() { return tokenIssuedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
