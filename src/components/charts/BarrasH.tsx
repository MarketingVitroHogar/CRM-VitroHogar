import clsx from "clsx";
import { EstadoVacio } from "@/components/ui/EstadoVacio";

/** Barras horizontales con etiqueta, valor y porcentaje. */
export function BarrasH({ filas, colorClase = "bg-brand" }: { filas: { label: string; valor: number; extra?: string; colorClase?: string }[]; colorClase?: string }) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  const total = filas.reduce((s, f) => s + f.valor, 0);
  if (total === 0) return <EstadoVacio compact icono="grafica" titulo="Sin leads en este periodo" texto="Prueba con otro periodo." />;
  return (
    <ul className="flex flex-col gap-2.5">
      {filas.map((f) => (
        <li key={f.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-sm text-slate-700 sm:w-32" title={f.label}>{f.label}</span>
          <div className="h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-slate-100">
            <div className={clsx("h-full rounded-md", f.colorClase ?? colorClase)} style={{ width: `${Math.max(f.valor ? 3 : 0, (f.valor / max) * 100)}%` }} />
          </div>
          <span className="w-[4.5rem] shrink-0 text-right text-sm font-semibold text-slate-900">
            {f.valor} <span className="font-normal text-slate-400">{f.extra ?? `(${Math.round((f.valor / total) * 100)}%)`}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
