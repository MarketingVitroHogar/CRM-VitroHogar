"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import type { Role, Sucursal } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { SUCURSAL_LABELS } from "@/lib/catalogs";

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

const btn = "rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo completar la acción");
  return data;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" });
}

export function UsersView() {
  const { toast, toastNode } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offTarget, setOffTarget] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<{ username: string; temporal: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await call("/api/users", "GET");
      setUsers(data.users);
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

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Sucursal</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Contraseña</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            )}
            {users.map((u) => {
              const lastCoord = u.role === "coord" && activeCoords <= 1;
              const cantOff = u.isMe || lastCoord;
              return (
                <tr key={u.id} className={clsx(!u.activo && "bg-slate-50 text-slate-400")}>
                  <td className="px-4 py-3 font-semibold">
                    <span className={clsx(!u.activo && "line-through")}>{u.username}</span>
                    {u.isMe && <span className="ml-1.5 text-xs font-normal text-slate-500">(tú)</span>}
                  </td>
                  <td className="px-4 py-3">{u.role === "coord" ? "Coordinación" : u.role === "asesor" ? `Asesor${u.asesor ? ` · ${u.asesor}` : ""}` : "Gerente"}</td>
                  <td className="px-4 py-3">{u.sucursal ? SUCURSAL_LABELS[u.sucursal] : "Todas"}</td>
                  <td className="px-4 py-3">
                    <span className={clsx("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", u.activo ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600")}>
                      {u.activo ? "Activa" : "Desactivada"}
                    </span>
                    {u.bloqueada && <span className="ml-1.5 inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">Bloqueada</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.passwordChangedAt ? (
                      <span className="text-green-700">Cambiada · {fmtDate(u.passwordChangedAt)}</span>
                    ) : (
                      <span className="text-amber-700">Sin cambiar</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
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
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        • <b>Desactivar</b>: la persona ya no puede entrar y, si tiene sesión abierta, se le cierra. <b>No se borra nada</b>: sus leads y su historial se conservan y la cuenta se puede reactivar.
        <br />• No se puede desactivar tu propia cuenta ni la última cuenta de Coordinación activa.
        <br />• <b>Restablecer contraseña</b>: genera una contraseña temporal que se muestra una sola vez.
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

      <Modal open={!!temp} onClose={() => setTemp(null)} title="Contraseña temporal">
        <p className="text-sm text-slate-600">
          Nueva contraseña temporal para <b>{temp?.username}</b>:
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
