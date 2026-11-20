/** "Sin seguimiento a tiempo". `compact`: solo un reloj rojo (para la lista, donde el espacio es poco); el texto va en el título. */
export function OverdueIndicator({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span
        title="Sin seguimiento a tiempo"
        aria-label="Sin seguimiento a tiempo"
        className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
      Sin seguimiento a tiempo
    </span>
  );
}
