#!/usr/bin/env node
/**
 * Genera los mapas de la estación con Stable Diffusion en local (ComfyUI) y, si se pide, los sube a la partida.
 * Gratis y sin límites: usa la tarjeta gráfica del PC. Sin dependencias (Node 20+).
 *
 *   node tools/mapas-ia/generar.mjs                       genera todas las zonas (1 variante cada una)
 *   node tools/mapas-ia/generar.mjs corredor laboratorio  solo esas zonas
 *   node tools/mapas-ia/generar.mjs --variantes 3         3 versiones de cada zona (semillas distintas)
 *   node tools/mapas-ia/generar.mjs corredor --semilla 42 una semilla concreta (para repetir un resultado)
 *   node tools/mapas-ia/generar.mjs --subir salida/corredor-42.png --nombre "Corredor principal"
 *       sube una imagen ya generada (pide el código del máster con ECLIPSE_MASTER_CODE)
 *
 * Opciones: --comfy http://127.0.0.1:8188   --api https://protocolo-eclipse-api.onrender.com
 *           --modelo dDBattlemapsSDXL10_upscaleV10.safetensors   --pasos 30   --salida tools/mapas-ia/salida
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- argumentos
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const comfy = opt("comfy", "http://127.0.0.1:8188");
const api = opt("api", "https://protocolo-eclipse-api.onrender.com");
const modelo = opt("modelo", "dDBattlemapsSDXL10_upscaleV10.safetensors");
const pasos = Number(opt("pasos", "30"));
const variantes = Number(opt("variantes", "1"));
const semillaFija = opt("semilla", null);
const salida = opt("salida", join(HERE, "salida"));
const subirArchivo = opt("subir", null);
const nombreSubida = opt("nombre", null);
const zonasPedidas = args.filter((a) => !a.startsWith("--"));

const config = JSON.parse(readFileSync(join(HERE, "zonas.json"), "utf8"));

// ---------------------------------------------------------------- ComfyUI

function workflow(prompt, seed) {
  // Flujo mínimo de ComfyUI en formato API: checkpoint → textos → lienzo → muestreo → decodificar → guardar
  return {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: modelo } },
    2: { class_type: "CLIPTextEncode", inputs: { text: `${prompt}, ${config.estilo}`, clip: ["1", 1] } },
    3: { class_type: "CLIPTextEncode", inputs: { text: config.negativo, clip: ["1", 1] } },
    4: { class_type: "EmptyLatentImage", inputs: { width: config.ancho, height: config.alto, batch_size: 1 } },
    5: {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
        seed,
        steps: pasos,
        cfg: 6.5,
        sampler_name: "dpmpp_2m",
        scheduler: "karras",
        denoise: 1,
      },
    },
    6: { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    7: { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "eclipse/mapa" } },
  };
}

async function generar(prompt, seed) {
  const res = await fetch(`${comfy}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow(prompt, seed), client_id: "eclipse-mapas" }),
  });
  if (!res.ok) throw new Error(`ComfyUI rechazó el trabajo: ${res.status} ${await res.text()}`);
  const { prompt_id } = await res.json();
  for (;;) {
    await new Promise((r) => setTimeout(r, 1500));
    const hist = await (await fetch(`${comfy}/history/${prompt_id}`)).json();
    const entry = hist[prompt_id];
    if (!entry) continue;
    if (entry.status?.status_str === "error") throw new Error("ComfyUI falló al generar: " + JSON.stringify(entry.status.messages));
    const images = entry.outputs?.["7"]?.images;
    if (images?.length) {
      const img = images[0];
      const url = `${comfy}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`;
      return Buffer.from(await (await fetch(url)).arrayBuffer());
    }
  }
}

// ---------------------------------------------------------------- subida a la partida

async function subir(file, nombre) {
  const code = process.env.ECLIPSE_MASTER_CODE;
  if (!code) throw new Error("Define ECLIPSE_MASTER_CODE con el código del máster para subir mapas");
  const login = await fetch(`${api}/api/session/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!login.ok) throw new Error(`No se pudo entrar como máster: ${login.status}`);
  const { token, role } = await login.json();
  if (role !== "MASTER") throw new Error("Ese código no es el del máster");
  const png = readFileSync(file);
  const params = new URLSearchParams({ name: nombre, width: String(config.ancho), height: String(config.alto) });
  const up = await fetch(`${api}/api/master/maps?${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
    body: png,
  });
  if (!up.ok) throw new Error(`Subida rechazada: ${up.status} ${await up.text()}`);
  return up.json();
}

// ---------------------------------------------------------------- principal

if (subirArchivo) {
  const nombre = nombreSubida ?? basename(subirArchivo).replace(/\.[^.]+$/, "");
  const map = await subir(subirArchivo, nombre);
  console.log(`✓ Subido "${map.name}" (id ${map.id}, ${Math.round(map.sizeBytes / 1024)} KB)`);
  process.exit(0);
}

const zonas = zonasPedidas.length ? config.zonas.filter((z) => zonasPedidas.includes(z.id)) : config.zonas;
if (!zonas.length) {
  console.error("Zonas disponibles:", config.zonas.map((z) => z.id).join(", "));
  process.exit(1);
}
try {
  await fetch(`${comfy}/system_stats`);
} catch {
  console.error(`No responde ComfyUI en ${comfy}. Arráncalo primero (ver tools/mapas-ia/README.md).`);
  process.exit(1);
}
mkdirSync(salida, { recursive: true });

for (const zona of zonas) {
  for (let v = 0; v < variantes; v++) {
    const seed = semillaFija != null ? Number(semillaFija) + v : Math.floor(Math.random() * 2 ** 31);
    const t0 = Date.now();
    process.stdout.write(`${zona.nombre} (semilla ${seed})… `);
    const png = await generar(zona.prompt, seed);
    const file = join(salida, `${zona.id}-${seed}.png`);
    writeFileSync(file, png);
    console.log(`✓ ${Math.round((Date.now() - t0) / 1000)} s → ${file}`);
  }
}
