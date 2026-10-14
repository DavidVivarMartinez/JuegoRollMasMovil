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

/** Mensaje del máster. {@code recipientId == null} significa global (a toda la tripulación). */
@Entity
@Table(name = "message")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "recipient_id")
    private UUID recipientId;

    @Column(name = "sender_label", nullable = false, length = 80)
    private String senderLabel;

    @Column(nullable = false, length = 2000)
    private String text;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MessageType type;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    protected Message() {}

    public Message(UUID sessionId, UUID recipientId, String senderLabel, String text, MessageType type) {
        this.sessionId = sessionId;
        this.recipientId = recipientId;
        this.senderLabel = senderLabel;
        this.text = text;
        this.type = type;
        this.createdAt = Instant.now();
    }

    public void markRead() {
        if (readAt == null) {
            readAt = Instant.now();
        }
    }

    public boolean isGlobal() { return recipientId == null; }

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public UUID getRecipientId() { return recipientId; }
    public String getSenderLabel() { return senderLabel; }
    public String getText() { return text; }
    public MessageType getType() { return type; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }
}
