package es.eclipse.backend.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import org.springframework.stereotype.Service;

/** Generación de tokens opacos y hashing de códigos/tokens (en BD solo se guardan hashes). */
@Service
public class TokenService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final HexFormat HEX = HexFormat.of();

    /** Caracteres sin ambigüedad al teclear en el móvil (sin 0/O, 1/I/L). */
    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    /** Código legible aleatorio: {@code PREFIJO-XXXX} (o {@code PREFIJO-XXXX-XXXX} con dos grupos). */
    public String newAccessCode(String prefix, int groups) {
        StringBuilder sb = new StringBuilder(prefix);
        for (int g = 0; g < groups; g++) {
            sb.append('-');
            for (int i = 0; i < 4; i++) {
                sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
        }
        return sb.toString();
    }

    public String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HEX.formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    /**
     * Los códigos se comparan en mayúsculas y solo por sus letras y dígitos, para que en el móvil den igual
     * los espacios, los guiones o las minúsculas: "cie 6618", "CIE-6618" y "cie6618" son el mismo código.
     */
    public String normalizeCode(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }
}
