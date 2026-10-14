import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fogCellAt, initials, isRevealed, setCells, STATION_VIEWBOX } from "../lib/display";
import type { DisplayFog, DisplayScene, DisplayToken, Sector } from "../lib/types";
import StationMap from "./StationMap";

export type SceneTool = "move" | "fog";
export type FogBrush = "reveal" | "cover";

interface Props {
  sceneKey: string;
  scene: DisplayScene | undefined;
  /** ancho / alto de la escena */
  aspect: number;
  imageUrl: string | null;
  sectors: Sector[];
  /** tv: solo mostrar, niebla opaca · master: interactivo, niebla translúcida para ver debajo */
  variant: "tv" | "master";
  /** contain: llenar el contenedor (TV) · width: ajustarse al ancho, con alto máximo (móvil del máster) */
  fit?: "contain" | "width";
  maxHeight?: number;
  tool?: SceneTool;
  /** pincel de niebla: cada trazo revela o cubre, empiece donde empiece */
  fogBrush?: FogBrush;
  selectedToken?: string | null;
  onSelectToken?: (id: string | null) => void;
  onMoveToken?: (id: string, x: number, y: number, final: boolean) => void;
  onFogChange?: (fog: DisplayFog, final: boolean) => void;
}

type Drag =
  | { kind: "token"; id: string; moved: boolean; wasSelected: boolean }
  | { kind: "fog"; value: "0" | "1"; last: [number, number]; fog: DisplayFog };

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** Casillas por las que pasa el dedo entre dos puntos, para que un trazo rápido no deje huecos. */
function cellsBetween(a: [number, number], b: [number, number]): Array<[number, number]> {
  const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  const out: Array<[number, number]> = [];
  for (let i = 1; i <= steps; i++) {
    out.push([Math.round(a[0] + ((b[0] - a[0]) * i) / steps), Math.round(a[1] + ((b[1] - a[1]) * i) / steps)]);
  }
  return out;
}

