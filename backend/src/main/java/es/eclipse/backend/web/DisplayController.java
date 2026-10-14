package es.eclipse.backend.web;

import es.eclipse.backend.domain.MapImage;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.service.DisplayService;
import es.eclipse.backend.web.dto.DisplayDtos.DisplayBootstrap;
import es.eclipse.backend.web.dto.DisplayDtos.DisplayState;
import es.eclipse.backend.web.dto.MapImageDto;
import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Pantalla de mesa (TV). Lectura: TV y máster. Escritura: solo máster. */
@RestController
public class DisplayController {

    private final DisplayService display;

    public DisplayController(DisplayService display) {
        this.display = display;
    }

    // ---- lectura (TV y máster)

    @GetMapping("/api/display/bootstrap")
    @PreAuthorize("hasAnyRole('MASTER','DISPLAY')")
    public DisplayBootstrap bootstrap(@AuthenticationPrincipal EclipsePrincipal me) {
        return display.bootstrap(me);
    }

    /** Las imágenes no cambian nunca (un mapa nuevo tiene otro id), así que se pueden cachear. */
    @GetMapping("/api/display/maps/{id}/image")
    @PreAuthorize("hasAnyRole('MASTER','DISPLAY')")
    public ResponseEntity<byte[]> image(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id) {
        MapImage map = display.image(me.sessionId(), id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(map.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePrivate())
                .body(map.getData());
    }

    // ---- escritura (máster)

    @PutMapping("/api/master/display")
    @PreAuthorize("hasRole('MASTER')")
    public DisplayState save(@AuthenticationPrincipal EclipsePrincipal me, @RequestBody DisplayState state) {
        return display.save(me, state);
    }

    /** Cuerpo = bytes de la imagen (ya redimensionada en el móvil). Ancho y alto los calcula el cliente. */
    @PostMapping(value = "/api/master/maps", consumes = {MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE, "image/webp"})
    @PreAuthorize("hasRole('MASTER')")
    @ResponseStatus(HttpStatus.CREATED)
    public MapImageDto upload(@AuthenticationPrincipal EclipsePrincipal me,
                              @RequestParam(required = false) String name,
                              @RequestParam int width,
                              @RequestParam int height,
                              @RequestHeader("Content-Type") String contentType,
                              @RequestBody byte[] data) {
        return display.upload(me, name, contentType, width, height, data);
    }

    @DeleteMapping("/api/master/maps/{id}")
    @PreAuthorize("hasRole('MASTER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMap(@AuthenticationPrincipal EclipsePrincipal me, @PathVariable long id) {
        display.deleteMap(me, id);
    }
}
