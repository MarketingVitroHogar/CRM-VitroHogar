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
  ESTADOS_HISTORICOS,
  asesoresFor,
} from "@/lib/catalogs";
import { responsableOptionsFor, defaultResponsableFor } from "@/lib/leadPolicy";
import { formatDateOnly } from "@/lib/dateOnly";
import type { LeadDTO } from "@/lib/types";
import { LEADS_CHANGED_EVENT } from "./AsignarDialog";

type FormValues = {
  fecha: string;
  nombre: string;
  telefono: string;
  sucursal: Sucursal;
  interes: string;
  fuente: string;
  estado: string;
  responsable: string;
  asesor: string;
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

// Today in the browser's own local calendar — deliberately NOT
// `new Date().toISOString().slice(0, 10)`, which reads today's UTC date and
// would show tomorrow's date in Mexico for roughly the second half of every
// local day (UTC runs ~6h ahead of Mexico City time).
function todayDateInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayPlusDaysInputValue(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ESTADOS_QUE_REQUIEREN_SEGUIMIENTO = ["CONTACTADO", "COTIZACION", "SEGUIMIENTO"];

function defaultValuesFor(
  lead: LeadDTO | undefined,
  gerenteSucursal: Sucursal | null | undefined,
  role: Role
): FormValues {
  const sucursal = lead?.sucursal ?? gerenteSucursal ?? SUCURSALES[0];
  // Un gerente no puede elegir "Nuevo" (solo Coordinación lo asigna al crear). Si abre un lead
  // que sigue en "Nuevo", el estado queda "" = sin cambio: así puede, por ejemplo, solo asignar
  // un asesor sin que el lead se marque como Contactado por accidente.
  const estado = lead?.estado === "NUEVO" && role === "gerente" ? "" : lead?.estado ?? "NUEVO";
  return {
    fecha: lead ? toDateInputValue(lead.fecha) : todayDateInputValue(),
    nombre: lead?.nombre ?? "",
    telefono: lead?.telefono ?? "",
    sucursal,
    interes: lead?.interes ?? "",
    fuente: lead?.fuente ?? FUENTES[0],
    estado,
    responsable: lead?.responsable ?? defaultResponsableFor(sucursal),
    asesor: lead?.asesor ?? "",
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
  panel = false,
  onSaved,
  onCancel,
  onDirty,
}: {
  mode: "create" | "edit";
  role: Role;
  gerenteSucursal?: Sucursal | null;
  lead?: LeadDTO;
  /** true = se muestra dentro del panel lateral de Leads (una columna; al guardar no cambia de página). */
  panel?: boolean;
  onSaved?: (nombre: string) => void;
  onCancel?: () => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const cols2 = panel ? "" : "sm:grid-cols-2";
  const wide = panel ? "" : "sm:col-span-2";
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue, getValues, formState } = useForm<FormValues>({
    defaultValues: defaultValuesFor(lead, gerenteSucursal, role),
  });

  // Avisa al panel si hay cambios sin guardar (para preguntar antes de cerrarlo).
  const sucio = formState.isDirty;
  useEffect(() => {
    onDirty?.(sucio);
  }, [sucio, onDirty]);

  const isCoord = role === "coord";
  const canEditCoreFields = isCoord; // nombre, telefono, sucursal, fuente, interes, fecha
  const watchedSucursal = watch("sucursal");
  const watchedEstado = watch("estado");
  const watchedResponsable = watch("responsable");
  const watchedAsesor = watch("asesor");

  // Responsable options always match the currently-selected sucursal (coord)
  // or the gerente's own fixed sucursal.
  const responsableOptions = responsableOptionsFor(watchedSucursal);
  const asesorOptions = asesoresFor(watchedSucursal);

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

  // Asesores are also sucursal-specific — a name valid at the old branch
  // isn't necessarily on the new branch's roster, so clear it instead of
  // carrying over a stale/invalid value (there's no sensible default asesor
  // to fall back to, unlike responsable).
  useEffect(() => {
    if (watchedAsesor && !asesorOptions.includes(watchedAsesor)) {
      setValue("asesor", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedSucursal]);

  // Server enforces this too (never trust a client-side default alone), but
  // suggesting it live lets the gerente see and adjust the date before
  // saving, instead of finding out after the fact.
  useEffect(() => {
    if (!ESTADOS_QUE_REQUIEREN_SEGUIMIENTO.includes(watchedEstado)) return;
    if (getValues("proximoSeguimiento")) return;
    setValue("proximoSeguimiento", todayPlusDaysInputValue(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedEstado]);

  const showFolioCotizacion = watchedEstado === "COTIZACION";
  const showVentaFields = watchedEstado === "VENTA";
  const showFechaCierre = watchedEstado === "VENTA" || watchedEstado === "PERDIDO";

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    setSubmitting(true);

    const basePayload: Record<string, unknown> = {
      ...(values.estado ? { estado: values.estado } : {}),
      responsable: values.responsable,
      proximoSeguimiento: values.proximoSeguimiento || null,
      notas: values.notas,
      folioCotizacion: values.folioCotizacion || null,
      folioFactura: values.folioFactura || null,
      montoVenta: values.montoVenta === "" ? null : Number(values.montoVenta),
      fechaCierre: values.fechaCierre || null,
    };

    // El asesor lo asigna solo el gerente; Coordinación no lo envía.
    if (!isCoord) basePayload.asesor = values.asesor || null;

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

      if (onSaved) {
        // Dentro del panel: se actualiza la lista de Leads (sola) y el panel se cierra.
        try {
          window.dispatchEvent(new Event(LEADS_CHANGED_EVENT));
        } catch {
          /* ignorar */
        }
        setSubmitting(false);
        onSaved(values.nombre);
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
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-slate-100 disabled:text-slate-500";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {!canEditCoreFields && lead && (
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-base font-semibold text-slate-900">{lead.nombre}</p>
          <p className="mt-0.5 text-sm">
            <a href={`tel:${lead.telefono.replace(/[^0-9+]/g, "")}`} className="font-medium text-brand underline">
              {lead.telefono}
            </a>
          </p>
          <p className="mt-2 text-sm text-slate-700">{lead.interes || "Sin interés indicado"}</p>
          <p className="mt-2 text-xs text-slate-500">
            {FUENTE_LABELS[lead.fuente as keyof typeof FUENTE_LABELS] ?? lead.fuente} · ingresó el {formatDateOnly(lead.fecha)} · {SUCURSAL_LABELS[lead.sucursal]}
          </p>
        </div>
      )}

      {!canEditCoreFields && lead && !lead.asesor && lead.estado !== "VENTA" && lead.estado !== "PERDIDO" && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900" role="status">
          Este lead aún no tiene asesor. Elige uno en “Asesor asignado” y guarda.
        </p>
      )}

      {canEditCoreFields && (
      <div className={`grid grid-cols-1 gap-4 ${cols2}`}>
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
            {(lead && !FUENTES.includes(lead.fuente) ? [...FUENTES, lead.fuente] : FUENTES).map((f) => (
              <option key={f} value={f}>
                {FUENTE_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        <div className={wide}>
          <label className={labelClass}>Interés (qué busca el cliente)</label>
          <input
            type="text"
            className={inputClass}
            disabled={!canEditCoreFields}
            {...register("interes")}
          />
        </div>
      </div>
      )}

      {canEditCoreFields && <hr className="border-slate-200" />}

      <div className={`grid grid-cols-1 gap-4 ${cols2}`}>
        <div>
          <label className={labelClass}>Estado</label>
          <select className={inputClass} {...register("estado")}>
            {!isCoord && lead?.estado === "NUEVO" && <option value="">Sin cambio (sigue en Nuevo)</option>}
            {[...ESTADOS, ...ESTADOS_HISTORICOS.filter((h) => h === lead?.estado)].map((e) => (
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

        {isCoord ? (
          <div>
            <label className={labelClass}>Asesor asignado</label>
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{lead?.asesor || "Sin asignar"}</p>
            <p className="mt-1 text-xs text-slate-400">Lo asigna el gerente de la sucursal.</p>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Asesor asignado</label>
            <select className={inputClass + (lead && !lead.asesor ? " border-amber-400 ring-1 ring-amber-300" : "")} {...register("asesor")}>
              <option value="">— Sin asignar —</option>
              {asesorOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            {asesorOptions.length === 0 && <p className="mt-1 text-xs text-slate-400">Esta sucursal aún no tiene asesores registrados.</p>}
          </div>
        )}

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

        <div className={wide}>
          <label className={labelClass}>Notas</label>
          <textarea rows={3} className={inputClass} {...register("notas")} />
        </div>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <div className={panel ? "sticky bottom-0 -mx-4 flex gap-2 border-t border-slate-200 bg-white px-4 py-3" : "flex gap-3"}>
        <button
          type="submit"
          disabled={submitting || formState.isSubmitting}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => (onCancel ? onCancel() : router.push("/leads"))}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
