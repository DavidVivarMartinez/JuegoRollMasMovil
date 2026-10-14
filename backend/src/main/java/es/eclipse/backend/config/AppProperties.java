package es.eclipse.backend.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Configuración propia de la aplicación (prefijo {@code app}). */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @DefaultValue Cors cors,
        @DefaultValue Join join,
        @DefaultValue Realtime realtime,
        @DefaultValue Seed seed) {

    public record Cors(@DefaultValue List<String> allowedOrigins) {}

    public record Join(@DefaultValue("10") int maxAttemptsPerMinute) {}

    public record Realtime(@DefaultValue("*") List<String> allowedOriginPatterns) {}

    public record Seed(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("false") boolean printCodes,
            @DefaultValue("PROTOCOLO: ECLIPSE") String sessionName,
            @DefaultValue("Máster") String masterName,
            String masterCode,
            @DefaultValue("Pantalla de mesa") String displayName,
            String displayCode,
            @DefaultValue List<SeedPlayer> players) {}

    public record SeedPlayer(
            String name,
            String character,
            String characterCode,
            String code,
            @DefaultValue("0") int infection,
            @DefaultValue("100") int health) {}
}
