import { SUCURSAL_LABELS } from "@/lib/catalogs";
import type { Sucursal } from "@prisma/client";
import { EstadoVacio } from "@/components/ui/EstadoVacio";

export type SucursalRow = {
  sucursal: Sucursal;
  total: number;
  ventas: number;
  montoVendido: number;
};

export function SucursalBreakdownTable({ rows }: { rows: SucursalRow[] }) {
  if (rows.length === 0) {
    return <EstadoVacio compact icono="grafica" titulo="Sin datos en este periodo" texto="Prueba con otro periodo." />;
  }

  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_var(--color-slate-200)]">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium text-slate-500">Sucursal</th>
            <th className="px-3 py-1.5 text-right font-medium text-slate-500">Leads</th>
            <th className="px-3 py-1.5 text-right font-medium text-slate-500">Ventas</th>
            <th className="px-3 py-1.5 text-right font-medium text-slate-500">Monto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.sucursal}>
              <td className="px-3 py-1.5 text-slate-800">{SUCURSAL_LABELS[row.sucursal]}</td>
              <td className="px-3 py-1.5 text-right text-slate-700">{row.total}</td>
              <td className="px-3 py-1.5 text-right text-slate-700">{row.ventas}</td>
              <td className="px-3 py-1.5 text-right text-slate-700">
                ${row.montoVendido.toLocaleString("es-MX")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
