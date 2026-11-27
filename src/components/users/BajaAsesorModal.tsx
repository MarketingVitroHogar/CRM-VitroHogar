"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Estado, Sucursal } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { ESTADO_LABELS, SUCURSAL_LABELS } from "@/lib/catalogs";

export type AsesorRow = {
  id: string;
  sucursal: Sucursal;
  nombre: string;
  activo: boolean;
  leads: number;
  usuario: string | null;
  usuarioActivo: boolean | null;
};

type Fila = { mes: string; estado: string; mueve: boolean; n: number };
type Preview = {
  asesor: string;
  reemplazo: string | null;
  reemplazoEsNuevo: boolean;
  total: number;
  aMover: number;
  seQuedan: number;
  filas: Fila[];
  cuenta: { username: string; activo: boolean } | null;
};

const btn = "min-h-9 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";
const input = "min-h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const NUEVO = "__nuevo__";

async function call(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo completar la acción");
  return data;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mesLabel = (mes: string) => new Date(`${mes}-15T12:00:00`).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Resume una lista de filas por estado: "3 Contactado, 1 Venta". */
function porEstado(filas: Fila[]): string {
  const m = new Map<string, number>();
  for (const f of filas) m.set(f.estado, (m.get(f.estado) ?? 0) + f.n);
  return [...m.entries()].map(([e, n]) => `${n} ${ESTADO_LABELS[e as Estado] ?? e}`).join(", ");
}

/**
 * Dar de baja a un asesor (solo Coordinación): quién lo sustituye (existente o nuevo, opcional) y qué pasa con sus leads
 * (ninguno -> histórico; o los de un periodo / solo los abiertos pasan al reemplazo). Primero se muestra una vista previa.
 */
export function BajaAsesorModal({
  asesor,
  companeros,
  onClose,
  onDone,
}: {
  asesor: AsesorRow;
  companeros: AsesorRow[];
  onClose: () => void;
  onDone: (mensaje: string) => void | Promise<void>;
}) {
  const [reemplazo, setReemplazo] = useState(""); // "" = nadie; id; o NUEVO
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [traspasar, setTraspasar] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tieneReemplazo = reemplazo === NUEVO ? nuevoNombre.trim().length >= 2 : reemplazo !== "";
  const nombreReemplazo = reemplazo === NUEVO ? nuevoNombre.trim() : companeros.find((c) => c.id === reemplazo)?.nombre ?? "";
  const traspasa = traspasar && tieneReemplazo;

  const cuerpo = useMemo(
    () => ({
      traspasar: traspasa,
      ...(reemplazo === NUEVO ? (nuevoNombre.trim() ? { reemplazoNuevo: nuevoNombre.trim() } : {}) : reemplazo ? { reemplazoId: reemplazo } : {}),
      ...(traspasa && desde ? { desde } : {}),
      ...(traspasa && hasta ? { hasta } : {}),
      soloAbiertos: traspasa && soloAbiertos,
    }),
    [traspasa, reemplazo, nuevoNombre, desde, hasta, soloAbiertos]
  );

  function esteMes() {
    const hoy = new Date();
    setDesde(ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
    setHasta(ymd(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)));
  }

  async function revisar() {
    setBusy(true);
    setError(null);
    try {
      setPreview((await call(`/api/asesores/${asesor.id}/baja`, { ...cuerpo, confirmar: false })) as Preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo revisar");
    } finally {
      setBusy(false);
    }
  }

  async function confirmar() {
    setBusy(true);
    setError(null);
    try {
      const r = await call(`/api/asesores/${asesor.id}/baja`, { ...cuerpo, confirmar: true });
      const partes = [`${asesor.nombre} dado de baja.`];
      if (r.traspasados > 0) partes.push(`${plural(r.traspasados, "lead pasó", "leads pasaron")} a ${r.reemplazo}.`);
      if (r.seQuedan > 0) partes.push(`${plural(r.seQuedan, "lead se quedó", "leads se quedaron")} a su nombre como histórico.`);
      if (r.cuentaDesactivada) partes.push("Su usuario quedó desactivado.");
      await onDone(partes.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo dar de baja");
      setBusy(false);
    }
  }

  // ---- Vista previa agrupada por mes ----
  const meses = useMemo(() => {
    if (!preview) return [];
    const m = new Map<string, { mueven: Fila[]; quedan: Fila[] }>();
    for (const f of preview.filas) {
      const x = m.get(f.mes) ?? { mueven: [], quedan: [] };
      (f.mueve ? x.mueven : x.quedan).push(f);
      m.set(f.mes, x);
    }
    return [...m.entries()].map(([mes, x]) => ({ mes, mueven: x.mueven, quedan: x.quedan, nMueven: x.mueven.reduce((s, f) => s + f.n, 0), nQuedan: x.quedan.reduce((s, f) => s + f.n, 0) }));
  }, [preview]);

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={`Dar de baja a ${asesor.nombre}`} icon="👤">
      <p className="text-sm text-slate-500">
        {SUCURSAL_LABELS[asesor.sucursal]} · {asesor.leads === 0 ? "sin leads asignados" : plural(asesor.leads, "lead a su nombre", "leads a su nombre")}
      </p>

      {!preview ? (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="baja-reemplazo" className="block text-sm font-medium text-slate-700">
              ¿Quién lo sustituye? <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <select id="baja-reemplazo" className={clsx(input, "mt-1")} value={reemplazo} onChange={(e) => setReemplazo(e.target.value)}>
              <option value="">— Nadie por ahora —</option>
              {companeros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
              <option value={NUEVO}>➕ Asesor nuevo…</option>
            </select>
            {reemplazo === NUEVO && (
              <input className={clsx(input, "mt-2")} autoComplete="off" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre del asesor nuevo" aria-label="Nombre del asesor nuevo" />
            )}
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">¿Qué pasa con sus leads?</legend>
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input type="radio" name="traspaso" className="mt-1" checked={!traspasar} onChange={() => setTraspasar(false)} />
              <span>
                Se quedan a su nombre como <b>histórico</b>
                <span className="block text-xs text-slate-500">Siguen visibles en la lista y en reportes; el asesor deja de aparecer para asignar leads nuevos.</span>
              </span>
            </label>
            <label className={clsx("mt-2 flex items-start gap-2 text-sm", tieneReemplazo ? "cursor-pointer text-slate-700" : "cursor-not-allowed text-slate-400")}>
              <input type="radio" name="traspaso" className="mt-1" disabled={!tieneReemplazo} checked={traspasar && tieneReemplazo} onChange={() => setTraspasar(true)} />
              <span>
                Pasan a <b>{nombreReemplazo || "quien lo sustituye"}</b>
                {!tieneReemplazo && <span className="block text-xs">Elige primero quién lo sustituye.</span>}
              </span>
            </label>

            {traspasa && (
              <div className="ml-6 mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-xs font-medium text-slate-600">Leads ingresados en este periodo (vacío = sin límite)</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input type="date" className={clsx(input, "w-auto")} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
                    <span className="text-xs text-slate-500">a</span>
                    <input type="date" className={clsx(input, "w-auto")} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100" onClick={esteMes}>
                      Solo este mes
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                      onClick={() => {
                        setDesde("");
                        setHasta("");
                      }}
                    >
                      Todo (sin límite)
                    </button>
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="mt-1" checked={soloAbiertos} onChange={(e) => setSoloAbiertos(e.target.checked)} />
                  <span>
                    Solo los leads abiertos
                    <span className="block text-xs text-slate-500">Los vendidos y perdidos se quedan a su nombre (sus ventas pasadas no cambian de asesor).</span>
                  </span>
                </label>
              </div>
            )}
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button className={clsx(btn, "bg-slate-100 text-slate-700 hover:bg-slate-200")} onClick={onClose}>
              Cancelar
            </button>
            <button className={clsx(btn, "bg-brand text-white hover:bg-brand-dark")} disabled={busy || (reemplazo === NUEVO && !tieneReemplazo)} onClick={revisar}>
              {busy ? "Revisando…" : "Revisar cambios"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <ul className="space-y-1.5 text-sm text-slate-700">
            <li>
              • <b>{preview.asesor}</b> deja de aparecer para asignar leads.
            </li>
            {preview.reemplazo && (
              <li>
                • {preview.reemplazoEsNuevo ? "Se agrega (o reactiva) a" : "Lo sustituye"} <b>{preview.reemplazo}</b>.
              </li>
            )}
            <li>
              • {preview.aMover > 0 ? (
                <>
                  Pasan <b>{plural(preview.aMover, "lead", "leads")}</b> a <b>{preview.reemplazo}</b>.
                </>
              ) : (
                <>No se pasa ningún lead.</>
              )}
            </li>
            <li>
              • {preview.seQuedan > 0 ? (
                <>
                  Se quedan <b>{plural(preview.seQuedan, "lead", "leads")}</b> a nombre de {preview.asesor} como histórico.
                </>
              ) : (
                <>No queda ningún lead a su nombre.</>
              )}
            </li>
            {preview.cuenta && (
              <li>
                • Su usuario <b>{preview.cuenta.username}</b> {preview.cuenta.activo ? "se desactiva y su sesión se cierra" : "ya está desactivado"}.
              </li>
            )}
          </ul>

          {meses.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2.5 py-1.5 font-semibold">Mes</th>
                    <th className="px-2.5 py-1.5 font-semibold">Pasan</th>
                    <th className="px-2.5 py-1.5 font-semibold">Se quedan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {meses.map((m) => (
                    <tr key={m.mes} className="align-top">
                      <td className="px-2.5 py-1.5 font-medium text-slate-700 first-letter:uppercase">{mesLabel(m.mes)}</td>
                      <td className="px-2.5 py-1.5 text-slate-700">{m.nMueven > 0 ? `${m.nMueven} (${porEstado(m.mueven)})` : "—"}</td>
                      <td className="px-2.5 py-1.5 text-slate-500">{m.nQuedan > 0 ? `${m.nQuedan} (${porEstado(m.quedan)})` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            No se borra nada. Los leads que pasan no cambian de fecha ni de estado, y el asesor se puede reactivar. Mover leads de un asesor a otro no se deshace con un botón: revisa bien los números antes de confirmar.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button className={clsx(btn, "bg-slate-100 text-slate-700 hover:bg-slate-200")} disabled={busy} onClick={() => setPreview(null)}>
              Atrás
            </button>
            <button className={clsx(btn, "bg-red-600 text-white hover:bg-red-700")} disabled={busy} onClick={confirmar}>
              {busy ? "Aplicando…" : "Confirmar baja"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
