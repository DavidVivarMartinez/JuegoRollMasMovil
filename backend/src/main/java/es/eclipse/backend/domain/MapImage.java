package es.eclipse.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Mapa subido por el máster para la pantalla de mesa. Los listados usan proyecciones para no cargar la imagen. */
@Entity
@Table(name = "map_image")
public class MapImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "content_type", nullable = false, length = 40)
    private String contentType;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(nullable = false)
    private byte[] data;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected MapImage() {}

    public MapImage(UUID sessionId, String name, String contentType, int width, int height, byte[] data) {
        this.sessionId = sessionId;
        this.name = name;
        this.contentType = contentType;
        this.width = width;
        this.height = height;
        this.sizeBytes = data.length;
        this.data = data;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public String getName() { return name; }
    public String getContentType() { return contentType; }
    public int getWidth() { return width; }
    public int getHeight() { return height; }
    public int getSizeBytes() { return sizeBytes; }
    public byte[] getData() { return data; }
    public Instant getCreatedAt() { return createdAt; }
}
