package es.eclipse.backend.web.error;

public class InvalidCodeException extends RuntimeException {
    public InvalidCodeException() {
        super("Código de acceso no válido");
    }
}