export default function SceneView({
  sceneKey,
  scene,
  aspect,
  imageUrl,
  sectors,
  variant,
  fit = "contain",
  maxHeight = 520,
  tool = "move",
  fogBrush = "reveal",
  selectedToken = null,
  onSelectToken,
  onMoveToken,
  onFogChange,
}: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const interactive = variant === "master";

  // tamaño de la escena respetando su proporción
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (!W) return;
      let w = W;
      let h = W / aspect;
      const limit = fit === "width" ? maxHeight : H;
      if (limit > 0 && h > limit) {
        h = limit;
        w = h * aspect;
      }
      setSize((prev) => (Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect, fit, maxHeight]);

  const tokens = scene?.tokens ?? [];
  const fog = scene?.fog;
  const fogOn = !!fog?.enabled;
  const tokenSize = variant === "tv" ? Math.max(30, size.w * 0.042) : Math.max(22, size.w * 0.058);

  const tokenVisibleOnTv = (t: DisplayToken) => {
    if (!t.visible) return false;
    // los PNJ bajo la niebla no se ven; las fichas de los jugadores, siempre
    if (fogOn && fog && !t.playerId) {
      const [c, r] = fogCellAt(fog, t.x, t.y);
      return isRevealed(fog, c, r);
    }
    return true;
  };

  const pointFrom = (e: ReactPointerEvent): [number, number] => {
    const rect = boxRef.current!.getBoundingClientRect();
    return [clamp01((e.clientX - rect.left) / rect.width), clamp01((e.clientY - rect.top) / rect.height)];
  };

  /** La ficha más cercana al dedo dentro de un radio cómodo para tocar. */
  const tokenAt = (x: number, y: number): DisplayToken | undefined => {
    const radius = Math.max(tokenSize * 0.7, 22) / size.w;
    let best: DisplayToken | undefined;
    let bestDist = Infinity;
    for (const t of tokens) {
      const dist = Math.hypot(t.x - x, ((t.y - y) * size.h) / size.w);
      if (dist <= radius && dist < bestDist) {
        best = t;
        bestDist = dist;
      }
    }
    return best;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !scene) return;
    const [x, y] = pointFrom(e);
    if (tool === "fog" && fog) {
      const cell = fogCellAt(fog, x, y);
      const value = fogBrush === "cover" ? "0" : "1";
      const next = setCells(fog, [cell], value);
      drag.current = { kind: "fog", value, last: cell, fog: next };
      onFogChange?.(next, false);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const hit = tokenAt(x, y);
    if (hit) {
      drag.current = { kind: "token", id: hit.id, moved: false, wasSelected: hit.id === selectedToken };
      onSelectToken?.(hit.id);
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (selectedToken) {
      // tocar un hueco con una ficha seleccionada la lleva allí
      onMoveToken?.(selectedToken, x, y, true);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const [x, y] = pointFrom(e);
    if (d.kind === "token") {
      d.moved = true;
      onMoveToken?.(d.id, x, y, false);
    } else {
      const cell = fogCellAt(d.fog, x, y);
      if (cell[0] === d.last[0] && cell[1] === d.last[1]) return;
      d.fog = setCells(d.fog, cellsBetween(d.last, cell), d.value);
      d.last = cell;
      onFogChange?.(d.fog, false);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "token") {
      if (d.moved) {
        const [x, y] = pointFrom(e);
        onMoveToken?.(d.id, x, y, true);
      } else if (d.wasSelected) {
        onSelectToken?.(null); // tocar otra vez la ficha seleccionada la suelta
      }
    } else {
      onFogChange?.(d.fog, true);
    }
  };

  return (
    <div
      ref={outerRef}
      className={`relative flex w-full items-center justify-center ${fit === "contain" ? "h-full" : ""}`}
      style={fit === "width" ? { height: size.h || undefined } : undefined}
    >
      {size.w > 0 && (
        <div
          ref={boxRef}
          className="relative select-none overflow-hidden"
          style={{ width: size.w, height: size.h, touchAction: interactive ? "none" : undefined }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* fondo */}
          {sceneKey === "STATION" && (
            <div className="absolute inset-0 bg-term-bg">
              <StationMap sectors={sectors} viewBox={STATION_VIEWBOX} className="h-full w-full" />
            </div>
          )}
          {sceneKey.startsWith("MAP:") &&
            (imageUrl ? (
              <img src={imageUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs tracking-widest text-term-dim">
                CARGANDO MAPA<span className="blink">_</span>
              </div>
            ))}

          {/* niebla */}
          {fogOn && fog && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${fog.cols} ${fog.rows}`}
              preserveAspectRatio="none"
            >
              {variant === "tv" && (
                <defs>
                  <filter id="fog-blur" x="-5%" y="-5%" width="110%" height="110%">
                    <feGaussianBlur stdDeviation="0.18" />
                  </filter>
                </defs>
              )}
              <g filter={variant === "tv" ? "url(#fog-blur)" : undefined}>
                {Array.from({ length: fog.rows }, (_, r) =>
                  Array.from({ length: fog.cols }, (_, c) =>
                    isRevealed(fog, c, r) ? null : (
                      <rect
                        key={`${c}-${r}`}
                        x={c - 0.02}
                        y={r - 0.02}
                        width={1.04}
                        height={1.04}
                        fill={variant === "tv" ? "#020304" : "rgba(4,10,18,0.74)"}
                      />
                    ),
                  ),
                )}
              </g>
              {variant === "master" &&
                Array.from({ length: fog.cols - 1 }, (_, c) => (
                  <line key={`v${c}`} x1={c + 1} y1={0} x2={c + 1} y2={fog.rows} stroke="rgba(57,255,138,0.18)" strokeWidth={0.03} />
                ))}
              {variant === "master" &&
                Array.from({ length: fog.rows - 1 }, (_, r) => (
                  <line key={`h${r}`} x1={0} y1={r + 1} x2={fog.cols} y2={r + 1} stroke="rgba(57,255,138,0.18)" strokeWidth={0.03} />
                ))}
            </svg>
          )}

          {/* fichas */}
          {tokens.map((t) => {
            if (variant === "tv" && !tokenVisibleOnTv(t)) return null;
            const selected = interactive && t.id === selectedToken;
            const hidden = interactive && !t.visible;
            const border = Math.max(2, tokenSize * 0.08);
            return (
              <div
                key={t.id}
                className="pointer-events-none absolute"
                style={{
                  left: t.x * size.w,
                  top: t.y * size.h,
                  width: tokenSize,
                  height: tokenSize,
                  transform: "translate(-50%, -50%)",
                  transition: variant === "tv" ? "left 0.3s ease-out, top 0.3s ease-out" : undefined,
                  opacity: hidden ? 0.4 : 1,
                  zIndex: selected ? 5 : 2,
                }}
              >
                <div
                  className={`flex h-full w-full items-center justify-center rounded-full font-bold ${selected ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""}`}
                  style={{
                    background: `linear-gradient(${t.color}38, ${t.color}38), #05080a`,
                    border: `${border}px ${hidden ? "dashed" : "solid"} ${t.color}`,
                    color: t.color,
                    boxShadow: `0 0 ${tokenSize * 0.35}px ${t.color}99`,
                    fontSize: tokenSize * 0.36,
                  }}
                >
                  {initials(t.label)}
                </div>
                <div
                  className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/75 px-1 leading-tight"
                  style={{ color: t.color, fontSize: variant === "tv" ? Math.max(12, tokenSize * 0.3) : 9 }}
                >
                  {t.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
