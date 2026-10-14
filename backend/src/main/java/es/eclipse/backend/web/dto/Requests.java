package es.eclipse.backend.web.dto;

import es.eclipse.backend.domain.FileClassification;
import es.eclipse.backend.domain.FileStatus;
import es.eclipse.backend.domain.GameModule;
import es.eclipse.backend.domain.MessageType;
import es.eclipse.backend.domain.MissionKind;
import es.eclipse.backend.domain.MissionStatus;
import es.eclipse.backend.domain.SectorStatus;
import es.eclipse.backend.domain.SessionStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** Cuerpos de petición validados. */
public final class Requests {

    private Requests() {}

    public record JoinRequest(@NotBlank @Size(max = 40) String code) {}

    /** {@code recipientId} nulo = mensaje global a toda la tripulación. */
    public record SendMessageRequest(UUID recipientId,
                                     @Size(max = 80) String senderLabel,
                                     @NotBlank @Size(max = 2000) String text,
                                     MessageType type) {}

    public record UpdateModuleRequest(Boolean locked, Boolean visible) {}

    public record UpdateStateRequest(@Min(0) @Max(100) Integer health,
                                     @Min(0) @Max(100) Integer infection,
                                     @Size(max = 4000) String privateVars) {}

    public record UpdateSessionRequest(@NotNull SessionStatus status) {}

    public record SubmitActionRequest(GameModule module,
                                      @NotBlank @Size(max = 40) String type,
                                      @Size(max = 4000) String payload) {}

    // ---- contenido

    /** {@code playerId} nulo = misión de toda la tripulación. */
    public record MissionRequest(UUID playerId,
                                 @Size(max = 40) String code,
                                 MissionKind kind,
                                 @NotBlank @Size(max = 120) String title,
                                 @Size(max = 2000) String description,
                                 MissionStatus status) {}

    public record UpdateMissionRequest(@Size(max = 120) String title,
                                       @Size(max = 2000) String description,
                                       MissionStatus status) {}

    public record ItemRequest(@NotNull UUID playerId,
                              @NotBlank @Size(max = 80) String name,
                              @Size(max = 500) String description,
                              @Min(0) @Max(999) Integer quantity,
                              Boolean usable,
                              Boolean consumable) {}

    /** {@code playerId} permite transferir el objeto a otro jugador. */
    public record UpdateItemRequest(@Size(max = 80) String name,
                                    @Size(max = 500) String description,
                                    @Min(0) @Max(999) Integer quantity,
                                    Boolean usable,
                                    Boolean consumable,
                                    UUID playerId) {}

    /** {@code playerId} nulo = archivo de toda la tripulación. */
    public record FileRequest(UUID playerId,
                              @Size(max = 40) String code,
                              @NotBlank @Size(max = 120) String title,
                              FileClassification classification,
                              @Size(max = 8000) String body,
                              FileStatus status) {}

    public record UpdateFileRequest(@Size(max = 120) String title,
                                    FileClassification classification,
                                    @Size(max = 8000) String body,
                                    FileStatus status) {}

    public record UpdateSectorRequest(SectorStatus status, @Size(max = 500) String note) {}

    public record CountdownRequest(@Size(max = 120) String label, @Min(1) @Max(86_400) int seconds) {}

    /** Código vacío o nulo = generar uno aleatorio. */
    public record ChangeCodeRequest(@Size(max = 40) String code) {}
}
