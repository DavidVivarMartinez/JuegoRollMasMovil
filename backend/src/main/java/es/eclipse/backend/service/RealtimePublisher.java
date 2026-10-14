package es.eclipse.backend.service;

import java.util.UUID;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Único punto de salida hacia STOMP. Si hay una transacción activa, el envío se pospone hasta después del commit,
 * de modo que un cliente que recargue al recibir el evento ya encuentre el dato persistido.
 */
@Component
public class RealtimePublisher {

    private final SimpMessagingTemplate template;

    public RealtimePublisher(SimpMessagingTemplate template) {
        this.template = template;
    }

    public static String sessionTopic(UUID sessionId) {
        return "/topic/session/" + sessionId;
    }

    public static String masterTopic(UUID sessionId) {
        return sessionTopic(sessionId) + "/master";
    }

    /** Cola privada de mensajes del jugador ({@code /user/queue/messages}). */
    public void toPlayerMessages(UUID playerId, String type, Object payload) {
        afterCommit(() -> template.convertAndSendToUser(playerId.toString(), "/queue/messages", ServerEvent.of(type, payload)));
    }

    /** Cola privada de estado del jugador ({@code /user/queue/state}). */
    public void toPlayerState(UUID playerId, String type, Object payload) {
        afterCommit(() -> template.convertAndSendToUser(playerId.toString(), "/queue/state", ServerEvent.of(type, payload)));
    }

    /** Topic global de la partida: lo reciben los cuatro jugadores y el máster. */
    public void toSession(UUID sessionId, String type, Object payload) {
        afterCommit(() -> template.convertAndSend(sessionTopic(sessionId), ServerEvent.of(type, payload)));
    }

    /** Topic exclusivo del máster. */
    public void toMaster(UUID sessionId, String type, Object payload) {
        afterCommit(() -> template.convertAndSend(masterTopic(sessionId), ServerEvent.of(type, payload)));
    }

    public static String displayTopic(UUID sessionId) {
        return sessionTopic(sessionId) + "/display";
    }

    /** Topic de la pantalla de mesa (TV): lo leen la TV y el máster, nunca los jugadores. */
    public void toDisplay(UUID sessionId, String type, Object payload) {
        afterCommit(() -> template.convertAndSend(displayTopic(sessionId), ServerEvent.of(type, payload)));
    }

    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
