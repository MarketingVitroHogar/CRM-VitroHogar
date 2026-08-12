"use client";

import Link from "next/link";
import type { Role } from "@prisma/client";
import { EstadoBadge } from "./EstadoBadge";
import { OverdueIndicator } from "./OverdueIndicator";
import { FUENTE_LABELS, SUCURSAL_LABELS } from "@/lib/catalogs";
import { isOverdue, round2 } from "@/lib/leadPolicy";
import { formatDateOnly } from "@/lib/dateOnly";
import type { LeadDTO } from "@/lib/types";

const fmt = formatDateOnly;

export function LeadCard({
  lead,
  role,
  showSucursal,
  onDelete,
}: {
  lead: LeadDTO;
  role: Role;
  showSucursal: boolean;
  onDelete: (id: string) => void;
}) {
  const overdue = isOverdue(
    {
      estado: lead.estado,
      proximoSeguimiento: lead.proximoSeguimiento ? new Date(lead.proximoSeguimiento) : null,
      fecha: new Date(lead.fecha),
    },
    new Date()
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{lead.nombre}</p>
          <p className="text-sm text-slate-500">
            {showSucursal ? SUCURSAL_LABELS[lead.sucursal] : lead.telefono}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EstadoBadge estado={lead.estado} />
          {overdue && <OverdueIndicator />}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-3">
        {showSucursal && (
          <div>
            <dt className="text-xs text-slate-400">Teléfono</dt>
            <dd>{lead.telefono}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-slate-400">Fuente</dt>
          <dd>{FUENTE_LABELS[lead.fuente]}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Fecha de ingreso</dt>
          <dd>{fmt(lead.fecha)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Próximo seguimiento</dt>
          <dd>{fmt(lead.proximoSeguimiento)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Responsable</dt>
          <dd>{lead.responsable}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Asesor asignado</dt>
          <dd>{lead.asesor || "—"}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-xs text-slate-400">Interés</dt>
          <dd>{lead.interes || "—"}</dd>
        </div>

        {lead.estado === "COTIZACION" && lead.folioCotizacion && (
          <div>
            <dt className="text-xs text-slate-400">Folio cotización</dt>
            <dd>{lead.folioCotizacion}</dd>
          </div>
        )}
        {lead.estado === "VENTA" && (
          <>
            {lead.folioFactura && (
              <div>
                <dt className="text-xs text-slate-400">Folio factura</dt>
                <dd>{lead.folioFactura}</dd>
              </div>
            )}
            {lead.montoVenta && (
              <div>
                <dt className="text-xs text-slate-400">Monto de venta</dt>
                <dd>${round2(Number(lead.montoVenta)).toLocaleString("es-MX")}</dd>
              </div>
            )}
          </>
        )}
        {(lead.estado === "VENTA" || lead.estado === "PERDIDO") && lead.fechaCierre && (
          <div>
            <dt className="text-xs text-slate-400">Fecha de cierre</dt>
            <dd>{fmt(lead.fechaCierre)}</dd>
          </div>
        )}

        {lead.notas && (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-xs text-slate-400">Notas</dt>
            <dd className="whitespace-pre-wrap">{lead.notas}</dd>
          </div>
        )}
      </dl>

      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <Link
          href={`/leads/${lead.id}`}
          className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Editar
        </Link>
        {role === "coord" && (
          <button
            onClick={() => onDelete(lead.id)}
            className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
