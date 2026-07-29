import { FUENTE_LABELS } from "@/lib/catalogs";
import type { Fuente } from "@prisma/client";

export type CanalRow = {
  fuente: Fuente;
  total: number;
  porcentaje: number;
  ventas: number;
  monto: number;
};

export function CanalBreakdownTable({ rows }: { rows: CanalRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Sin datos para este periodo.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-slate-500">Canal</th>
            <th className="px-4 py-2 text-right font-medium text-slate-500">Leads</th>
            <th className="px-4 py-2 text-right font-medium text-slate-500">% del total</th>
            <th className="px-4 py-2 text-right font-medium text-slate-500">Ventas</th>
            <th className="px-4 py-2 text-right font-medium text-slate-500">Monto generado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.fuente}>
              <td className="px-4 py-2 text-slate-800">{FUENTE_LABELS[row.fuente]}</td>
              <td className="px-4 py-2 text-right text-slate-700">{row.total}</td>
              <td className="px-4 py-2 text-right text-slate-700">{row.porcentaje}%</td>
              <td className="px-4 py-2 text-right text-slate-700">{row.ventas}</td>
              <td className="px-4 py-2 text-right text-slate-700">
                ${row.monto.toLocaleString("es-MX")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
