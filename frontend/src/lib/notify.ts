// Avisos dentro de la web (nivel 1): pitido sintetizado + vibración. Sin ficheros de audio.

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Debe llamarse desde un gesto del usuario (tap) para que el navegador permita el audio después. */
export function primeAudio(): void {
  const c = context();
  if (!c) return;
  try {
    const buffer = c.createBuffer(1, 1, 22050);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
  } catch {
    // ignorar
  }
}

export type NotifyKind = "message" | "alert";

export function notify(kind: NotifyKind): void {
  const c = context();
  if (c) {
    try {
      const now = c.currentTime;
      const tones = kind === "alert" ? [220, 180, 220, 180] : [880, 1320];
      tones.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = kind === "alert" ? "sawtooth" : "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(c.destination);
        const start = now + i * (kind === "alert" ? 0.18 : 0.09);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(kind === "alert" ? 0.25 : 0.15, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === "alert" ? 0.16 : 0.08));
        osc.start(start);
        osc.stop(start + 0.2);
      });
    } catch {
      // sin audio
    }
  }
  try {
    navigator.vibrate?.(kind === "alert" ? [200, 80, 200, 80, 400] : 70);
  } catch {
    // sin vibración
  }
}
