package es.eclipse.backend.service;

import es.eclipse.backend.domain.Message;
import es.eclipse.backend.domain.MessageType;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.repository.MessageRepository;
import es.eclipse.backend.repository.PlayerRepository;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.web.dto.Dtos.MessageDto;
import es.eclipse.backend.web.dto.Requests.SendMessageRequest;
import es.eclipse.backend.web.error.NotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Mensajes del máster: privados (cola del destinatario) o globales (topic de la partida). Siempre se persisten. */
@Service
public class MessageService {

    private static final String DEFAULT_SENDER = "SISTEMA";

    private final MessageRepository messages;
    private final PlayerRepository players;
    private final RealtimePublisher publisher;
    private final AuditService audit;

    public MessageService(MessageRepository messages, PlayerRepository players, RealtimePublisher publisher, AuditService audit) {
        this.messages = messages;
        this.players = players;
        this.publisher = publisher;
        this.audit = audit;
    }

    @Transactional
    public MessageDto send(EclipsePrincipal master, SendMessageRequest req) {
        UUID sessionId = master.sessionId();
        Player recipient = null;
        if (req.recipientId() != null) {
            recipient = players.findByIdAndSessionIdAndRole(req.recipientId(), sessionId, Role.PLAYER)
                    .orElseThrow(() -> new NotFoundException("Destinatario no encontrado"));
        }
        String sender = (req.senderLabel() == null || req.senderLabel().isBlank()) ? DEFAULT_SENDER : req.senderLabel().trim();
        MessageType type = req.type() == null ? MessageType.TEXT : req.type();

        Message saved = messages.save(new Message(sessionId, recipient == null ? null : recipient.getId(),
                sender, req.text().trim(), type));
        MessageDto dto = MessageDto.from(saved);

        if (recipient == null) {
            publisher.toSession(sessionId, "MESSAGE", dto);
        } else {
            publisher.toPlayerMessages(recipient.getId(), "MESSAGE", dto);
        }
        publisher.toMaster(sessionId, "MESSAGE", dto);
        audit.log(sessionId, master.playerId(), master.name(), "SEND_MESSAGE",
                recipient == null ? "ALL" : recipient.getName(), dto.text());
        return dto;
    }

    /** Historial del jugador: globales de su partida + privados dirigidos a él. */
    @Transactional(readOnly = true)
    public List<MessageDto> forPlayer(EclipsePrincipal me) {
        return messages.findVisibleTo(me.sessionId(), me.playerId()).stream().map(MessageDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<MessageDto> forSession(UUID sessionId) {
        return messages.findBySessionIdOrderByCreatedAtAscIdAsc(sessionId).stream().map(MessageDto::from).toList();
    }

    /** Acuse de lectura de un mensaje privado propio. El máster lo ve en su panel. */
    @Transactional
    public MessageDto markRead(EclipsePrincipal me, long messageId) {
        Message message = messages.findByIdAndRecipientId(messageId, me.playerId())
                .orElseThrow(() -> new NotFoundException("Mensaje no encontrado"));
        message.markRead();
        MessageDto dto = MessageDto.from(message);
        publisher.toMaster(me.sessionId(), "MESSAGE_READ", dto);
        return dto;
    }
}
