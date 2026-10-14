# Mapas de la estación con IA local (gratis)

Genera los mapas cenitales de cada zona con Stable Diffusion en el propio PC (tarjeta NVIDIA) y los sube a la partida.
Sin cuentas, sin límites y sin coste.

## Qué hay instalado

| Qué | Dónde |
|---|---|
| ComfyUI portable (motor de Stable Diffusion, gratuito y de código abierto) | `C:\Users\david\ComfyUI_windows_portable` |
| Modelo **D&D Battlemaps SDXL 1.0** (SDXL entrenado para mapas de mesa vistos desde arriba, ~6,6 GB) | `...\ComfyUI\models\checkpoints\` |

Licencia del modelo: CreativeML Open RAIL++-M con restricciones adicionales (uso personal sin problema).
Para desinstalar basta con borrar la carpeta `C:\Users\david\ComfyUI_windows_portable` (unos 11 GB con el modelo).

## Uso

1. **Arrancar ComfyUI** (deja la ventana abierta mientras generas):
   ```
   C:\Users\david\ComfyUI_windows_portable\run_nvidia_gpu.bat
   ```
2. **Generar** (desde la carpeta del proyecto):
   ```bash
   node tools/mapas-ia/generar.mjs                        # todas las zonas
   node tools/mapas-ia/generar.mjs corredor --variantes 4 # 4 versiones del corredor
   ```
   Las imágenes quedan en `tools/mapas-ia/salida/` como `zona-semilla.png`. Con una RTX 2070 tarda unos 30-60 s por mapa.
3. **Subir** la que te guste a la partida (aparece en MESA al momento):
   ```bash
   ECLIPSE_MASTER_CODE=<código del máster> node tools/mapas-ia/generar.mjs --subir tools/mapas-ia/salida/corredor-1234.png --nombre "Corredor principal"
   ```
   También puedes subirla a mano desde **MESA → SUBIR MAPA**.

   Avisos: subir entra como máster, así que cierra la sesión del máster en otros dispositivos (vuelve a meter el código).
   El servidor admite 10 entradas por minuto: si subes muchos mapas seguidos, espera un minuto entre tandas.

**Smart App Control** (Windows 11) puede bloquear la primera vez alguna librería de ComfyUI mientras consulta su reputación
("una directiva de Control de aplicaciones bloqueó este archivo"). Basta con volver a arrancarlo; no hace falta desactivar nada.

## Cambiar o añadir zonas

Las descripciones están en `zonas.json` (en inglés: el modelo responde mejor). `estilo` se añade a todas las zonas y
`negativo` lista lo que no queremos (perspectiva, personas, texto…). Si un resultado te gusta, apunta su semilla:
con la misma semilla y el mismo texto sale la misma imagen.
