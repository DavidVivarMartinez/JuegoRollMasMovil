package es.eclipse.backend.web;

import es.eclipse.backend.domain.Player;
import es.eclipse.backend.security.EclipsePrincipal;
import es.eclipse.backend.security.JoinRateLimiter;
import es.eclipse.backend.service.AuthService;
import es.eclipse.backend.web.dto.Dtos.JoinResponse;
import es.eclipse.backend.web.dto.Requests.JoinRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/session")
public class SessionController {

    private final AuthService auth;
    private final JoinRateLimiter limiter;

    public SessionController(AuthService auth, JoinRateLimiter limiter) {
        this.auth = auth;
        this.limiter = limiter;
    }

    /** Entrar con el código personal. Devuelve el token Bearer para REST y para el CONNECT de STOMP. */
    @PostMapping("/join")
    public JoinResponse join(@Valid @RequestBody JoinRequest request, HttpServletRequest http) {
        limiter.check(http.getRemoteAddr());
        AuthService.JoinResult result = auth.join(request.code());
        Player p = result.player();
        return new JoinResponse(result.token(), p.getRole(), p.getId(), p.getSessionId(), p.getName(),
                p.getCharacterName(), p.getCharacterCode());
    }

    /** Cierra la sesión del dispositivo actual (revoca el token). */
    @PostMapping("/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@AuthenticationPrincipal EclipsePrincipal me) {
        auth.revoke(me.playerId());
    }
}
