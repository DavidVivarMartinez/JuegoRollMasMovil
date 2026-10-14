package es.eclipse.backend.web;

import es.eclipse.backend.domain.GameModule;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.service.AuditService;
import es.eclipse.backend.service.AuthService;
import es.eclipse.backend.service.FileService;
import es.eclipse.backend.service.InventoryService;
import es.eclipse.backend.service.MapService;
import es.eclipse.backend.service.MasterService;
import es.eclipse.backend.service.MessageService;
import es.eclipse.backend.service.MissionService;
import es.eclipse.backend.service.ModuleService;
import es.eclipse.backend.service.PlayerActionService;
import es.eclipse.backend.service.PlayerStateService;
import es.eclipse.backend.web.dto.Dtos.AuditEntryDto;
import es.eclipse.backend.web.dto.Dtos.CodeChangedDto;
import es.eclipse.backend.web.dto.Dtos.FileDto;
import es.eclipse.backend.web.dto.Dtos.ItemDto;
import es.eclipse.backend.web.dto.Dtos.MessageDto;
import es.eclipse.backend.web.dto.Dtos.MissionDto;
import es.eclipse.backend.web.dto.Dtos.ModuleStateDto;
import es.eclipse.backend.web.dto.Dtos.OverviewDto;
import es.eclipse.backend.web.dto.Dtos.PlayerActionDto;
import es.eclipse.backend.web.dto.Dtos.PlayerStateDto;
import es.eclipse.backend.web.dto.Dtos.SectorDto;
import es.eclipse.backend.web.dto.Dtos.SessionDto;
import es.eclipse.backend.web.dto.Requests.ChangeCodeRequest;
import es.eclipse.backend.web.dto.Requests.CountdownRequest;
import es.eclipse.backend.web.dto.Requests.FileRequest;
import es.eclipse.backend.web.dto.Requests.ItemRequest;
import es.eclipse.backend.web.dto.Requests.MissionRequest;
import es.eclipse.backend.web.dto.Requests.SendMessageRequest;
import es.eclipse.backend.web.dto.Requests.UpdateFileRequest;
import es.eclipse.backend.web.dto.Requests.UpdateItemRequest;
import es.eclipse.backend.web.dto.Requests.UpdateMissionRequest;
import es.eclipse.backend.web.dto.Requests.UpdateModuleRequest;
import es.eclipse.backend.web.dto.Requests.UpdateSectorRequest;
import es.eclipse.backend.web.dto.Requests.UpdateSessionRequest;
import es.eclipse.backend.web.dto.Requests.UpdateStateRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Panel del máster. Protegido por URL (SecurityConfig) y por método. */
@RestController
@RequestMapping("/api/master")
@PreAuthorize("hasRole('MASTER')")
public class MasterController {

    private final MasterService masterService;
    private final MessageService messageService;
    private final ModuleService moduleService;
    private final PlayerStateService stateService;
    private final PlayerActionService actionService;
    private final AuditService auditService;
    private final AuthService authService;
    private final MissionService missionService;
    private final InventoryService inventoryService;
    private final FileService fileService;
    private final MapService mapService;

    public MasterController(MasterService masterService, MessageService messageService, ModuleService moduleService,
                            PlayerStateService stateService, PlayerActionService actionService,
                            AuditService auditService, AuthService authService, MissionService missionService,
                            InventoryService inventoryService, FileService fileService, MapService mapService) {
        this.masterService = masterService;
        this.messageService = messageService;
        this.moduleService = moduleService;
        this.stateService = stateService;
        this.actionService = actionService;
        this.auditService = auditService;
        this.authService = authService;
        this.missionService = missionService;
        this.inventoryService = inventoryService;
        this.fileService = fileService;
        this.mapService = mapService;
    }

    // ---- partida

    @GetMapping("/overview")
    public OverviewDto overview(@AuthenticationPrincipal EclipsePrincipal me) {
        return masterService.overview(me);
    }

    @PatchMapping("/session")
    public SessionDto session(@AuthenticationPrincipal EclipsePrincipal me, @Valid @RequestBody UpdateSessionRequest request) {
        return masterService.setStatus(me, request.status());
    }

