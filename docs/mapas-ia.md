# Mapas de la estación con IA (gratis)

> **Automático en este PC**: `tools/mapas-ia/` genera todas las zonas con Stable Diffusion en local (RTX 2070) y las
> sube a la partida. Ver [tools/mapas-ia/README.md](../tools/mapas-ia/README.md). Esta guía es la alternativa manual con
> generadores web gratuitos.

Mapas cenitales con el estilo de "battlemap pintado" para la pantalla de mesa. Se generan con una IA de imágenes
gratuita, se suben desde **MESA → SUBIR MAPA** y encima van nuestras fichas, la niebla y los efectos.

## Dónde generarlos gratis

Los límites gratuitos cambian a menudo; comprobadlos al usarlos.

| Herramienta | Ventaja | Formato 16:9 |
|---|---|---|
| **Ideogram** | Buena calidad y créditos diarios gratis | Sí |
| **Leonardo.ai** | Créditos diarios gratis, permite "imagen de referencia de estilo" y prompt negativo | Sí |
| **Gemini (Google)** | El más generoso en cantidad | Pídelo en el texto |
| **Bing / Copilot Image Creator** | Gratis con cuenta Microsoft | Pídelo en el texto |

## Cómo conseguir un juego de mapas coherente

1. **Usa siempre el mismo bloque de estilo** (abajo) y cambia solo la descripción de la zona.
2. **Genera 3 o 4 variantes** de cada zona y quédate con la mejor.
3. Si la herramienta lo permite (Leonardo, Ideogram), usa **el primer mapa bueno como referencia de estilo** para los demás.
4. **Formato apaisado 16:9**, que es la forma de la tele. Las imágenes verticales se verán con bandas negras a los lados.
5. **Sin personajes**: las fichas las ponemos nosotros. Si aparece gente, regenera.
6. **Sin cuadrícula dibujada**: la pondremos nosotros encima, calibrada (siguiente mejora de la mesa).
7. Escribe los prompts **en inglés**: estas herramientas responden bastante mejor.

## Bloque de estilo (pégalo al final de cada prompt)

```
Top-down battle map for a tabletop RPG, orthographic view from directly above, no perspective, no isometric angle.
No people, no characters, no text, no labels, no grid lines, no watermark.
Abandoned sci-fi mining station orbiting a dark moon in the year 2187, industrial and worn: riveted metal floor
plates, grime, condensation, scattered debris, cables on the floor.
Moody cinematic horror lighting: cold flickering fluorescent panels, small red emergency lights, deep black
shadows, faint volumetric haze. Painterly digital art, highly detailed, dark palette with teal and amber accents.
Wide 16:9 landscape composition.
```

**Prompt negativo** (Leonardo o Stable Diffusion):
```
perspective, isometric, 3d render, text, letters, watermark, signature, people, characters, creatures, grid, frame, border
```

## Zonas de la estación

Pon primero la descripción de la zona y después el bloque de estilo.

**Hangar de atraque** — inicio de la partida
```
A large docking hangar with a small crew transport ship parked on the left, landing markings painted on the
floor, cargo crates and a fuel line, an airlock door leading to a corridor on the right, emergency beacons
blinking amber.
```

**Corredor principal**
```
A long main corridor crossing the station horizontally with side doors to several rooms, flickering ceiling
lights casting pools of light, dark drag marks and a smeared trail on the floor leading towards a sealed door
at the bottom, a fallen maintenance cart.
```

**Puente de mando**
```
A command bridge with a horseshoe of control consoles facing a large dark viewport, several abandoned chairs,
one console still glowing blue with a looping alert, scattered tablets and a broken coffee mug.
```

**Enfermería**
```
A medical bay with six hospital beds with rumpled sheets, an examination table under a surgical lamp,
medicine cabinets left open, an overturned IV stand, one bed with restraint straps, a sterile white light
flickering over dark corners.
```

**Almacén**
```
A storage room packed with shelving units, stacked supply containers and barrels, a forklift, narrow aisles
between the shelves, one container forced open from the inside, dim amber lighting.
```

**Sector 17 (cuarentena)**
```
A quarantine section behind a heavy sealed blast door with yellow and black hazard stripes, a decontamination
chamber, isolation cells with reinforced glass walls, one cell cracked, red quarantine lights rotating,
warning symbols painted on the floor.
```

**Laboratorio central**
```
A biological research laboratory with workbenches full of equipment, tall glass containment tanks along the
walls, one tank holding a dark organic mass glowing faintly violet, specimen jars, a microscope station,
scattered notes, cold blue light and violet bioluminescence.
```

**Núcleo del reactor**
```
A circular reactor chamber with a large glowing reactor core in the center, catwalks with railings around it,
thick pipes and coolant tanks, steam vents, a control panel with warning lights, orange glow from the core.
```

**Acceso a las minas**
```
A mining access area where the metal station floor turns into raw dark rock, a mine shaft entrance with a
cage elevator, drilling machines, rails for ore carts, rocky tunnels disappearing into darkness, work lamps
hanging from cables.
```

**Atraque de la NEXUS-7**
```
A second docking bay with a sleek scientific research ship docked, its boarding ramp lowered and lights still
on, personal belongings scattered on the ramp, a single chair placed facing the ship's entrance.
```

**Nave de evacuación**
```
The interior of a small escape shuttle seen from above: four crash seats with harnesses, a cockpit with a
launch console, storage lockers, a countdown display glowing red, a narrow hatch at the back.
```

## Al subirlos

- La web reduce sola las imágenes grandes antes de subirlas.
- Ponles el nombre de la zona (el nombre del archivo se usa como nombre del mapa).
- Prueba cada mapa en la tele con la niebla cubierta del todo: los mapas oscuros quedan muy bien con linternas
  y luces de alarma.
