"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Fuente, Sucursal } from "@prisma/client";
import { FUENTES, FUENTE_LABELS, SUCURSALES, SUCURSAL_LABELS, ESTADO_LABELS, asesoresFor } from "@/lib/catalogs";
import { puedeAsignarAsesor } from "@/lib/asignacion";
import { formatDateOnly } from "@/lib/dateOnly";
import { formatTelefono, soloDigitos, telefonoValido } from "@/lib/telefono";
import { useToast } from "@/components/ui/Toast";
import { LEADS_CHANGED_EVENT } from "./AsignarDialog";

type Dup = { id: string; nombre: string; telefono: string; sucursal: Sucursal; estado: string; fecha: string };

const STORAGE_KEY = "crm:alta-ultimos"; // último canal y sucursal usados
const input =
  "min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:min-h-10 sm:text-sm";
const label = "mb-1 block text-sm font-medium text-slate-700";

/**
 * Alta rápida de un lead (solo Coordinación): nombre, teléfono, interés, canal y sucursal.
 * Todo lo demás se completa solo: fecha de hoy, estado "Nuevo" y responsable = gerente de la sucursal.
 * El asesor lo asigna el gerente de la sucursal; solo en Tienda en línea también se puede elegir aquí (o después).
 */
export function NewLeadForm({
  panel = false,
  onSaved,
  onCancel,
  onDirty,
}: {
  /** true = se muestra dentro del panel lateral de Leads (una columna, sin cambiar de página). */
  panel?: boolean;
  onSaved?: (nombre: string, sucursal: Sucursal, otro: boolean) => void;
  onCancel?: () => void;
  onDirty?: (dirty: boolean) => void;
} = {}) {
  const cols2 = panel ? "" : "sm:grid-cols-2";
  const wide = panel ? "" : "sm:col-span-2";
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const nombreRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [interes, setInteres] = useState("");
  const [fuente, setFuente] = useState<Fuente | "">("");
  const [sucursal, setSucursal] = useState<Sucursal | "">("");
  const [asesor, setAsesor] = useState("");
  const [notas, setNotas] = useState("");
  const [fecha, setFecha] = useState("");
  const [masOpciones, setMasOpciones] = useState(false);
  const [dups, setDups] = useState<Dup[]>([]);
  const [confirmDup, setConfirmDup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "uno" | "otro">(null);

  // Recuerda el último canal y sucursal: si cargas varios leads seguidos, no los eliges cada vez.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada en el navegador (solo cliente)
      if (saved?.fuente && (FUENTES as string[]).includes(saved.fuente)) setFuente(saved.fuente);
      if (saved?.sucursal && (SUCURSALES as string[]).includes(saved.sucursal)) setSucursal(saved.sucursal);
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  // Avisa al panel si hay datos escritos (para preguntar antes de cerrarlo).
  useEffect(() => {
    onDirty?.(nombre.trim() !== "" || telefono !== "" || interes.trim() !== "");
  }, [nombre, telefono, interes, onDirty]);

  // Aviso de teléfono repetido, mientras se escribe (con 10 dígitos o más).
  useEffect(() => {
    if (!telefonoValido(telefono)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se limpia el aviso si el número deja de ser válido
      setDups([]);
      return;
    }
    let ignore = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads/duplicados?telefono=${encodeURIComponent(telefono)}`);
        const data = res.ok ? await res.json() : { duplicados: [] };
        if (!ignore) {
          setDups(data.duplicados ?? []);
          setConfirmDup(false);
        }
      } catch {
        if (!ignore) setDups([]);
      }
    }, 350);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [telefono]);

  async function save(otro: boolean) {
    setError(null);
    if (nombre.trim().length < 2) return setError("Escribe el nombre del cliente.");
    if (!telefonoValido(telefono)) return setError("El teléfono debe tener 10 dígitos.");
    if (!fuente) return setError("Elige el canal por el que llegó el lead.");
    if (!sucursal) return setError("Elige la sucursal a la que se asigna.");
    if (dups.length > 0 && !confirmDup) return setError("Ya hay un lead con este teléfono. Revisa el aviso y marca “Es otro cliente” para guardarlo.");

    setSaving(otro ? "otro" : "uno");
    try {
      const body: Record<string, unknown> = { nombre: nombre.trim(), telefono: formatTelefono(telefono), interes: interes.trim(), fuente, sucursal };
      if (notas.trim()) body.notas = notas.trim();
      if (fecha) body.fecha = fecha;
      if (asesor && puedeAsignarAsesor("coord", sucursal)) body.asesor = asesor;
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const flat = data?.error?.fieldErrors ? Object.values(data.error.fieldErrors).flat()[0] : null;
        setError(typeof data?.error === "string" ? data.error : typeof flat === "string" ? flat : "No se pudo guardar el lead. Revisa los datos.");
        setSaving(null);
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ fuente, sucursal }));
      } catch {
        /* ignorar */
      }
      try {
        window.dispatchEvent(new Event(LEADS_CHANGED_EVENT)); // la lista de Leads se actualiza sola
      } catch {
        /* ignorar */
      }
      const guardado = nombre.trim();
      if (otro) {
        if (onSaved) onSaved(guardado, sucursal, true);
        else toast(`✓ Lead guardado: ${guardado} · ${SUCURSAL_LABELS[sucursal]}`);
        setNombre("");
        setTelefono("");
        setInteres("");
        setAsesor("");
        setNotas("");
        setFecha("");
        setDups([]);
        setConfirmDup(false);
        setSaving(null);
        nombreRef.current?.focus();
        if (!onSaved) router.refresh();
      } else if (onSaved) {
        onSaved(guardado, sucursal, false);
      } else {
        router.push("/leads");
        router.refresh();
      }
    } catch {
      setError("Error de red al guardar el lead.");
      setSaving(null);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
      className="flex flex-col gap-5"
      autoComplete="off"
    >
      <div className={`grid grid-cols-1 gap-4 ${cols2}`}>
        <div>
          <label htmlFor="nl-nombre" className={label}>
            Nombre
          </label>
          <input id="nl-nombre" ref={nombreRef} autoFocus className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. María López" />
        </div>
        <div>
          <label htmlFor="nl-tel" className={label}>
            Teléfono
          </label>
          <input
            id="nl-tel"
            type="tel"
            inputMode="tel"
            className={input}
            value={telefono}
            onChange={(e) => setTelefono(formatTelefono(e.target.value))}
            placeholder="492 123 4567"
            aria-invalid={telefono !== "" && !telefonoValido(telefono)}
          />
          {telefono !== "" && !telefonoValido(telefono) && <p className="mt-1 text-xs text-slate-500">{10 - soloDigitos(telefono).length} dígitos más…</p>}
        </div>

        {dups.length > 0 && (
          <div className={`rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm ${wide}`} role="alert">
            <p className="font-semibold text-amber-900">Ya existe un lead con este teléfono:</p>
            <ul className="mt-1 flex flex-col gap-1">
              {dups.map((d) => (
                <li key={d.id} className="text-amber-900">
                  <a href={`/leads/${d.id}`} target="_blank" rel="noreferrer" className="font-medium underline">
                    {d.nombre}
                  </a>{" "}
                  · {SUCURSAL_LABELS[d.sucursal]} · {ESTADO_LABELS[d.estado as keyof typeof ESTADO_LABELS] ?? d.estado} · ingresó {formatDateOnly(d.fecha)}
                </li>
              ))}
            </ul>
            <label className="mt-2 flex min-h-10 cursor-pointer items-center gap-2 text-amber-900">
              <input type="checkbox" checked={confirmDup} onChange={(e) => setConfirmDup(e.target.checked)} className="h-4 w-4" />
              Es otro cliente, guardar de todos modos
            </label>
          </div>
        )}

        <div className={wide}>
          <label htmlFor="nl-int" className={label}>
            Interés <span className="font-normal text-slate-400">(qué busca el cliente)</span>
          </label>
          <input id="nl-int" className={input} value={interes} onChange={(e) => setInteres(e.target.value)} placeholder="Ej. Piso laminado para recámaras" />
        </div>

        <div>
          <label htmlFor="nl-canal" className={label}>
            Canal de llegada
          </label>
          <select id="nl-canal" className={input} value={fuente} onChange={(e) => setFuente(e.target.value as Fuente)}>
            <option value="">Elige el canal…</option>
            {FUENTES.map((f) => (
              <option key={f} value={f}>
                {FUENTE_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="nl-suc" className={label}>
            Sucursal a la que se asigna
          </label>
          <select
            id="nl-suc"
            className={input}
            value={sucursal}
            onChange={(e) => {
              setSucursal(e.target.value as Sucursal);
              setAsesor(""); // el asesor depende de la sucursal
            }}
          >
            <option value="">Elige la sucursal…</option>
            {SUCURSALES.map((s) => (
              <option key={s} value={s}>
                {SUCURSAL_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {/* Solo en Tienda en línea: Coordinación puede elegir el asesor desde el alta */}
        {sucursal && puedeAsignarAsesor("coord", sucursal) && (
          <div className={wide}>
            <label htmlFor="nl-asesor" className={label}>
              Asesor <span className="font-normal text-slate-400">(opcional; también puedes asignarlo después)</span>
            </label>
            <select id="nl-asesor" className={input} value={asesor} onChange={(e) => setAsesor(e.target.value)}>
              <option value="">— Sin asignar por ahora —</option>
              {asesoresFor(sucursal).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <p className="-mt-1 text-xs text-slate-500">
        Entra como <b>Nuevo</b>, con la fecha de hoy y el gerente de la sucursal como responsable.{" "}
        {sucursal && puedeAsignarAsesor("coord", sucursal) ? "En Tienda en línea puedes asignarle asesor ahora o después." : "El gerente le asigna asesor."}
      </p>

      <div>
        <button type="button" onClick={() => setMasOpciones((v) => !v)} aria-expanded={masOpciones} className="min-h-10 text-sm font-semibold text-brand hover:underline">
          {masOpciones ? "▾ Menos opciones" : "▸ Más opciones (notas, fecha)"}
        </button>
        {masOpciones && (
          <div className={`mt-2 grid grid-cols-1 gap-4 rounded-lg bg-slate-50 p-4 ${cols2}`}>
            <div>
              <label htmlFor="nl-fecha" className={label}>
                Fecha de ingreso <span className="font-normal text-slate-400">(vacío = hoy)</span>
              </label>
              <input id="nl-fecha" type="date" className={input} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className={wide}>
              <label htmlFor="nl-notas" className={label}>
                Notas
              </label>
              <textarea id="nl-notas" rows={2} className={input} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Algo que el gerente deba saber" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Acciones: quedan a la vista en celular */}
      <div
        className={
          panel
            ? "sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t border-slate-200 bg-white px-4 py-3"
            : "sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0"
        }
      >
        <button type="submit" disabled={saving !== null} className="min-h-11 flex-1 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60 sm:flex-none">
          {saving === "uno" ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          disabled={saving !== null}
          onClick={() => void save(true)}
          className="min-h-11 flex-1 rounded-md border border-brand bg-white px-5 py-2 text-sm font-semibold text-brand hover:bg-red-50 disabled:opacity-60 sm:flex-none"
        >
          {saving === "otro" ? "Guardando…" : "Guardar y cargar otro"}
        </button>
        {!panel && (
          <button type="button" onClick={() => (onCancel ? onCancel() : router.push("/leads"))} className="min-h-11 rounded-md bg-slate-100 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Cancelar
          </button>
        )}
      </div>
      {toastNode}
    </form>
  );
}
