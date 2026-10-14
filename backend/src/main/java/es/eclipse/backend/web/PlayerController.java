package es.eclipse.backend.web;

import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.service.FileService;
import es.eclipse.backend.service.InventoryService;
import es.eclipse.backend.service.MessageService;
import es.eclipse.backend.service.MissionService;
import es.eclipse.backend.service.PlayerActionService;
import es.eclipse.backend.service.PlayerService;
import es.eclipse.backend.web.dto.Dtos.FileDto;
import es.eclipse.backend.web.dto.Dtos.ItemDto;
import es.eclipse.backend.web.dto.Dtos.MeDto;
import es.eclipse.backend.web.dto.Dtos.MessageDto;
import es.eclipse.backend.web.dto.Dtos.PlayerActionDto;
import es.eclipse.backend.web.dto.Requests.SubmitActionRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints del terminal del jugador. Todo se filtra por la identidad autenticada, nunca por ids del cliente. */
@RestController
@RequestMapping("/api/player")
public class PlayerController {

    private final PlayerService playerService;
    private final MessageService messageService;
    private final PlayerActionService actionService;
    private final MissionService missionService;
    private final InventoryService inventoryService;
    private final FileService fileService;

    public PlayerController(PlayerService playerService, MessageService messageService, PlayerActionService actionService,
                            MissionService missionService, InventoryService inventoryService, FileService fileService) {
        this.playerService = playerService;
        this.messageService = messageService;
        this.actionService = actionService;
        this.missionService = missionService;
        this.inventoryService = inventoryService;
        this.fileService = fileService;
    }

    /** Identidad, sesión, módulos permitidos, biometría y todo el contenido visible. Se llama al entrar y al reconectar. */
    @GetMapping("/me")
    public MeDto me(@AuthenticationPrincipal EclipsePrincipal me) {
        return playerService.me(me);
    }

    @GetMapping("/messages")
    public List<MessageDto> messages(@AuthenticationPrincipal EclipsePrincipal me) {
        return messageService.forPlayer(me);
    }

    @PostMapping("/messages/{id}/read")
    public MessageDto markRead(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id) {
        return messageService.markRead(me, id);
    }

    @PostMapping("/actions")
    @ResponseStatus(HttpStatus.CREATED)
    public PlayerActionDto act(@AuthenticationPrincipal EclipsePrincipal me, @Valid @RequestBody SubmitActionRequest request) {
        return actionService.submit(me, request);
    }

    /** Informar sobre una misión (el máster decide si la da por cumplida). */
    @PostMapping("/missions/{id}/report")
    @ResponseStatus(HttpStatus.CREATED)
    public PlayerActionDto reportMission(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id) {
        return missionService.report(me, id);
    }

    /** Usar un objeto del inventario. Devuelve el inventario actualizado. */
    @PostMapping("/items/{id}/use")
    public List<ItemDto> useItem(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id) {
        return inventoryService.use(me, id);
    }

    /** Abrir un archivo: devuelve el contenido (corrupto si procede) y avisa al máster. */
    @PostMapping("/files/{id}/open")
    public FileDto openFile(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id) {
        return fileService.open(me, id);
    }
}
