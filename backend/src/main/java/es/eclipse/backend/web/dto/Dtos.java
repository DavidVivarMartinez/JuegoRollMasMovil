package es.eclipse.backend.web.dto;

import es.eclipse.backend.domain.AuditLog;
import es.eclipse.backend.domain.FileClassification;
import es.eclipse.backend.domain.FileStatus;
import es.eclipse.backend.domain.GameFile;
import es.eclipse.backend.domain.GameModule;
import es.eclipse.backend.domain.GameSession;
import es.eclipse.backend.domain.InventoryItem;
import es.eclipse.backend.domain.MapSector;
import es.eclipse.backend.domain.Message;
import es.eclipse.backend.domain.MessageType;
import es.eclipse.backend.domain.Mission;
import es.eclipse.backend.domain.MissionKind;
import es.eclipse.backend.domain.MissionStatus;
import es.eclipse.backend.domain.ModuleState;
import es.eclipse.backend.domain.Player;
import es.eclipse.backend.domain.PlayerAction;
import es.eclipse.backend.domain.PlayerState;
import es.eclipse.backend.domain.Role;
import es.eclipse.backend.domain.SectorStatus;
import es.eclipse.backend.domain.SessionStatus;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/** Respuestas de la API. Lo que recibe un jugador pasa por aquí: nunca se serializan entidades directamente. */
public final class Dtos {

    private Dtos() {}

    public record JoinResponse(String token, Role role, UUID playerId, UUID sessionId, String name,
                               String characterName, String characterCode) {}

    public record SessionDto(UUID id, String name, SessionStatus status, Instant startedAt,
                             String countdownLabel, Instant countdownEndsAt) {
        public static SessionDto from(GameSession s) {
            return new SessionDto(s.getId(), s.getName(), s.getStatus(), s.getStartedAt(),
                    s.getCountdownLabel(), s.getCountdownEndsAt());
        }
    }

    public record PlayerSummaryDto(UUID id, String name, String characterName, String characterCode, Role role) {
        public static PlayerSummaryDto from(Player p) {
            return new PlayerSummaryDto(p.getId(), p.getName(), p.getCharacterName(), p.getCharacterCode(), p.getRole());
        }
    }

    public record ModuleStateDto(GameModule module, boolean locked, boolean visible) {
        public static ModuleStateDto from(ModuleState m) {
            return new ModuleStateDto(m.getModule(), m.isLocked(), m.isVisible());
        }

        public static ModuleStateDto defaults(GameModule module) {
            return new ModuleStateDto(module, false, true);
        }
    }

    /** Lectura biométrica que ve el jugador: derivada de la infección, sin revelar el porcentaje. */
    public record BiometricsDto(int health, String status, boolean anomaly) {
        public static BiometricsDto from(PlayerState s) {
            int infection = s.getInfection();
            String status;
            if (infection < 20) {
                status = "NOMINAL";
            } else if (infection < 45) {
                status = "ANOMALÍAS LEVES";
            } else if (infection < 75) {
                status = "ANOMALÍA GENÉTICA DETECTADA";
            } else {
                status = "ERROR DE LECTURA // REINTENTAR";
            }
            return new BiometricsDto(s.getHealth(), status, infection >= 20);
        }
    }

    public record MissionDto(Long id, UUID playerId, String code, MissionKind kind, String title, String description,
                             MissionStatus status, Instant updatedAt) {
        public static MissionDto from(Mission m) {
            return new MissionDto(m.getId(), m.getPlayerId(), m.getCode(), m.getKind(), m.getTitle(), m.getDescription(),
                    m.getStatus(), m.getUpdatedAt());
        }
    }

    public record ItemDto(Long id, UUID playerId, String name, String description, int quantity, boolean usable,
                          boolean consumable) {
        public static ItemDto from(InventoryItem i) {
            return new ItemDto(i.getId(), i.getPlayerId(), i.getName(), i.getDescription(), i.getQuantity(), i.isUsable(),
                    i.isConsumable());
        }
    }

