import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInicio } from "@/lib/inicio";
import { ESTADO_LABELS, FUENTE_LABELS, SUCURSAL_LABELS } from "@/lib/catalogs";
import { formatDateOnly } from "@/lib/dateOnly";
import { MetricCard } from "@/components/reports/MetricCard";
import { TendenciaChart } from "@/components/charts/TendenciaChart";
import { BarrasH } from "@/components/charts/BarrasH";
import { PorAsignarLista } from "@/components/inicio/PorAsignarLista";

export const dynamic = "force-dynamic";

const money = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("es-MX"));
const corto = (nombre: string) => nombre.split(" ").slice(0, 2).join(" ");

function saludo(): { texto: string; fecha: string; mes: string } {
  const tz = "America/Mexico_City";
  const now = new Date();
  const hora = Number(new Intl.DateTimeFormat("es-MX", { timeZone: tz, hour: "numeric", hour12: false }).format(now));
  const fecha = new Intl.DateTimeFormat("es-MX", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const mes = new Intl.DateTimeFormat("es-MX", { timeZone: tz, month: "long" }).format(now);
  return { texto: hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches", fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1), mes };
}

function hace(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

/** Tarjeta de tarea pendiente: número grande + qué hacer. `tono`: rojo si hay algo urgente, verde si está al día. */
function Tarea({
  titulo,
  total,
  detalle,
  tono,
  children,
  href,
  enlace,
}: {
  titulo: string;
  total: number;
  detalle?: string;
  tono: "urgente" | "pendiente" | "listo";
  children?: React.ReactNode;
  href?: string;
  enlace?: string;
}) {
  return (
    <section
      className={clsx(
        "flex min-w-0 flex-col rounded-lg border bg-white p-4 shadow-sm",
        tono === "urgente" ? "border-red-300" : tono === "pendiente" ? "border-amber-300" : "border-slate-200"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          {detalle && <p className={clsx("text-xs", tono === "urgente" ? "font-semibold text-red-600" : "text-slate-500")}>{detalle}</p>}
        </div>
        <span className={clsx("text-3xl font-bold leading-none", total === 0 ? "text-green-600" : tono === "urgente" ? "text-brand" : "text-slate-900")}>{total}</span>
      </div>
      {total === 0 ? <p className="py-3 text-sm text-slate-500">✅ Todo al día.</p> : <div className="min-w-0 flex-1">{children}</div>}
      {href && total > 0 && (
        <Link href={href} className="mt-3 block rounded-md bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-200">
          {enlace ?? "Ver en Leads"}
        </Link>
      )}
    </section>
  );
}

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default async function InicioPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { role, sucursal, username } = session.user;
  const coord = role === "coord";
  const data = await getInicio({ role, sucursal });
  const { texto, fecha, mes } = saludo();
  const rep = data.reporteMes;
  const m = rep.metrics;
  const c = rep.comparativo?.metrics;
  const delta = (a: number, b: number | undefined, extra?: { puntos?: boolean }) => (b === undefined ? null : { actual: a, anterior: b, ...extra });
  const { sinAsignar, sinAtender, seguimientos } = data;

  const filaSucursal = (s: { sucursal: keyof typeof SUCURSAL_LABELS; total: number; atrasados: number }, href: string, etiqueta: string) => (
    <li key={s.sucursal}>
      <Link href={href} className="flex items-center justify-between gap-3 py-2 hover:bg-slate-50">
        <span className="text-sm font-medium text-slate-800">{SUCURSAL_LABELS[s.sucursal]}</span>
        <span className="text-right text-sm">
          <span className="font-bold text-slate-900">
            {s.total} <span className="font-normal text-slate-500">{etiqueta}</span>
          </span>
          {s.atrasados > 0 && <span className="block text-[11px] font-semibold text-red-600">{s.atrasados} con más de 24 h</span>}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {texto}, {username}
          </h1>
          <p className="text-sm text-slate-500">
            {fecha} · {coord ? "Todas las sucursales" : `Sucursal ${SUCURSAL_LABELS[sucursal!]}`}
          </p>
          <p className="text-xs text-slate-400">Solo se muestran los leads de {mes} (el mes en curso).</p>
        </div>
        {coord && (
          <Link href="/leads/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            + Nuevo lead
          </Link>
        )}
      </div>

      {/* ============ TAREAS PENDIENTES ============ */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{coord ? "Por revisar hoy" : "Tus pendientes"}</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* --- Leads sin asignar --- */}
          <Tarea
            titulo="Leads sin asignar"
            total={sinAsignar.total}
            detalle={coord ? "Aún no tienen asesor" : "Elige qué asesor los atiende"}
            tono={sinAsignar.total > 0 ? "pendiente" : "listo"}
            href={coord ? undefined : "/leads?sinAsesor=1"}
            enlace="Ver y asignar en Leads"
          >
            {coord ? (
              <ul className="divide-y divide-slate-100">{sinAsignar.porSucursal.map((s) => filaSucursal(s, `/leads?sucursal=${s.sucursal}`, "sin asesor"))}</ul>
            ) : (
              <PorAsignarLista items={sinAsignar.items} total={sinAsignar.total} sucursal={sucursal!} />
            )}
          </Tarea>

          {/* --- Leads sin atender --- */}
          <Tarea
            titulo="Leads sin atender"
            total={sinAtender.total}
            detalle={sinAtender.atrasados > 0 ? `${sinAtender.atrasados} con más de 24 h` : "Leads nuevos sin primer contacto"}
            tono={sinAtender.atrasados > 0 ? "urgente" : sinAtender.total > 0 ? "pendiente" : "listo"}
            href="/leads"
            enlace="Ver en Leads"
          >
            {coord ? (
              <ul className="divide-y divide-slate-100">{sinAtender.porSucursal.map((s) => filaSucursal(s, `/leads?sucursal=${s.sucursal}`, "sin atender"))}</ul>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sinAtender.items.slice(0, 6).map((l) => (
                  <li key={l.id}>
                    <Link href={`/leads/${l.id}`} className="flex items-start justify-between gap-3 py-2.5 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{l.nombre}</span>
                        <span className="block truncate text-xs text-slate-500">{l.interes || l.telefono}</span>
                      </span>
                      <span className={l.atrasado ? "shrink-0 text-xs font-semibold text-red-600" : "shrink-0 text-xs text-slate-400"}>hace {hace(l.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tarea>

          {/* --- Gerente: seguimientos de hoy / Coordinación: captura --- */}
          {coord && data.captura ? (
            <section className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">Leads cargados</h2>
              <p className="text-xs text-slate-500">Lo que se ha registrado en el CRM</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Hoy", data.captura.hoy],
                  ["Esta semana", data.captura.semana],
                  ["Este mes", data.captura.mes],
                ].map(([label, n]) => (
                  <div key={label as string} className="rounded-md bg-slate-50 px-1 py-3">
                    <p className="text-2xl font-bold text-slate-900">{n}</p>
                    <p className="text-[11px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              {data.captura.hoy === 0 && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Todavía no se ha cargado ningún lead hoy.</p>}
              {data.sucursalesSinAsesores.length > 0 && (
                <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <b>Sin asesores registrados:</b> {data.sucursalesSinAsesores.map((s) => SUCURSAL_LABELS[s]).join(", ")}. Sus gerentes no pueden asignar leads hasta que se den de alta.
                </p>
              )}
            </section>
          ) : (
            <Tarea
              titulo="Seguimientos de hoy"
              total={seguimientos.total}
              detalle="Para hoy o ya vencidos"
              tono={seguimientos.items.some((s) => s.vencido) ? "urgente" : seguimientos.total > 0 ? "pendiente" : "listo"}
            >
              <ul className="divide-y divide-slate-100">
                {seguimientos.items.map((l) => (
                  <li key={l.id}>
                    <Link href={`/leads/${l.id}`} className="flex items-start justify-between gap-3 py-2.5 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{l.nombre}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {ESTADO_LABELS[l.estado as keyof typeof ESTADO_LABELS]}
                          {l.asesor ? ` · ${corto(l.asesor)}` : ""}
                        </span>
                      </span>
                      <span className={l.vencido ? "shrink-0 text-xs font-semibold text-red-600" : "shrink-0 text-xs text-slate-500"}>
                        {l.vencido ? "Vencido " : "Hoy "}
                        {formatDateOnly(l.seguimiento, "d MMM")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Tarea>
          )}
        </div>
      </div>

      {/* ============ DESEMPEÑO DEL MES ============ */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{coord ? "Desempeño de la red este mes" : "Desempeño de tu sucursal este mes"}</h2>
          <Link href="/reports" className="text-xs font-semibold text-brand hover:underline">
            Ver reportes completos
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Leads del mes" value={String(m.totalLeads)} hint={`${m.leadsEnProceso} en proceso`} delta={delta(m.totalLeads, c?.totalLeads)} />
          <MetricCard label="Ventas del mes" value={String(m.ventas)} hint={m.ventas ? `Ticket promedio ${money(m.ticketPromedio)}` : undefined} delta={delta(m.ventas, c?.ventas)} />
          <MetricCard label="Total vendido" value={money(m.totalVendido)} delta={delta(m.totalVendido, c?.totalVendido)} />
          <MetricCard label="Conversión" value={`${m.tasaConversion}%`} hint="ventas ÷ (ventas + perdidos)" delta={delta(m.tasaConversion, c?.tasaConversion, { puntos: true })} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Leads y ventas del mes">
            <TendenciaChart puntos={rep.tendencia.puntos} />
          </Card>

          {coord ? (
            <Card title="Sucursales este mes">
              {rep.porSucursal.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Aún no hay leads este mes.</p>
              ) : (
                <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
                  {[...rep.porSucursal]
                    .sort((a, b) => b.montoVendido - a.montoVendido || b.total - a.total)
                    .map((s) => (
                      <li key={s.sucursal} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate font-medium text-slate-800">{SUCURSAL_LABELS[s.sucursal]}</span>
                        <span className="shrink-0 text-right text-slate-600">
                          {s.total} leads · {s.ventas} ventas · <span className="font-semibold text-slate-900">{money(s.montoVendido)}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          ) : (
            <Card title="Desempeño por asesor">
              {rep.porAsesor.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Aún no hay leads este mes.</p>
              ) : (
                <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
                  {rep.porAsesor.map((a) => (
                    <li key={a.asesor} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className={clsx("min-w-0 truncate", a.asesor === "Sin asignar" ? "text-slate-400" : "font-medium text-slate-800")}>{a.asesor}</span>
                      <span className="shrink-0 text-right text-slate-600">
                        {a.leads} leads · {a.ventas} ventas · <span className="font-semibold text-slate-900">{money(a.monto)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {coord && (
            <Card title="Leads por canal este mes">
              <BarrasH filas={rep.porCanal.map((f) => ({ label: FUENTE_LABELS[f.fuente] + (["REFERIDO", "OTRO"].includes(f.fuente) ? " (histórico)" : ""), valor: f.total }))} />
            </Card>
          )}

          <Card title="Ventas cerradas este mes">
            {data.ventasRecientes.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Aún no hay ventas cerradas este mes.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.ventasRecientes.map((v) => (
                  <li key={v.id}>
                    <Link href={`/leads/${v.id}`} className="flex items-center justify-between gap-3 py-2 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{v.nombre}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {coord ? `${SUCURSAL_LABELS[v.sucursal]} · ` : ""}
                          {formatDateOnly(v.fechaCierre, "d MMM")}
                          {v.asesor ? ` · ${corto(v.asesor)}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-green-700">{money(v.monto)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
