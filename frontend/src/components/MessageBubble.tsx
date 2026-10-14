import type { Message } from "../lib/types";

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "--:--:--"
    : d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const TONE: Record<Message["type"], string> = {
  TEXT: "border-term-line text-term-green",
  ALERT: "border-term-red text-term-red",
  SYSTEM: "border-term-cyan text-term-cyan",
};

export interface BubbleAction {
  label: string;
  done: boolean;
  onClick: () => void;
}

export default function MessageBubble({ message, action }: { message: Message; action?: BubbleAction }) {
  return (
    <article className={`slide-in rounded border-l-2 bg-term-panel px-3 py-2.5 ${TONE[message.type]}`}>
      <header className="flex items-baseline justify-between gap-2 text-[10px] tracking-widest opacity-80">
        <span>
          {message.type === "ALERT" ? "!! " : ""}
          {message.senderLabel}
          {message.scope === "PRIVATE" ? " · PRIVADO" : ""}
        </span>
        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
      </header>
      <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug">{message.text}</p>
      {action && (
        <div className="mt-2 flex justify-end">
          {action.done ? (
            <span className="py-2 text-[10px] tracking-widest text-term-dim">✓ CONFIRMADO</span>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="min-h-[40px] rounded border border-current px-3 text-[11px] tracking-widest active:bg-white/10"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
