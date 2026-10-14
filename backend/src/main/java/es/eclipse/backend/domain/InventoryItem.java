package es.eclipse.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Objeto del inventario de un jugador. Si es consumible, usarlo descuenta una unidad. */
@Entity
@Table(name = "inventory_item")
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false)
    private boolean usable;

    @Column(nullable = false)
    private boolean consumable;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected InventoryItem() {}

    public InventoryItem(UUID sessionId, UUID playerId, String name, String description, int quantity,
                         boolean usable, boolean consumable) {
        this.sessionId = sessionId;
        this.playerId = playerId;
        this.name = name;
        this.description = description;
        this.quantity = Math.max(0, quantity);
        this.usable = usable;
        this.consumable = consumable;
        this.updatedAt = Instant.now();
    }

    public void update(String name, String description, Integer quantity, Boolean usable, Boolean consumable, UUID playerId) {
        if (name != null && !name.isBlank()) this.name = name.trim();
        if (description != null) this.description = description;
        if (quantity != null) this.quantity = Math.max(0, quantity);
        if (usable != null) this.usable = usable;
        if (consumable != null) this.consumable = consumable;
        if (playerId != null) this.playerId = playerId;
        this.updatedAt = Instant.now();
    }

    /** Descuenta una unidad si el objeto es consumible. Devuelve true si se descontó. */
    public boolean consumeOne() {
        if (!consumable || quantity <= 0) {
            return false;
        }
        quantity--;
        updatedAt = Instant.now();
        return true;
    }

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public UUID getPlayerId() { return playerId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public int getQuantity() { return quantity; }
    public boolean isUsable() { return usable; }
    public boolean isConsumable() { return consumable; }
    public Instant getUpdatedAt() { return updatedAt; }
}
