package es.eclipse.backend.web.error;

/** La accion es valida pero el estado del juego no la permite (409). */
public class ActionRejectedException extends RuntimeException {
    public ActionRejectedException(String message) {
        super(message);
    }
}
