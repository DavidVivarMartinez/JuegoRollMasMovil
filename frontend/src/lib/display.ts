import type { DisplayFog, DisplayScene, DisplayState, DisplayToken, MapImage, PlayerSummary } from "./types";

/** El plano de la estación se recorta a la franja donde hay sectores (viewBox del SVG y proporción de la escena). */
export const STATION_VIEWBOX = "0 14 100 72";
export const STATION_ASPECT = 100 / 72;

export const PLAYER_COLORS: Record<string, string> = {
  ENGINEER: "#ffb347",
  MEDIC: "#39ff8a",
  SECURITY: "#4d8bff",
  SCIENTIST: "#c77dff",
};

/** Colores para fichas extra (PNJ, infectados, objetos). */
export const TOKEN_PALETTE = ["#ff4d4d", "#ffb347", "#4de3ff", "#e0e0e0", "#c77dff", "#39ff8a"];

export const FOG_DENSITIES = [8, 12, 16, 24];

export function mapIdOf(sceneKey: string): number | null {
  return sceneKey.startsWith("MAP:") ? Number(sceneKey.slice(4)) || null : null;
}

/** Proporción ancho/alto de la escena (1 si es un mapa que aún no conocemos). */
export function sceneAspect(sceneKey: string, maps: MapImage[]): number {
  if (sceneKey === "STATION") return STATION_ASPECT;
  const id = mapIdOf(sceneKey);
  const map = id == null ? undefined : maps.find((m) => m.id === id);
  return map ? map.width / map.height : 16 / 9;
}

export function emptyFog(cols: number, aspect: number): DisplayFog {
  const rows = Math.max(1, Math.min(40, Math.round(cols / aspect)));
  return { enabled: false, cols, rows, revealed: "0".repeat(cols * rows) };
}

/** Cambia la densidad de la rejilla conservando lo revelado (cada casilla nueva copia la vieja que tiene debajo). */
export function resizeFog(fog: DisplayFog, cols: number, aspect: number): DisplayFog {
  const next = emptyFog(cols, aspect);
  const cells: string[] = [];
  for (let r = 0; r < next.rows; r++) {
    for (let c = 0; c < next.cols; c++) {
      const oc = Math.min(fog.cols - 1, Math.floor(((c + 0.5) / next.cols) * fog.cols));
      const or = Math.min(fog.rows - 1, Math.floor(((r + 0.5) / next.rows) * fog.rows));
      cells.push(fog.revealed[or * fog.cols + oc] === "1" ? "1" : "0");
    }
  }
  return { ...next, enabled: fog.enabled, revealed: cells.join("") };
}

export function fogCellAt(fog: DisplayFog, x: number, y: number): [number, number] {
  const c = Math.max(0, Math.min(fog.cols - 1, Math.floor(x * fog.cols)));
  const r = Math.max(0, Math.min(fog.rows - 1, Math.floor(y * fog.rows)));
  return [c, r];
}

export function isRevealed(fog: DisplayFog, c: number, r: number): boolean {
  return fog.revealed[r * fog.cols + c] === "1";
}

export function setCells(fog: DisplayFog, cells: Array<[number, number]>, value: "0" | "1"): DisplayFog {
  const chars = fog.revealed.split("");
  for (const [c, r] of cells) chars[r * fog.cols + c] = value;
  return { ...fog, revealed: chars.join("") };
}

export function playerToken(p: PlayerSummary, index: number): DisplayToken {
  return {
    id: `p-${p.id}`,
    label: p.name,
    color: PLAYER_COLORS[p.characterCode ?? ""] ?? "#e0e0e0",
    x: 0.05 + index * 0.065,
    y: 0.64,
    visible: true,
    playerId: p.id,
  };
}

/**
 * Garantiza que la escena existe y que tiene la ficha de cada jugador (las nuevas aparecen abajo a la izquierda).
 * Un mapa nuevo empieza con la niebla activa y todo cubierto, para que no se vea nada que el máster no haya revelado.
 * El plano de la estación no: ya oculta los sectores desconocidos. Al volver a un mapa se conserva lo revelado.
 */
export function ensureScene(state: DisplayState, key: string, players: PlayerSummary[], aspect: number): DisplayState {
  if (key === "NONE") return state;
  const existing: DisplayScene | undefined = state.scenes[key];
  const scene: DisplayScene = existing ?? { tokens: [], fog: { ...emptyFog(12, aspect), enabled: key !== "STATION" } };
  const tokens = [...scene.tokens];
  players.forEach((p, i) => {
    if (!tokens.some((t) => t.playerId === p.id)) tokens.push(playerToken(p, i));
  });
  if (existing && tokens.length === existing.tokens.length) return state;
  return { ...state, scenes: { ...state.scenes, [key]: { ...scene, tokens } } };
}

export function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return label.trim().slice(0, 2).toUpperCase() || "?";
}
