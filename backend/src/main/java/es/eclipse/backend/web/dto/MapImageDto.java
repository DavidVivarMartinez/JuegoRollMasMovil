package es.eclipse.backend.web.dto;

import java.time.Instant;

/** Metadatos de un mapa de la pantalla de mesa (sin la imagen). */
public record MapImageDto(Long id, String name, String contentType, int width, int height, int sizeBytes, Instant createdAt) {}
