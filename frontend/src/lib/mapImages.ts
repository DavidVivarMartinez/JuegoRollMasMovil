import { useEffect, useState } from "react";
import { fetchBlob } from "./api";

/**
 * Imágenes de mapas de la pantalla de mesa. Se descargan con el token (un <img> no puede enviarlo)
 * y se guardan como URL de objeto: cada mapa se descarga una sola vez por pestaña.
 */
const cache = new Map<number, Promise<string>>();

export function mapImageUrl(id: number): Promise<string> {
  let url = cache.get(id);
  if (!url) {
    url = fetchBlob(`/api/display/maps/${id}/image`).then((blob) => URL.createObjectURL(blob));
    url.catch(() => cache.delete(id));
    cache.set(id, url);
  }
  return url;
}

export function useMapImage(id: number | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (id == null) return;
    let cancelled = false;
    mapImageUrl(id)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);
  return url;
}

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

const MAX_SIDE = 2560;
const MAX_ORIGINAL_BYTES = 2.5 * 1024 * 1024;

/**
 * Prepara una foto o mapa para subirlo desde el móvil: si ya es pequeño se sube tal cual; si no, se reduce
 * a 2560 px por el lado mayor en JPEG. Así un mapa de 10 MB del carrete queda en 1 MB aprox.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const supported = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (supported && Math.max(width, height) <= MAX_SIDE && file.size <= MAX_ORIGINAL_BYTES) {
    bitmap.close();
    return { blob: file, width, height };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sin canvas");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo convertir la imagen"))), "image/jpeg", 0.86),
  );
  return { blob, width: w, height: h };
}

// ---------------------------------------------------------------- vídeos (mapas animados)

export const VIDEO_TYPES = ["video/mp4", "video/webm"];
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

export function isVideoType(contentType: string | null | undefined): boolean {
  return !!contentType && contentType.startsWith("video/");
}

/** Lee ancho y alto de un vídeo sin reproducirlo. */
function videoSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const size = { width: video.videoWidth, height: video.videoHeight };
      URL.revokeObjectURL(url);
      if (!size.width || !size.height) reject(new Error("No se pudo leer el tamaño del vídeo"));
      else resolve(size);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("El navegador no puede reproducir este vídeo: usa MP4 (H.264) o WEBM"));
    };
    video.src = url;
  });
}

/**
 * Prepara un mapa para subir: las imágenes se reducen si hace falta; los vídeos (MP4 o WEBM) se suben tal cual,
 * tras comprobar formato y tamaño, porque convertirlos en el móvil sería muy lento.
 */
export async function prepareMedia(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("video/")) return prepareImage(file);
  if (!VIDEO_TYPES.includes(file.type)) {
    throw new Error("Formato de vídeo no admitido: usa MP4 o WEBM (los .mov del iPhone no valen; expórtalos a MP4)");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`El vídeo pesa ${Math.round(file.size / 1048576)} MB: el máximo es 30 MB (prueba a recortarlo o bajar a 1080p)`);
  }
  const { width, height } = await videoSize(file);
  return { blob: file, width, height };
}
