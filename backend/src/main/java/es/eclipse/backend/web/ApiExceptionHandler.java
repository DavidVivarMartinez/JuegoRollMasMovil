package es.eclipse.backend.web;

import es.eclipse.backend.web.error.ActionRejectedException;
import es.eclipse.backend.web.error.InvalidCodeException;
import es.eclipse.backend.web.error.ModuleLockedException;
import es.eclipse.backend.web.error.NotFoundException;
import es.eclipse.backend.web.error.TooManyRequestsException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Errores de la API como RFC 9457 (application/problem+json) con un campo {@code code} estable para el frontend. */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    ProblemDetail notFound(NotFoundException e) {
        return problem(HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage());
    }

    @ExceptionHandler(InvalidCodeException.class)
    ProblemDetail invalidCode(InvalidCodeException e) {
        return problem(HttpStatus.UNAUTHORIZED, "INVALID_CODE", e.getMessage());
    }

    @ExceptionHandler(ModuleLockedException.class)
    ProblemDetail moduleLocked(ModuleLockedException e) {
        ProblemDetail pd = problem(HttpStatus.LOCKED, "MODULE_LOCKED", e.getMessage());
        pd.setProperty("module", e.getModule().name());
        return pd;
    }

    @ExceptionHandler(TooManyRequestsException.class)
    ProblemDetail tooMany(TooManyRequestsException e) {
        return problem(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_REQUESTS", e.getMessage());
    }

    @ExceptionHandler(ActionRejectedException.class)
    ProblemDetail rejected(ActionRejectedException e) {
        return problem(HttpStatus.CONFLICT, "ACTION_REJECTED", e.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail accessDenied(AccessDeniedException e) {
        return problem(HttpStatus.FORBIDDEN, "FORBIDDEN", "No tienes permiso para esta operación");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail validation(MethodArgumentNotValidException e) {
        ProblemDetail pd = problem(HttpStatus.BAD_REQUEST, "VALIDATION", "Datos no válidos");
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError fe : e.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(fe.getField(), fe.getDefaultMessage());
        }
        pd.setProperty("fields", fields);
        return pd;
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ProblemDetail badRequest(Exception e) {
        ProblemDetail pd = problem(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Petición mal formada");
        Throwable root = e;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        String cause = root.getMessage();
        if (cause != null && !cause.isBlank()) {
            pd.setProperty("cause", cause.length() > 200 ? cause.substring(0, 200) : cause);
        }
        return pd;
    }

    private static ProblemDetail problem(HttpStatus status, String code, String detail) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setProperty("code", code);
        return pd;
    }
}
