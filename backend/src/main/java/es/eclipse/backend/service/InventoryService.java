package es.eclipse.backend.service;

import es.eclipse.backend.domain.GameModule;
import es.eclipse.backend.domain.InventoryItem;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.repository.InventoryItemRepository;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.ItemDto;
import es.eclipse.backend.web.dto.Requests.ItemRequest;
import es.eclipse.backend.web.dto.Requests.UpdateItemRequest;
import es.eclipse.backend.web.error.ActionRejectedException;
import es.eclipse.backend.web.error.NotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Inventario por jugador. Usar un objeto queda registrado para el máster; los consumibles se descuentan. */
@Service
public class InventoryService {

    private final InventoryItemRepository items;
    private final PlayerRepository players;
    private final RealtimePublisher publisher;
    private final AuditService audit;
    private final PlayerActionService actions;

    public InventoryService(InventoryItemRepository items, PlayerRepository players, RealtimePublisher publisher,
                            AuditService audit, PlayerActionService actions) {
        this.items = items;
        this.players = players;
        this.publisher = publisher;
        this.audit = audit;
        this.actions = actions;
    }

    @Transactional(readOnly = true)
    public List<ItemDto> forPlayer(UUID playerId) {
        return items.findByPlayerIdOrderByIdAsc(playerId).stream().map(ItemDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ItemDto> forSession(UUID sessionId) {
        return items.findBySessionIdOrderByIdAsc(sessionId).stream().map(ItemDto::from).toList();
    }

    @Transactional
    public ItemDto create(EclipsePrincipal master, ItemRequest req) {
        UUID sessionId = master.sessionId();
        requirePlayer(sessionId, req.playerId());
        InventoryItem saved = items.save(new InventoryItem(sessionId, req.playerId(), req.name().trim(), req.description(),
                req.quantity() == null ? 1 : req.quantity(),
                req.usable() == null || req.usable(),
                req.consumable() != null && req.consumable()));
        publish(sessionId, req.playerId());
        audit.log(sessionId, master.playerId(), master.name(), "ITEM_GIVE", saved.getName(), "x" + saved.getQuantity());
        return ItemDto.from(saved);
    }

    @Transactional
    public ItemDto update(EclipsePrincipal master, Long id, UpdateItemRequest req) {
        UUID sessionId = master.sessionId();
        InventoryItem item = items.findByIdAndSessionId(id, sessionId)
                .orElseThrow(() -> new NotFoundException("Objeto no encontrado"));
        UUID previousOwner = item.getPlayerId();
        if (req.playerId() != null) {
            requirePlayer(sessionId, req.playerId());
        }
        item.update(req.name(), req.description(), req.quantity(), req.usable(), req.consumable(), req.playerId());
        publish(sessionId, previousOwner);
        if (!previousOwner.equals(item.getPlayerId())) {
            publish(sessionId, item.getPlayerId());
        }
        audit.log(sessionId, master.playerId(), master.name(), "ITEM_UPDATE", item.getName(),
                "x" + item.getQuantity() + (previousOwner.equals(item.getPlayerId()) ? "" : " transferido"));
        return ItemDto.from(item);
    }

    @Transactional
    public void delete(EclipsePrincipal master, Long id) {
        InventoryItem item = items.findByIdAndSessionId(id, master.sessionId())
                .orElseThrow(() -> new NotFoundException("Objeto no encontrado"));
        items.delete(item);
        publish(master.sessionId(), item.getPlayerId());
        audit.log(master.sessionId(), master.playerId(), master.name(), "ITEM_REMOVE", item.getName(), null);
    }

    /** El jugador usa un objeto propio: queda registrado, y si es consumible se descuenta (y desaparece al llegar a 0). */
    @Transactional
    public List<ItemDto> use(EclipsePrincipal me, Long id) {
        InventoryItem item = items.findByIdAndPlayerId(id, me.playerId())
                .orElseThrow(() -> new NotFoundException("Objeto no encontrado"));
        if (!item.isUsable()) {
            throw new ActionRejectedException("Este objeto no se puede usar");
        }
        if (item.isConsumable() && item.getQuantity() <= 0) {
            throw new ActionRejectedException("No te quedan unidades");
        }
        // comprueba que el módulo INVENTARIO no esté bloqueado y avisa al máster
        actions.record(me, GameModule.INVENTORY, "USE_ITEM", item.getName());
        if (item.consumeOne() && item.getQuantity() == 0) {
            items.delete(item);
        }
        List<ItemDto> mine = forPlayer(me.playerId());
        publisher.toPlayerState(me.playerId(), "ITEMS", mine);
        publisher.toMaster(me.sessionId(), "ITEMS", forSession(me.sessionId()));
        return mine;
    }

    private void requirePlayer(UUID sessionId, UUID playerId) {
        players.findByIdAndSessionIdAndRole(playerId, sessionId, Role.PLAYER)
                .orElseThrow(() -> new NotFoundException("Jugador no encontrado"));
    }

    private void publish(UUID sessionId, UUID playerId) {
        publisher.toPlayerState(playerId, "ITEMS", forPlayer(playerId));
        publisher.toMaster(sessionId, "ITEMS", forSession(sessionId));
    }
}
