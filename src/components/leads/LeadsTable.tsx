"use client";

import Link from "next/link";
import type { Role } from "@prisma/client";
import { EstadoBadge } from "./EstadoBadge";
import { OverdueIndicator } from "./OverdueIndicator";
import { FUENTE_LABELS, SUCURSAL_LABELS } from "@/lib/catalogs";
import { isOverdue } from "@/lib/leadPolicy";
import { formatDateOnly } from "@/lib/dateOnly";
import type { LeadDTO } from "@/lib/types";

const money = (v: string | null) => (v == null ? "" : "$" + Math.round(Number(v)).toLocaleString("es-MX"));
const late = (l: LeadDTO) => isOverdue({ estado: l.estado, proximoSeguimiento: l.proximoSeguimiento ? new Date(l.proximoSeguimiento) : null, createdAt: new Date(l.createdAt) });

/** Vista de lista: una fila por lead, con el nombre y el teléfono debajo. */
export function LeadsTable({ leads, role, onDelete }: { leads: LeadDTO[]; role: Role; onDelete: (id: string) => void }) {
  const coord = role === "coord";
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="min-w-[13rem] px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Interés</th>
              {coord && <th className="px-4 py-3 font-medium">Sucursal</th>}
              <th className="px-4 py-3 font-medium">Fuente</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Próx. seguimiento</th>
              <th className="px-4 py-3 font-medium">Asesor</th>
              <th className="px-4 py-3 text-right font-medium">Monto</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={`/leads/${l.id}`} className="block font-semibold text-slate-900 hover:underline">
                    {l.nombre}
                  </Link>
                  <span className="text-xs text-slate-500">{l.telefono}</span>
                </td>
                <td className="max-w-56 truncate px-4 py-3 text-slate-600">{l.interes || "—"}</td>
                {coord && <td className="whitespace-nowrap px-4 py-3 text-slate-600">{SUCURSAL_LABELS[l.sucursal]}</td>}
                <td className="px-4 py-3 text-slate-600">{FUENTE_LABELS[l.fuente]}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <EstadoBadge estado={l.estado} />
                    {late(l) && <OverdueIndicator />}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{l.proximoSeguimiento && !["VENTA", "PERDIDO"].includes(l.estado) ? formatDateOnly(l.proximoSeguimiento) : "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600" title={l.asesor ?? ""}>
                  {l.asesor ? l.asesor.split(" ").slice(0, 2).join(" ") : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold">{money(l.montoVenta)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <Link href={`/leads/${l.id}`} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
                      Editar
                    </Link>
                    {coord && (
                      <button onClick={() => onDelete(l.id)} className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lista en celular: tarjetas compactas */}
      <ul className="flex flex-col gap-2 md:hidden">
        {leads.map((l) => (
          <li key={l.id}>
            <Link href={`/leads/${l.id}`} className="block rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{l.nombre}</p>
                  <p className="text-xs text-slate-500">{l.telefono}</p>
                </div>
                <EstadoBadge estado={l.estado} />
              </div>
              <p className="mt-1 text-xs text-slate-600">{l.interes || "—"}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  {FUENTE_LABELS[l.fuente]}
                  {coord ? ` · ${SUCURSAL_LABELS[l.sucursal]}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  {late(l) && <OverdueIndicator />}
                  {l.montoVenta && <span className="text-sm font-semibold">{money(l.montoVenta)}</span>}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
