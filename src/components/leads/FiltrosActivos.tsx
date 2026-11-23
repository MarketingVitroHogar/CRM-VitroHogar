"use client";

export type FiltroChip = { key: string; label: string; onQuitar: () => void };

/** Los filtros que están puestos, como etiquetas que se quitan con un toque, y "Limpiar filtros". */
export function FiltrosActivos({ chips, onLimpiar }: { chips: FiltroChip[]; onLimpiar: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros activos">
      <span className="text-xs font-medium text-slate-500">Filtros activos:</span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onQuitar}
          aria-label={`Quitar filtro ${c.label}`}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-300 bg-white py-1 pl-3 pr-2.5 text-xs font-medium text-slate-700 hover:border-brand hover:text-brand"
        >
          {c.label}
          <span aria-hidden className="text-sm leading-none text-slate-400">
            ✕
          </span>
        </button>
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={onLimpiar} className="min-h-8 rounded-md px-2 text-xs font-semibold text-brand hover:bg-red-50">
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
