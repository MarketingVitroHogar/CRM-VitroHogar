"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import type { Role, Sucursal } from "@prisma/client";
import {
  SUCURSALES,
  SUCURSAL_LABELS,
  FUENTES,
  FUENTE_LABELS,
  ESTADOS,
  ESTADO_LABELS,
} from "@/lib/catalogs";
import { responsableOptionsFor, defaultResponsableFor } from "@/lib/leadPolicy";
import type { LeadDTO } from "@/lib/types";

type FormValues = {
  fecha: string;
  nombre: string;
  telefono: string;
  sucursal: Sucursal;
  interes: string;
  fuente: string;
  estado: string;
  responsable: string;
  proximoSeguimiento: string;
  notas: string;
  folioCotizacion: string;
  folioFactura: string;
  montoVenta: string;
  fechaCierre: string;
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function defaultValuesFor(
  lead: LeadDTO | undefined,
  gerenteSucursal: Sucursal | null | undefined,
  role: Role
): FormValues {
  const sucursal = lead?.sucursal ?? gerenteSucursal ?? SUCURSALES[0];
  // A gerente can never leave/select "Nuevo" (only coord assigns it at
  // creation), so if a gerente opens a still-"Nuevo" lead, default the form
  // to "Contactado" — the natural first real transition — rather than a
  // disabled value that would fail validation on an untouched save.
  const estado = lead?.estado === "NUEVO" && role === "gerente" ? "CONTACTADO" : lead?.estado ?? "NUEVO";
  return {
    fecha: lead ? toDateInputValue(lead.fecha) : toDateInputValue(new Date().toISOString()),
    nombre: lead?.nombre ?? "",
    telefono: lead?.telefono ?? "",
    sucursal,
    interes: lead?.interes ?? "",
    fuente: lead?.fuente ?? FUENTES[0],
    estado,
    responsable: lead?.responsable ?? defaultResponsableFor(sucursal),
    proximoSeguimiento: toDateInputValue(lead?.proximoSeguimiento ?? null),
    notas: lead?.notas ?? "",
    folioCotizacion: lead?.folioCotizacion ?? "",
    folioFactura: lead?.folioFactura ?? "",
    montoVenta: lead?.montoVenta ?? "",
    fechaCierre: toDateInputValue(lead?.fechaCierre ?? null),
  };
}

export function LeadForm({
  mode,
  role,
  gerenteSucursal,
  lead,
}: {
  mode: "create" | "edit";
  role: Role;
  gerenteSucursal?: Sucursal | null;
  lead?: LeadDTO;
}) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    defaultValues: defaultValuesFor(lead, gerenteSucursal, role),
  });

  const isCoord = role === "coord";
  const canEditCoreFields = isCoord; // nombre, telefono, sucursal, fuente, interes, fecha
  const watchedSucursal = watch("sucursal");
  const watchedEstado = watch("estado");
  const watchedResponsable = watch("responsable");

  // Responsable options always match the currently-selected sucursal (coord)
  // or the gerente's own fixed sucursal.
  const responsableOptions = responsableOptionsFor(watchedSucursal);

  // Per spec: if coord changes sucursal, auto-reassign responsable to the new
  // branch's gerente unless the user already picked CM/Coordinador manually,
  // which they can still do afterwards.
  useEffect(() => {
    if (!isCoord) return;
    if (!responsableOptions.includes(watchedResponsable)) {
      setValue("responsable", defaultResponsableFor(watchedSucursal));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedSucursal]);

  const showFolioCotizacion = watchedEstado === "COTIZACION";
  const showVentaFields = watchedEstado === "VENTA";
  const showFechaCierre = watchedEstado === "VENTA" || watchedEstado === "PERDIDO";

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    setSubmitting(true);

    const basePayload: Record<string, unknown> = {
      estado: values.estado,
      responsable: values.responsable,
      proximoSeguimiento: values.proximoSeguimiento || null,
      notas: values.notas,
      folioCotizacion: values.folioCotizacion || null,
      folioFactura: values.folioFactura || null,
      montoVenta: values.montoVenta === "" ? null : Number(values.montoVenta),
      fechaCierre: values.fechaCierre || null,
    };

    const payload = canEditCoreFields
      ? {
          ...basePayload,
          fecha: values.fecha,
          nombre: values.nombre,
          telefono: values.telefono,
          sucursal: values.sucursal,
          interes: values.interes,
          fuente: values.fuente,
        }
      : basePayload;

    const url = mode === "create" ? "/api/leads" : `/api/leads/${lead!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.error === "string"
            ? body.error
            : "No se pudo guardar el lead. Verifica los campos.";
        setSubmitError(message);
        setSubmitting(false);
        return;
      }

      router.push("/leads");
      router.refresh();
    } catch {
      setSubmitError("Error de red al guardar el lead.");
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Fecha de ingreso</label>
          <input
            type="date"
            className={inputClass}
            disabled={!canEditCoreFields}
            {...register("fecha", { required: true })}
          />
        </div>

        <div>
          <label className={labelClass}>Sucursal</label>
          <select className={inputClass} disabled={!canEditCoreFields} {...register("sucursal")}>
            {SUCURSALES.map((s) => (
              <option key={s} value={s}>
                {SUCURSAL_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Nombre</label>
          <input
            type="text"
            className={inputClass}
            disabled={!canEditCoreFields}
            {...register("nombre", { required: true })}
          />
        </div>

        <div>
          <label className={labelClass}>Teléfono</label>
          <input
            type="text"
            className={inputClass}
            disabled={!canEditCoreFields}
            {...register("telefono", { required: true })}
          />
        </div>

        <div>
          <label className={labelClass}>Fuente</label>
          <select className={inputClass} disabled={!canEditCoreFields} {...register("fuente")}>
            {FUENTES.map((f) => (
              <option key={f} value={f}>
                {FUENTE_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Interés (qué busca el cliente)</label>
          <input
            type="text"
            className={inputClass}
            disabled={!canEditCoreFields}
            {...register("interes")}
          />
        </div>
      </div>

      <hr className="border-slate-200" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Estado</label>
          <select className={inputClass} {...register("estado")}>
            {ESTADOS.map((e) => (
              <option key={e} value={e} disabled={e === "NUEVO" && !isCoord}>
                {ESTADO_LABELS[e]}
              </option>
            ))}
          </select>
          {!isCoord && (
            <p className="mt-1 text-xs text-slate-400">
              El estado &quot;Nuevo&quot; solo puede asignarlo Coordinador/CM.
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Responsable</label>
          <select className={inputClass} {...register("responsable")}>
            {responsableOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Próximo seguimiento</label>
          <input type="date" className={inputClass} {...register("proximoSeguimiento")} />
        </div>

        {showFolioCotizacion && (
          <div>
            <label className={labelClass}>Folio de cotización</label>
            <input type="text" className={inputClass} {...register("folioCotizacion")} />
          </div>
        )}

        {showVentaFields && (
          <>
            <div>
              <label className={labelClass}>Folio de factura</label>
              <input type="text" className={inputClass} {...register("folioFactura")} />
            </div>
            <div>
              <label className={labelClass}>Monto de venta</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                {...register("montoVenta")}
              />
            </div>
          </>
        )}

        {showFechaCierre && (
          <div>
            <label className={labelClass}>
              Fecha de cierre <span className="text-xs text-slate-400">(vacío = hoy)</span>
            </label>
            <input type="date" className={inputClass} {...register("fechaCierre")} />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={labelClass}>Notas</label>
          <textarea rows={3} className={inputClass} {...register("notas")} />
        </div>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || formState.isSubmitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {submitting ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/leads")}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
