"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { Role, Sucursal } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { SUCURSALES, SUCURSAL_LABELS } from "@/lib/catalogs";
import { BajaAsesorModal, type AsesorRow } from "./BajaAsesorModal";

type UserRow = {
  id: string;
  username: string;
  role: Role;
  sucursal: Sucursal | null;
  asesor: string | null;
  activo: boolean;
  passwordChangedAt: string | null;
  bloqueada: boolean;
  isMe: boolean;
};

const btn = "min-h-9 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo completar la acción");
  return data;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" });
}

/** Para buscar sin importar acentos ni mayúsculas. */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function UsersView() {
  const { toast, toastNode } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offTarget, setOffTarget] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<{ username: string; temporal: string; nuevo?: boolean } | null>(null);
  // Crear la cuenta de un asesor (su usuario es su número de nómina) y cambiar la nómina de una cuenta existente.
  const [crear, setCrear] = useState<{ sucursal: Sucursal; asesor: string } | null>(null);
  const [cambiar, setCambiar] = useState<UserRow | null>(null);
  const [nomina, setNomina] = useState("");
  const [nominaError, setNominaError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const router = useRouter();
  // Catálogo de asesores (activos y dados de baja), administrado desde aquí por Coordinación.
  const [catalogo, setCatalogo] = useState<AsesorRow[]>([]);
  const [agregar, setAgregar] = useState<Sucursal | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [agregarError, setAgregarError] = useState<string | null>(null);
  const [baja, setBaja] = useState<AsesorRow | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, cat] = await Promise.all([call("/api/users", "GET"), call("/api/asesores", "GET")]);
      setUsers(data.users);
      setCatalogo(cat.asesores);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    load();
  }, [load]);

  const activeCoords = users.filter((u) => u.role === "coord" && u.activo).length;

  async function act(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      await load();
      toast(okMsg);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  async function reset(u: UserRow) {
    setBusy(true);
    try {
      const data = await call(`/api/users/${u.id}/reset-password`, "POST");
      setTemp({ username: data.username, temporal: data.temporal });
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo restablecer");
    } finally {
      setBusy(false);
    }
  }

  function abrirCrear(sucursal: Sucursal, asesor: string) {
    setNomina("");
    setNominaError(null);
    setCrear({ sucursal, asesor });
  }

  function abrirCambiar(u: UserRow) {
    setNomina(u.username);
    setNominaError(null);
    setCambiar(u);
  }

  async function guardarCrear() {
    if (!crear) return;
    setBusy(true);
    setNominaError(null);
    try {
      const data = await call("/api/users", "POST", { sucursal: crear.sucursal, asesor: crear.asesor, username: nomina });
      setCrear(null);
      setTemp({ username: data.username, temporal: data.temporal, nuevo: true });
      await load();
    } catch (e) {
      setNominaError(e instanceof Error ? e.message : "No se pudo crear el usuario");
    } finally {
      setBusy(false);
    }
  }

  async function guardarCambiar() {
    if (!cambiar) return;
    setBusy(true);
    setNominaError(null);
    try {
      await call(`/api/users/${cambiar.id}`, "PATCH", { username: nomina });
      const nombre = cambiar.asesor ?? cambiar.username;
      setCambiar(null);
      await load();
      toast(`Nómina de ${nombre} actualizada.`);
    } catch (e) {
      setNominaError(e instanceof Error ? e.message : "No se pudo cambiar la nómina");
    } finally {
      setBusy(false);
    }
  }

  async function guardarAgregar() {
    if (!agregar) return;
    setBusy(true);
    setAgregarError(null);
    try {
      const data = await call("/api/asesores", "POST", { sucursal: agregar, nombre: nombreNuevo });
      setAgregar(null);
      await load();
      router.refresh(); // el selector de asesor de las demás pantallas se actualiza
      toast(data.reactivado ? `${data.nombre} volvió a estar activo.` : `${data.nombre} agregado a ${SUCURSAL_LABELS[agregar]}.`);
    } catch (e) {
      setAgregarError(e instanceof Error ? e.message : "No se pudo agregar al asesor");
    } finally {
      setBusy(false);
    }
  }

  // ---- Armado de los paneles: por sucursal, su gerente y sus asesores (activos del catálogo, con o sin usuario; y los dados de baja) ----
  const paneles = useMemo(() => {
    return SUCURSALES.map((s) => {
      const gerentes = users.filter((u) => u.role === "gerente" && u.sucursal === s);
      const cuentasAsesor = users.filter((u) => u.role === "asesor" && u.sucursal === s);
      const delCatalogo = catalogo.filter((a) => a.sucursal === s);
      const asesores = delCatalogo
        .filter((a) => a.activo)
        .map((a) => ({ fila: a, nombre: a.nombre, cuenta: cuentasAsesor.find((u) => u.asesor === a.nombre) ?? null }));
      const dadosDeBaja = delCatalogo
        .filter((a) => !a.activo)
        .map((a) => ({ fila: a, nombre: a.nombre, cuenta: cuentasAsesor.find((u) => u.asesor === a.nombre) ?? null }));
      // cuentas de asesores que no están en el catálogo de la sucursal (por si acaso)
      const sueltas = cuentasAsesor.filter((u) => !delCatalogo.some((a) => a.nombre === u.asesor));
      const cuentas = [...gerentes, ...asesores.map((a) => a.cuenta).filter((c): c is UserRow => !!c), ...sueltas];
      return {
        sucursal: s,
        gerentes,
        asesores,
        dadosDeBaja,
        sueltas,
        conUsuario: asesores.filter((a) => a.cuenta).length,
        bloqueadas: cuentas.filter((c) => c.bloqueada).length,
        desactivadas: cuentas.filter((c) => !c.activo).length,
        texto: norm([SUCURSAL_LABELS[s], ...cuentas.map((c) => `${c.username} ${c.asesor ?? ""}`), ...asesores.map((a) => a.nombre), ...dadosDeBaja.map((a) => a.nombre)].join(" ")),
      };
    });
  }, [users, catalogo]);

  const coords = users.filter((u) => u.role === "coord");
  const busqueda = norm(q.trim());
  const visibles = busqueda ? paneles.filter((p) => p.texto.includes(busqueda)) : paneles;
  const totalAsesores = paneles.reduce((n, p) => n + p.asesores.length, 0);
  const asesoresConUsuario = paneles.reduce((n, p) => n + p.conUsuario, 0);

  const estaAbierto = (key: string) => !!busqueda || abiertos.has(key);
  const alternar = (key: string) =>
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  function acciones(u: UserRow, extra?: React.ReactNode) {
    const lastCoord = u.role === "coord" && activeCoords <= 1;
    const cantOff = u.isMe || lastCoord;
    return (
      <div className="flex flex-wrap gap-1.5">
        {u.activo ? (
          <button
            className={clsx(btn, "bg-red-50 text-red-700 hover:bg-red-100")}
            disabled={busy || cantOff}
            title={cantOff ? "No disponible para tu propia cuenta ni para la última cuenta de Coordinación" : undefined}
            onClick={() => setOffTarget(u)}
          >
            Desactivar
          </button>
        ) : (
          <button
            className={clsx(btn, "bg-green-50 text-green-800 hover:bg-green-100")}
            disabled={busy}
            onClick={() => act(() => call(`/api/users/${u.id}`, "PATCH", { activo: true }), `Cuenta ${u.username} reactivada.`)}
          >
            Reactivar
          </button>
        )}
        <button className={clsx(btn, "bg-slate-100 text-slate-700 hover:bg-slate-200")} disabled={busy || !u.activo} onClick={() => reset(u)}>
          Restablecer contraseña
        </button>
        {u.bloqueada && (
          <button className={clsx(btn, "bg-slate-100 text-slate-700 hover:bg-slate-200")} disabled={busy} onClick={() => act(() => call(`/api/users/${u.id}/unlock`, "POST"), "Bloqueo quitado.")}>
            Quitar bloqueo
          </button>
        )}
        {u.role === "asesor" && (
          <button className={clsx(btn, "bg-slate-100 text-slate-700 hover:bg-slate-200")} disabled={busy} onClick={() => abrirCambiar(u)}>
            Cambiar nómina
          </button>
        )}
        {extra}
      </div>
    );
  }

  /** Una cuenta: nombre/usuario, estado, contraseña y acciones. `extra`: botones adicionales (p. ej. "Dar de baja"). */
  function fila(u: UserRow, titulo: string, detalle: string, extra?: React.ReactNode) {
    return (
      <li key={u.id} className={clsx("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4", !u.activo && "bg-slate-50")}>
        <div className="min-w-0">
          <p className={clsx("text-sm font-semibold", u.activo ? "text-slate-900" : "text-slate-400")}>
            <span className={clsx(!u.activo && "line-through")}>{titulo}</span>
            {u.isMe && <span className="ml-1.5 text-xs font-normal text-slate-500">(tú)</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span>
              Usuario: <b className="font-semibold text-slate-700">{u.username}</b>
              {detalle && <span> · {detalle}</span>}
            </span>
            <span className={clsx("inline-flex rounded-full px-2 py-0.5 font-semibold", u.activo ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600")}>{u.activo ? "Activa" : "Desactivada"}</span>
            {u.bloqueada && <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-800">Bloqueada</span>}
            {u.passwordChangedAt ? <span className="text-green-700">Contraseña cambiada · {fmtDate(u.passwordChangedAt)}</span> : <span className="text-amber-700">Contraseña sin cambiar</span>}
          </p>
        </div>
        {acciones(u, extra)}
      </li>
    );
  }

  const chip = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Resumen y herramientas */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          <b className="text-slate-900">{users.filter((u) => u.activo).length}</b> cuentas activas · <b className="text-slate-900">{asesoresConUsuario}</b> de {totalAsesores} asesores ya tienen usuario
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar sucursal, asesor o usuario…"
            aria-label="Buscar sucursal, asesor o usuario"
            className="min-h-9 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:w-64"
          />
          <button className={clsx(btn, "bg-slate-100 text-slate-700 hover:bg-slate-200")} onClick={() => setAbiertos(new Set(paneles.map((p) => p.sucursal)))}>
            Abrir todo
          </button>
          <button className={clsx(btn, "bg-slate-100 text-slate-700 hover:bg-slate-200")} onClick={() => setAbiertos(new Set())}>
            Cerrar todo
          </button>
        </div>
      </div>

      {loading && <p className="py-6 text-center text-sm text-slate-400">Cargando…</p>}

      {/* Coordinación */}
      {!loading && coords.length > 0 && !busqueda && (
        <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800">Coordinación</h2>
          <ul className="divide-y divide-slate-100">{coords.map((u) => fila(u, "Coordinador / Community Manager", "ve todas las sucursales"))}</ul>
        </section>
      )}

      {/* Un panel por sucursal */}
      <div className="flex flex-col gap-3">
        {visibles.map((p) => {
          const abierto = estaAbierto(p.sucursal);
          const gerente = p.gerentes[0];
          return (
            <section key={p.sucursal} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => alternar(p.sucursal)}
                aria-expanded={abierto}
                aria-controls={`panel-${p.sucursal}`}
                className="flex min-h-12 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span aria-hidden className={clsx("inline-block w-3 text-slate-400 transition-transform", abierto && "rotate-90")}>
                    ▸
                  </span>
                  {SUCURSAL_LABELS[p.sucursal]}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className={clsx(chip, !gerente ? "bg-slate-100 text-slate-500" : gerente.activo ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600")}>
                    Gerente: {!gerente ? "sin cuenta" : gerente.activo ? "activa" : "desactivada"}
                  </span>
                  <span className={clsx(chip, p.asesores.length === 0 ? "bg-slate-100 text-slate-500" : p.conUsuario === p.asesores.length ? "bg-green-100 text-green-800" : p.conUsuario > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>
                    {p.asesores.length === 0 ? "Sin asesores registrados" : `Asesores con usuario: ${p.conUsuario} de ${p.asesores.length}`}
                  </span>
                  {p.bloqueadas > 0 && <span className={clsx(chip, "bg-orange-100 text-orange-800")}>{p.bloqueadas} bloqueada{p.bloqueadas > 1 ? "s" : ""}</span>}
                </span>
              </button>

              {abierto && (
                <div id={`panel-${p.sucursal}`} className="border-t border-slate-100">
                  <h3 className="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Gerente</h3>
                  {p.gerentes.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">Esta sucursal no tiene cuenta de gerente.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">{p.gerentes.map((u) => fila(u, "Gerente de sucursal", "asigna asesores y ve toda la sucursal"))}</ul>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asesores</h3>
                    <button
                      className={clsx(btn, "bg-white text-brand ring-1 ring-brand/40 hover:bg-brand/5")}
                      disabled={busy}
                      onClick={() => {
                        setNombreNuevo("");
                        setAgregarError(null);
                        setAgregar(p.sucursal);
                      }}
                    >
                      + Agregar asesor
                    </button>
                  </div>
                  {p.asesores.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">Esta sucursal aún no tiene asesores registrados.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {p.asesores.map((a) => {
                        const botonBaja = (
                          <button className={clsx(btn, "bg-red-50 text-red-700 hover:bg-red-100")} disabled={busy} onClick={() => setBaja(a.fila)}>
                            Dar de baja
                          </button>
                        );
                        return a.cuenta ? (
                          fila(a.cuenta, a.nombre, "ve solo sus leads", botonBaja)
                        ) : (
                          <li key={a.nombre} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-500">{a.nombre}</p>
                            <span className="flex flex-wrap items-center gap-2">
                              <span className={clsx(chip, "bg-slate-100 text-slate-500")}>Sin usuario todavía</span>
                              <button className={clsx(btn, "bg-brand text-white hover:bg-brand-dark")} disabled={busy} onClick={() => abrirCrear(p.sucursal, a.nombre)}>
                                Crear usuario
                              </button>
                              {botonBaja}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {p.sueltas.length > 0 && (
                    <ul className="divide-y divide-slate-100 border-t border-slate-100">{p.sueltas.map((u) => fila(u, u.asesor ?? u.username, "no está en el catálogo de la sucursal"))}</ul>
                  )}

                  {p.dadosDeBaja.length > 0 && (
                    <>
                      <h3 className="border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Dados de baja</h3>
                      <ul className="divide-y divide-slate-100">
                        {p.dadosDeBaja.map((a) => (
                          <li key={a.fila.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 px-4 py-3">
                            <p className="text-sm text-slate-500">
                              <span className="font-semibold">{a.nombre}</span>
                              <span className="ml-2 text-xs">
                                {a.fila.leads === 0 ? "sin leads" : `${a.fila.leads} lead${a.fila.leads === 1 ? "" : "s"} a su nombre (histórico)`}
                                {a.cuenta && ` · usuario ${a.cuenta.username} ${a.cuenta.activo ? "activo" : "desactivado"}`}
                              </span>
                            </p>
                            <button
                              className={clsx(btn, "bg-green-50 text-green-800 hover:bg-green-100")}
                              disabled={busy}
                              onClick={() =>
                                act(async () => {
                                  await call(`/api/asesores/${a.fila.id}`, "PATCH", { activo: true });
                                  router.refresh();
                                }, `${a.nombre} volvió a estar activo.`)
                              }
                            >
                              Reactivar
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}
        {!loading && visibles.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Ninguna sucursal, asesor o usuario coincide con “{q}”.</p>}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        • Toca una sucursal para ver a su gerente y a sus asesores. Los asesores con <b>“Sin usuario todavía”</b> aún no pueden entrar al CRM: toca <b>Crear usuario</b> y escribe su número de nómina (ese es su usuario).
        <br />• <b>Desactivar</b>: la persona ya no puede entrar y, si tiene sesión abierta, se le cierra. <b>No se borra nada</b>: sus leads y su historial se conservan y la cuenta se puede reactivar.
        <br />• No se puede desactivar tu propia cuenta ni la última cuenta de Coordinación activa.
        <br />• <b>Restablecer contraseña</b>: genera una contraseña temporal que se muestra una sola vez.
        <br />• <b>+ Agregar asesor</b> y <b>Dar de baja</b>: tú administras los asesores de cada sucursal. Al dar de baja eliges si sus leads pasan a quien lo sustituye (todos, de un periodo o solo los abiertos) o se quedan a su nombre como histórico. Nada se borra y se puede reactivar.
      </p>

      <Modal open={!!offTarget} onClose={() => setOffTarget(null)} title="¿Desactivar esta cuenta?" icon="⏸">
        <p className="text-sm leading-relaxed text-slate-600">
          <b>{offTarget?.username}</b> ya no podrá iniciar sesión y, si tiene una sesión abierta, se cerrará de inmediato.
          <br />
          <br />
          No se borra nada: sus leads y su historial se conservan, y puedes <b>reactivar</b> la cuenta cuando quieras.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className={clsx(btn, "bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2")} onClick={() => setOffTarget(null)}>
            Cancelar
          </button>
          <button
            className={clsx(btn, "bg-red-600 px-4 py-2 text-white hover:bg-red-700")}
            disabled={busy}
            onClick={async () => {
              const t = offTarget!;
              setOffTarget(null);
              await act(() => call(`/api/users/${t.id}`, "PATCH", { activo: false }), `Cuenta ${t.username} desactivada.`);
            }}
          >
            Sí, desactivar
          </button>
        </div>
      </Modal>

      <Modal open={!!crear} onClose={() => setCrear(null)} title="Crear usuario de asesor">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void guardarCrear();
          }}
        >
          <p className="text-sm leading-relaxed text-slate-600">
            Asesor: <b>{crear?.asesor}</b>
            <br />
            Sucursal: <b>{crear ? SUCURSAL_LABELS[crear.sucursal] : ""}</b>
          </p>
          <label htmlFor="nomina-nueva" className="mt-4 block text-sm font-medium text-slate-700">
            Número de nómina <span className="font-normal text-slate-400">(será su usuario)</span>
          </label>
          <input
            id="nomina-nueva"
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            value={nomina}
            onChange={(e) => setNomina(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Ej. 3294"
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:min-h-10 sm:text-sm"
          />
          <p className="mt-2 text-xs text-slate-500">Se le dará una contraseña temporal, que verás una sola vez. Al entrar, el asesor elegirá la suya.</p>
          {nominaError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {nominaError}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className={clsx(btn, "bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200")} onClick={() => setCrear(null)}>
              Cancelar
            </button>
            <button type="submit" className={clsx(btn, "bg-brand px-4 py-2 text-white hover:bg-brand-dark")} disabled={busy || nomina.length < 3}>
              {busy ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!cambiar} onClose={() => setCambiar(null)} title="Cambiar número de nómina">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void guardarCambiar();
          }}
        >
          <p className="text-sm leading-relaxed text-slate-600">
            Asesor: <b>{cambiar?.asesor}</b>
            <br />
            Usuario actual: <b>{cambiar?.username}</b>
          </p>
          <label htmlFor="nomina-cambio" className="mt-4 block text-sm font-medium text-slate-700">
            Número de nómina correcto <span className="font-normal text-slate-400">(será su usuario)</span>
          </label>
          <input
            id="nomina-cambio"
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            value={nomina}
            onChange={(e) => setNomina(e.target.value.replace(/[^0-9]/g, ""))}
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:min-h-10 sm:text-sm"
          />
          <p className="mt-2 text-xs text-slate-500">Su contraseña no cambia. La próxima vez, el asesor entra con el nuevo número.</p>
          {nominaError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {nominaError}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className={clsx(btn, "bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200")} onClick={() => setCambiar(null)}>
              Cancelar
            </button>
            <button type="submit" className={clsx(btn, "bg-brand px-4 py-2 text-white hover:bg-brand-dark")} disabled={busy || nomina.length < 3 || nomina === cambiar?.username}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!agregar} onClose={() => setAgregar(null)} title="Agregar asesor">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void guardarAgregar();
          }}
        >
          <p className="text-sm text-slate-600">
            Sucursal: <b>{agregar ? SUCURSAL_LABELS[agregar] : ""}</b>
          </p>
          <label htmlFor="asesor-nuevo" className="mt-4 block text-sm font-medium text-slate-700">
            Nombre del asesor
          </label>
          <input
            id="asesor-nuevo"
            autoFocus
            autoComplete="off"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Ej. Jessica Ruvalcaba"
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:min-h-10 sm:text-sm"
          />
          <p className="mt-2 text-xs text-slate-500">Desde ese momento el gerente podrá asignarle leads. El usuario para entrar al CRM es opcional y se crea después.</p>
          {agregarError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {agregarError}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className={clsx(btn, "bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200")} onClick={() => setAgregar(null)}>
              Cancelar
            </button>
            <button type="submit" className={clsx(btn, "bg-brand px-4 py-2 text-white hover:bg-brand-dark")} disabled={busy || nombreNuevo.trim().length < 2}>
              {busy ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </form>
      </Modal>

      {baja && (
        <BajaAsesorModal
          key={baja.id}
          asesor={baja}
          companeros={catalogo.filter((a) => a.sucursal === baja.sucursal && a.activo && a.id !== baja.id)}
          onClose={() => setBaja(null)}
          onDone={async (msg) => {
            setBaja(null);
            await load();
            router.refresh(); // el selector de asesor de las demás pantallas se actualiza
            toast(msg);
          }}
        />
      )}

      <Modal open={!!temp} onClose={() => setTemp(null)} title={temp?.nuevo ? "Usuario creado" : "Contraseña temporal"}>
        <p className="text-sm text-slate-600">
          {temp?.nuevo ? "Contraseña temporal para el nuevo usuario" : "Nueva contraseña temporal para"} <b>{temp?.username}</b>:
        </p>
        <div className="my-3 select-all rounded-lg border border-dashed border-slate-400 bg-slate-50 p-3 text-center font-mono text-lg tracking-wider">{temp?.temporal}</div>
        <p className="text-xs leading-relaxed text-slate-500">Se muestra una sola vez. Entrégala en persona o por un medio privado. Al entrar, la persona verá el aviso para cambiarla por la suya.</p>
        <div className="mt-4 flex justify-end">
          <button className={clsx(btn, "bg-brand px-4 py-2 text-white hover:bg-brand-dark")} onClick={() => setTemp(null)}>
            Listo
          </button>
        </div>
      </Modal>
      {toastNode}
    </div>
  );
}
