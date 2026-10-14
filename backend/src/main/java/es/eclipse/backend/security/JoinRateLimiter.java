package es.eclipse.backend.security;

import es.eclipse.backend.config.AppProperties;
import es.eclipse.backend.web.error.TooManyRequestsException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** Limitador sencillo en memoria para los intentos de entrada con código (por IP, ventana de 1 minuto). */
@Component
public class JoinRateLimiter {

    private static final long WINDOW_MS = 60_000;

    private final int maxAttempts;
    private final Map<String, Deque<Long>> attempts = new ConcurrentHashMap<>();

    public JoinRateLimiter(AppProperties props) {
        this.maxAttempts = Math.max(1, props.join().maxAttemptsPerMinute());
    }

    public void check(String key) {
        long now = System.currentTimeMillis();
        Deque<Long> window = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && now - window.peekFirst() > WINDOW_MS) {
                window.pollFirst();
            }
            if (window.size() >= maxAttempts) {
                throw new TooManyRequestsException();
            }
            window.addLast(now);
        }
        if (attempts.size() > 10_000) {
            attempts.clear();
        }
    }
}
