import { useEffect } from "react";
import type { Message } from "../lib/types";

/** Pantalla roja parpadeante para mensajes de tipo ALERT. Se cierra al tocar o a los 6 segundos. */
export default function AlertFlash({ message, onDismiss }: { message: Message; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [message.id, onDismiss]);

  return (
    <button
      type="button"
      onClick={onDismiss}
      className="alert-flash fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-8 text-center"
    >
      <div className="text-xs tracking-[0.4em] text-term-red">// ALERTA // {message.senderLabel}</div>
      <div className="text-xl font-bold text-white drop-shadow-[0_0_12px_rgba(255,77,77,0.8)]">{message.text}</div>
      <div className="text-[10px] tracking-widest text-term-red/80">TOCA PARA CONTINUAR</div>
    </button>
  );
}
