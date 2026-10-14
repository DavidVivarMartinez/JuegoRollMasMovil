package es.eclipse.backend.web.error;

import es.eclipse.backend.domain.GameModule;

public class ModuleLockedException extends RuntimeException {

    private final GameModule module;

    public ModuleLockedException(GameModule module) {
        super("Módulo bloqueado: " + module);
        this.module = module;
    }

    public GameModule getModule() {
        return module;
    }
}
