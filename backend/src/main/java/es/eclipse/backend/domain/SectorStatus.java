package es.eclipse.backend.domain;

/** Estado de un sector del mapa. UNKNOWN oculta el nombre al jugador. */
public enum SectorStatus { UNKNOWN, OPEN, LOCKED, QUARANTINE, DANGER, DESTROYED }
