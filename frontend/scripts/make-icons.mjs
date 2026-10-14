// Genera los iconos PNG de la PWA sin dependencias externas: un eclipse verde sobre negro.
// Uso: npm run icons   (escribe en public/icons)
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// ---- codificador PNG mínimo (RGB 8 bits, sin filtro)
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(size, pixel) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filtro "none"
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * stride + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- dibujo
const BG = [5, 8, 10];
const GREEN = [57, 255, 138];
const DISC = [8, 14, 12];

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function eclipse(size, scale) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * scale; // radio de la corona
  const ox = cx + R * 0.22; // disco oscuro desplazado hacia la derecha
  const oy = cy - R * 0.12;
  const r = R * 0.9;
  const ring = Math.max(1.2, size * 0.012);
  return (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const d = Math.hypot(px - cx, py - cy);
    const dd = Math.hypot(px - ox, py - oy);
    const outer = 1 - smooth(R, R * 1.7, d);
    const inner = smooth(R * 0.55, R * 0.95, d);
    let col = mix(BG, GREEN, outer * inner * 0.85);
    if (Math.abs(d - R) < ring) col = GREEN;
    if (dd < r) col = mix(col, DISC, 1 - smooth(r * 0.93, r, dd));
    if (y % 4 === 0) col = col.map((v) => Math.round(v * 0.86)); // líneas de barrido
    return col;
  };
}

mkdirSync(OUT, { recursive: true });
const files = [
  ["icon-192.png", 192, 0.34],
  ["icon-512.png", 512, 0.34],
  ["icon-maskable-512.png", 512, 0.26], // zona segura del 80 % para iconos enmascarados
  ["apple-touch-icon.png", 180, 0.34],
];
for (const [name, size, scale] of files) {
  writeFileSync(join(OUT, name), png(size, eclipse(size, scale)));
  console.log("✓", name);
}
