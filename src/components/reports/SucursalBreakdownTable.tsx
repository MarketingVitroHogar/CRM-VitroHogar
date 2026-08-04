import { SUCURSAL_LABELS } from "@/lib/catalogs";
import type { Sucursal } from "@prisma/client";

export type SucursalRow = {
  sucursal: Sucursal;
  total: number;
  ventas: number;
  montoVendido: number;
};

export function SucursalBreakdownTable({ rows }: { rows: SucursalRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Sin datos para este periodo.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-slate-500">Sucursal</th>
            <th className="px-4 py-2 text-right font-medium text-slate-500">Leads</th>
            <th className="px-4 py-2 text-right font-medium text-slate-500">Ventas</th>
            <th className="px-4 py-2 text-right font-medium text-slate-500">Monto de venta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.sucursal}>
              <td className="px-4 py-2 text-slate-800">{SUCURSAL_LABELS[row.sucursal]}</td>
              <td className="px-4 py-2 text-right text-slate-700">{row.total}</td>
              <td className="px-4 py-2 text-right text-slate-700">{row.ventas}</td>
              <td className="px-4 py-2 text-right text-slate-700">
                ${row.montoVendido.toLocaleString("es-MX")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