    public record FileDto(Long id, UUID playerId, String code, String title, FileClassification classification,
                          FileStatus status, String body, Instant updatedAt) {

        /** Vista del máster: texto íntegro. */
        public static FileDto forMaster(GameFile f) {
            return new FileDto(f.getId(), f.getPlayerId(), f.getCode(), f.getTitle(), f.getClassification(), f.getStatus(),
                    f.getBody(), f.getUpdatedAt());
        }

        /** Vista del jugador: los archivos corruptos llegan ya ilegibles en parte, nunca el texto completo. */
        public static FileDto forPlayer(GameFile f) {
            String body = switch (f.getStatus()) {
                case HIDDEN -> null;
                case UNLOCKED -> f.getBody();
                case CORRUPTED -> corrupt(f.getBody(), f.getId() == null ? 0 : f.getId());
            };
            return new FileDto(f.getId(), f.getPlayerId(), f.getCode(), f.getTitle(), f.getClassification(), f.getStatus(),
                    body, f.getUpdatedAt());
        }

        /** Sustituye palabras por bloques de forma determinista (misma salida en cada carga). */
        static String corrupt(String body, long seed) {
            if (body == null) {
                return null;
            }
            Random random = new Random(seed * 31 + 7);
            StringBuilder out = new StringBuilder(body.length());
            for (String token : body.split("(?<=\\s)|(?=\\s)")) {
                if (token.isBlank() || token.length() <= 2 || random.nextInt(100) >= 42) {
                    out.append(token);
                } else {
                    out.append("█".repeat(token.length()));
                }
            }
            return out.toString();
        }
    }

    public record SectorDto(Long id, String code, String name, SectorStatus status, String note, int x, int y,
                            List<String> links) {

        public static SectorDto forMaster(MapSector s) {
            return new SectorDto(s.getId(), s.getCode(), s.getName(), s.getStatus(), s.getNote(), s.getX(), s.getY(),
                    parseLinks(s.getLinks()));
        }

        /** Los sectores desconocidos llegan sin nombre ni nota. */
        public static SectorDto forPlayer(MapSector s) {
            boolean unknown = s.getStatus() == SectorStatus.UNKNOWN;
            return new SectorDto(s.getId(), s.getCode(), unknown ? null : s.getName(), s.getStatus(),
                    unknown ? null : s.getNote(), s.getX(), s.getY(), parseLinks(s.getLinks()));
        }

        private static List<String> parseLinks(String raw) {
            if (raw == null || raw.isBlank()) {
                return List.of();
            }
            return Arrays.stream(raw.split(",")).map(String::trim).filter(v -> !v.isEmpty()).toList();
        }
    }

    public record MeDto(PlayerSummaryDto player, SessionDto session, List<ModuleStateDto> modules,
                        BiometricsDto biometrics, List<MissionDto> missions, List<ItemDto> items, List<FileDto> files,
                        List<SectorDto> map, Instant serverTime) {}

    public record MessageDto(Long id, String scope, UUID recipientId, String senderLabel, String text,
                             MessageType type, Instant createdAt, Instant readAt) {
        public static MessageDto from(Message m) {
            return new MessageDto(m.getId(), m.isGlobal() ? "GLOBAL" : "PRIVATE", m.getRecipientId(),
                    m.getSenderLabel(), m.getText(), m.getType(), m.getCreatedAt(), m.getReadAt());
        }
    }

    /** Estado completo (con infección). Solo para el máster. */
    public record PlayerStateDto(UUID playerId, int health, int infection, String privateVars, Instant updatedAt) {
        public static PlayerStateDto from(PlayerState s) {
            return new PlayerStateDto(s.getPlayerId(), s.getHealth(), s.getInfection(), s.getPrivateVars(), s.getUpdatedAt());
        }

        public static PlayerStateDto defaults(UUID playerId) {
            return new PlayerStateDto(playerId, 100, 0, "{}", null);
        }
    }

    public record PlayerOverviewDto(PlayerSummaryDto player, boolean connected, PlayerStateDto state,
                                    List<ModuleStateDto> modules, Instant tokenIssuedAt) {}

    /** Vista completa del máster: jugadores más todo el contenido de la partida (las listas incluyen a quién pertenece). */
    public record OverviewDto(SessionDto session, List<PlayerOverviewDto> players, List<MissionDto> missions,
                              List<ItemDto> items, List<FileDto> files, List<SectorDto> map, Instant serverTime) {}

    public record PlayerModulesDto(UUID playerId, List<ModuleStateDto> modules) {}

    public record PresenceDto(Set<UUID> connected) {}

    public record PlayerActionDto(Long id, UUID playerId, GameModule module, String type, String payload, Instant createdAt) {
        public static PlayerActionDto from(PlayerAction a) {
            return new PlayerActionDto(a.getId(), a.getPlayerId(), a.getModule(), a.getType(), a.getPayload(), a.getCreatedAt());
        }
    }

    public record AuditEntryDto(Long id, UUID actorId, String actorLabel, String action, String target,
                                String details, Instant createdAt) {
        public static AuditEntryDto from(AuditLog a) {
            return new AuditEntryDto(a.getId(), a.getActorId(), a.getActorLabel(), a.getAction(), a.getTarget(),
                    a.getDetails(), a.getCreatedAt());
        }
    }
}
