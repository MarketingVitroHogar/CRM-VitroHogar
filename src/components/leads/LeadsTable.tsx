"use client";

import Link from "next/link";
import type { Role } from "@prisma/client";
import { EstadoBadge } from "./EstadoBadge";
import { OverdueIndicator } from "./OverdueIndicator";
import { FUENTE_LABELS, SUCURSAL_LABELS } from "@/lib/catalogs";
import { isOverdue } from "@/lib/leadPolicy";
import { formatDateOnly } from "@/lib/dateOnly";
import { clicSimple } from "@/lib/abrirEnPanel";
import { haceTiempo } from "@/lib/tiempo";
import type { LeadDTO } from "@/lib/types";

const money = (v: string | null) => (v == null ? "" : "$" + Math.round(Number(v)).toLocaleString("es-MX"));
const cerrado = (l: LeadDTO) => l.estado === "VENTA" || l.estado === "PERDIDO";
const late = (l: LeadDTO) => isOverdue({ estado: l.estado, proximoSeguimiento: l.proximoSeguimiento ? new Date(l.proximoSeguimiento) : null, createdAt: new Date(l.createdAt) });

/** Vista de lista: una fila por lead, con el nombre y el teléfono debajo. */
export function LeadsTable({ leads, role, onDelete, onAssign, onEdit }: { leads: LeadDTO[]; role: Role; onDelete: (id: string) => void; onAssign: (lead: LeadDTO) => void; onEdit: (id: string) => void }) {
  // Clic normal = panel lateral; Ctrl/Cmd/Shift/clic medio = ficha completa en otra pestaña.
  const abrir = (e: React.MouseEvent, id: string) => {
    if (clicSimple(e)) {
      e.preventDefault();
      onEdit(id);
    }
  };
  const coord = role === "coord";
  const gerente = role === "gerente"; // solo el gerente asigna asesor
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2.5 py-2.5 font-medium">Cliente</th>
              <th className="hidden px-2.5 py-2.5 font-medium xl:table-cell">Interés</th>
              {coord && <th className="px-2.5 py-2.5 font-medium">Sucursal</th>}
              <th className="px-2.5 py-2.5 font-medium">Fuente</th>
              <th className="px-2.5 py-2.5 font-medium">Estado</th>
              <th className="px-2.5 py-2.5 font-medium">Seguimiento</th>
              <th className="px-2.5 py-2.5 font-medium">Asesor</th>
              <th className="px-2.5 py-2.5 text-right font-medium">Monto</th>
              {/* Acciones: siempre a la vista (se quedan pegadas a la derecha aunque la tabla se desplace) */}
              <th className="sticky right-0 bg-slate-50 px-2.5 py-2.5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr key={l.id} className="group hover:bg-slate-50">
                <td className="px-2.5 py-2">
                  <Link href={`/leads/${l.id}`} onClick={(e) => abrir(e, l.id)} className="block max-w-[11rem] truncate font-semibold text-slate-900 hover:underline" title={l.nombre}>
                    {l.nombre}
                  </Link>
                  <span className="block text-xs text-slate-500">
                    {l.telefono}
                    {!cerrado(l) && (
                      <span title={`Ingresó el ${formatDateOnly(l.fecha, "d MMM yyyy")}`}> · {haceTiempo(l.fecha, l.createdAt)}</span>
                    )}
                  </span>
                </td>
                <td className="hidden px-2.5 py-2 xl:table-cell">
                  <div className="max-w-44 truncate text-slate-600" title={l.interes}>
                    {l.interes || "—"}
                  </div>
                </td>
                {coord && (
                  <td className="px-2.5 py-2 text-slate-600">
                    <div className="max-w-28 truncate" title={SUCURSAL_LABELS[l.sucursal]}>
                      {SUCURSAL_LABELS[l.sucursal]}
                    </div>
                  </td>
                )}
                <td className="px-2.5 py-2 text-slate-600">
                  <div className="max-w-24 truncate" title={FUENTE_LABELS[l.fuente]}>
                    {FUENTE_LABELS[l.fuente]}
                  </div>
                </td>
                <td className="px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <EstadoBadge estado={l.estado} />
                    {late(l) && <OverdueIndicator compact />}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-slate-600">{l.proximoSeguimiento && !["VENTA", "PERDIDO"].includes(l.estado) ? formatDateOnly(l.proximoSeguimiento, "d MMM") : "—"}</td>
                <td className="px-2.5 py-2 text-slate-600">
                  {l.asesor ? (
                    <div className="max-w-32 truncate" title={l.asesor}>
                      {l.asesor.split(" ").slice(0, 2).join(" ")}
                    </div>
                  ) : cerrado(l) || !gerente ? (
                    "—"
                  ) : (
                    <button onClick={() => onAssign(l)} className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark">
                      Asignar
                    </button>
                  )}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-right font-semibold">{money(l.montoVenta)}</td>
                <td className="sticky right-0 bg-white px-2.5 py-2 group-hover:bg-slate-50">
                  <div className="flex justify-end gap-1.5">
                    <Link
                      href={`/leads/${l.id}`}
                      onClick={(e) => abrir(e, l.id)}
                      title="Editar"
                      aria-label={`Editar ${l.nombre}`}
                      className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                    </Link>
                    {coord && (
                      <button
                        onClick={() => onDelete(l.id)}
                        title="Eliminar"
                        aria-label={`Eliminar ${l.nombre}`}
                        className="grid h-8 w-8 place-items-center rounded-md bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
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
          <li key={l.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Link href={`/leads/${l.id}`} onClick={(e) => abrir(e, l.id)} className="block p-3">
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
                  {!cerrado(l) && ` · ${haceTiempo(l.fecha, l.createdAt)}`}
                </span>
                <span className="flex items-center gap-2">
                  {late(l) && <OverdueIndicator />}
                  {l.montoVenta && <span className="text-sm font-semibold">{money(l.montoVenta)}</span>}
                </span>
              </div>
            </Link>
            {!l.asesor && !cerrado(l) && gerente && (
              <button onClick={() => onAssign(l)} className="min-h-11 w-full border-t border-slate-100 bg-red-50 text-sm font-semibold text-brand hover:bg-red-100">
                Asignar asesor
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
