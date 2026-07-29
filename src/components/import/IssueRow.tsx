import { SUCURSALES, SUCURSAL_LABELS } from "@/lib/catalogs";
import type { Sucursal } from "@prisma/client";
import type { StagedRow } from "@/lib/excelImport/parseWorkbook";

export function IssueRow({
  row,
  value,
  onChange,
}: {
  row: StagedRow;
  value: Sucursal | "exclude";
  onChange: (value: Sucursal | "exclude") => void;
}) {
  return (
    <tr>
      <td className="px-3 py-2 text-slate-700">{row.rowIndex + 1}</td>
      <td className="px-3 py-2 text-slate-700">{row.nombre}</td>
      <td className="px-3 py-2 text-slate-500">&quot;{row.sucursalRaw}&quot; (no reconocida)</td>
      <td className="px-3 py-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as Sucursal | "exclude")}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="exclude">Excluir esta fila</option>
          {SUCURSALES.map((s) => (
            <option key={s} value={s}>
              {SUCURSAL_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
