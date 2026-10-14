package es.eclipse.backend.config;

import es.eclipse.backend.domain.FileClassification;
import es.eclipse.backend.domain.FileStatus;
import es.eclipse.backend.domain.MissionKind;
import es.eclipse.backend.domain.MissionStatus;
import es.eclipse.backend.domain.SectorStatus;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Contenido inicial de la partida (prefijo {@code game}, fichero game-content.yml). */
@ConfigurationProperties(prefix = "game")
public record GameContentProperties(
        @DefaultValue List<MissionContent> sharedMissions,
        @DefaultValue List<FileContent> sharedFiles,
        @DefaultValue List<SectorContent> sectors,
        @DefaultValue Map<String, CharacterContent> characters) {

    /** Contenido de un personaje, indexado por {@code characterCode} (ENGINEER, MEDIC, SECURITY, SCIENTIST). */
    public record CharacterContent(
            @DefaultValue List<MissionContent> missions,
            @DefaultValue List<ItemContent> items,
            @DefaultValue List<FileContent> files) {}

    public record MissionContent(
            String code,
            @DefaultValue("OFFICIAL") MissionKind kind,
            String title,
            String description,
            @DefaultValue("ACTIVE") MissionStatus status) {}

    public record ItemContent(
            String name,
            String description,
            @DefaultValue("1") int quantity,
            @DefaultValue("true") boolean usable,
            @DefaultValue("false") boolean consumable) {}

    public record FileContent(
            String code,
            String title,
            @DefaultValue("RESTRICTED") FileClassification classification,
            String body,
            @DefaultValue("HIDDEN") FileStatus status) {}

    public record SectorContent(
            String code,
            String name,
            @DefaultValue("UNKNOWN") SectorStatus status,
            String note,
            @DefaultValue("0") int x,
            @DefaultValue("0") int y,
            String links) {}
}
