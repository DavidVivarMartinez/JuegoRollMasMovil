package es.eclipse.backend.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Cuando el frontend compilado se sirve desde el backend, las rutas de la SPA deben devolver index.html. */
@Controller
public class SpaForwardController {

    @GetMapping({"/player", "/master"})
    public String forward() {
        return "forward:/index.html";
    }
}
