import { SUCURSAL_LABELS } from "@/lib/catalogs";
import type { Sucursal } from "@prisma/client";
import type { PreviewResult } from "@/lib/excelImport/parseWorkbook";
import { IssueRow } from "./IssueRow";

export function ImportPreviewTable({
  preview,
  overrides,
  onOverrideChange,
  onConfirm,
  confirming,
  importedCount,
}: {
  preview: PreviewResult;
  overrides: Record<number, Sucursal | "exclude">;
  onOverrideChange: (rowIndex: number, value: Sucursal | "exclude") => void;
  onConfirm: () => void;
  confirming: boolean;
  importedCount: number | null;
}) {
  const unresolvedRows = preview.rows.filter((r) => r.sucursal === null);
  const readyCount =
    preview.rows.filter((r) => r.sucursal !== null).length +
    unresolvedRows.filter((r) => overrides[r.rowIndex] && overrides[r.rowIndex] !== "exclude").length;

  return (
    <div className="flex flex-col gap-5">
      {preview.ambiguousCanal && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este archivo tiene columnas separadas de canal (WA/FB/IG/TT) y también una columna de
          canal combinada. Se usaron las columnas separadas.
        </p>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Leads listos por sucursal</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(preview.countsByBranch).map(([sucursal, count]) => (
            <span
              key={sucursal}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {SUCURSAL_LABELS[sucursal as Sucursal]}: {count}
            </span>
          ))}
        </div>
      </div>

      {unresolvedRows.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Filas con sucursal no reconocida ({unresolvedRows.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Fila</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Nombre</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Sucursal en archivo</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Asignar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unresolvedRows.map((row) => (
                  <IssueRow
                    key={row.rowIndex}
                    row={row}
                    value={overrides[row.rowIndex] ?? "exclude"}
                    onChange={(value) => onOverrideChange(row.rowIndex, value)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview.excluded.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Filas excluidas automáticamente ({preview.excluded.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Fila</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.excluded.map((row) => (
                  <tr key={row.rowIndex}>
                    <td className="px-3 py-2 text-slate-700">{row.rowIndex + 1}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {row.reason === "sin-nombre" ? "Sin nombre" : "Sin fecha válida"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onConfirm}
          disabled={confirming || readyCount === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {confirming ? "Importando…" : `Confirmar importación (${readyCount})`}
        </button>
        {importedCount !== null && (
          <span className="text-sm text-green-700">{importedCount} leads importados.</span>
        )}
      </div>
    </div>
  );
}
