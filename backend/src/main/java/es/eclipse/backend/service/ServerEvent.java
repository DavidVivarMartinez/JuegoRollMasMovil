package es.eclipse.backend.service;

import java.time.Instant;

/** Sobre de todos los eventos enviados por WebSocket: {@code type} indica cómo interpretar {@code payload}. */
public record ServerEvent(String type, Object payload, Instant ts) {

    public static ServerEvent of(String type, Object payload) {
        return new ServerEvent(type, payload, Instant.now());
    }
}
