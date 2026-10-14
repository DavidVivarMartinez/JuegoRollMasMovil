export default function LockOverlay({
  title = "MÓDULO BLOQUEADO",
  detail = "ACCESO DENEGADO POR PROTOCOLO DE CONTENCIÓN",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-term-bg/95 px-6 text-center">
      <svg viewBox="0 0 24 24" className="h-14 w-14 text-term-red glitch" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="1.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v3" strokeLinecap="round" />
      </svg>
      <div className="font-bold tracking-[0.3em] text-term-red">{title}</div>
      <div className="max-w-xs text-xs leading-relaxed text-term-dim">{detail}</div>
    </div>
  );
}
