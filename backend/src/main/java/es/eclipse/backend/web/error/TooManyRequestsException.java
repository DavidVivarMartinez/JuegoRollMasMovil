package es.eclipse.backend.web.error;

public class TooManyRequestsException extends RuntimeException {
    public TooManyRequestsException() {
        super("Demasiados intentos. Espera un minuto.");
    }
}