    @PostMapping("/countdown")
    public SessionDto startCountdown(@AuthenticationPrincipal EclipsePrincipal me, @Valid @RequestBody CountdownRequest request) {
        return masterService.startCountdown(me, request.label(), request.seconds());
    }

    @DeleteMapping("/countdown")
    public SessionDto clearCountdown(@AuthenticationPrincipal EclipsePrincipal me) {
        return masterService.clearCountdown(me);
    }

    // ---- mensajes

    @GetMapping("/messages")
    public List<MessageDto> messages(@AuthenticationPrincipal EclipsePrincipal me) {
        return messageService.forSession(me.sessionId());
    }

    @PostMapping("/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageDto send(@AuthenticationPrincipal EclipsePrincipal me, @Valid @RequestBody SendMessageRequest request) {
        return messageService.send(me, request);
    }

    // ---- jugadores

    @PatchMapping("/players/{playerId}/modules/{module}")
    public List<ModuleStateDto> module(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable UUID playerId,
                                       @PathVariable GameModule module, @RequestBody UpdateModuleRequest request) {
        return moduleService.update(me, playerId, module, request);
    }

    @PatchMapping("/players/{playerId}/state")
    public PlayerStateDto state(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable UUID playerId,
                                @Valid @RequestBody UpdateStateRequest request) {
        return stateService.update(me, playerId, request);
    }

    /** Expulsa el dispositivo del jugador: deberá volver a introducir su código. */
    @PostMapping("/players/{playerId}/revoke")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable UUID playerId) {
        authService.revokeBy(me, playerId);
    }

    /** Cambia el código de acceso de un participante (también el del propio máster). Sin código, genera uno. */
    @PostMapping("/players/{playerId}/code")
    public CodeChangedDto changeCode(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable UUID playerId,
                                     @Valid @RequestBody(required = false) ChangeCodeRequest request) {
        AuthService.CodeChange change = authService.changeCode(me, playerId, request == null ? null : request.code());
        return new CodeChangedDto(change.playerId(), change.name(), change.code());
    }

    // ---- misiones

    @PostMapping("/missions")
    @ResponseStatus(HttpStatus.CREATED)
    public MissionDto createMission(@AuthenticationPrincipal EclipsePrincipal me, @Valid @RequestBody MissionRequest request) {
        return missionService.create(me, request);
    }

    @PatchMapping("/missions/{id}")
    public MissionDto updateMission(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id,
                                    @Valid @RequestBody UpdateMissionRequest request) {
        return missionService.update(me, id, request);
    }

    @DeleteMapping("/missions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMission(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id) {
        missionService.delete(me, id);
    }

    // ---- inventario

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public ItemDto createItem(@AuthenticationPrincipal EclipsePrincipal me, @Valid @RequestBody ItemRequest request) {
        return inventoryService.create(me, request);
    }

    @PatchMapping("/items/{id}")
    public ItemDto updateItem(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id,
                              @Valid @RequestBody UpdateItemRequest request) {
        return inventoryService.update(me, id, request);
    }

    @DeleteMapping("/items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id) {
        inventoryService.delete(me, id);
    }

    // ---- archivos

    @PostMapping("/files")
    @ResponseStatus(HttpStatus.CREATED)
    public FileDto createFile(@AuthenticationPrincipal EclipsePrincipal me, @Valid @RequestBody FileRequest request) {
        return fileService.create(me, request);
    }

    @PatchMapping("/files/{id}")
    public FileDto updateFile(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id,
                              @Valid @RequestBody UpdateFileRequest request) {
        return fileService.update(me, id, request);
    }

    @DeleteMapping("/files/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFile(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id) {
        fileService.delete(me, id);
    }

    // ---- mapa

    @PatchMapping("/map/{code}")
    public List<SectorDto> updateSector(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable String code,
                                        @Valid @RequestBody UpdateSectorRequest request) {
        return mapService.update(me, code, request);
    }

    // ---- historiales

    @GetMapping("/actions")
    public List<PlayerActionDto> actions(@AuthenticationPrincipal EclipsePrincipal me) {
        return actionService.recent(me.sessionId());
    }

    @GetMapping("/audit")
    public List<AuditEntryDto> audit(@AuthenticationPrincipal EclipsePrincipal me) {
        return auditService.recent(me.sessionId());
    }
}
