import type { Role, Sucursal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getReport } from "@/lib/reportsAggregation";
import { isOverdue } from "@/lib/leadPolicy";
import { mexicoTodayAsUTCDate } from "@/lib/dateOnly";
import { asesoresFor, SUCURSALES } from "@/lib/catalogs";

type U = { role: Role; sucursal: Sucursal | null };

const DAY = 86_400_000;
const ABIERTO = { notIn: ["VENTA", "PERDIDO"] as ("VENTA" | "PERDIDO")[] };

export type LeadPendiente = {
  id: string;
  nombre: string;
  telefono: string;
  interes: string;
  sucursal: Sucursal;
  estado: string;
  createdAt: string;
  atrasado: boolean;
};

type PorSucursal = { sucursal: Sucursal; total: number; atrasados: number };

/**
 * Datos de la pantalla de Inicio, con el alcance del rol (el gerente solo ve su sucursal; se filtra aquí, en el servidor).
 * TODO es del mes en curso: solo leads ingresados este mes (y ventas cerradas este mes), para no mezclar meses pasados.
 *  - Tareas: leads sin asignar (sin asesor), sin atender (Nuevo) y seguimientos de hoy/vencidos.
 *  - Desempeño del mes en curso (mismo cálculo que Reportes).
 *  - Solo Coordinación: leads cargados hoy/esta semana y sucursales sin asesores registrados.
 */
export async function getInicio(user: U) {
  const scope = user.role === "gerente" ? user.sucursal : null;
  const sucWhere = scope ? { sucursal: scope } : {};
  const hoy = mexicoTodayAsUTCDate();
  const manana = new Date(hoy.getTime() + DAY);
  const mesInicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const lunes = new Date(hoy.getTime() - ((hoy.getUTCDay() + 6) % 7) * DAY);
  const now = new Date();

  const reporteMes = await getReport({ start: mesInicio, end: manana }, scope);

  // ---- Sin asignar: leads abiertos del mes que todavía no tienen asesor ----
  const delMes = { gte: mesInicio, lt: manana };
  const sinAsignarWhere = { ...sucWhere, asesor: null, estado: ABIERTO, fecha: delMes };
  const sinAsignarRows = await prisma.lead.findMany({
    where: sinAsignarWhere,
    orderBy: { createdAt: "asc" }, // los más viejos primero: son los más urgentes
    take: 2000,
    select: { id: true, nombre: true, telefono: true, interes: true, sucursal: true, estado: true, createdAt: true, proximoSeguimiento: true },
  });
  const toPendiente = (l: (typeof sinAsignarRows)[number]): LeadPendiente => ({
    id: l.id,
    nombre: l.nombre,
    telefono: l.telefono,
    interes: l.interes,
    sucursal: l.sucursal,
    estado: l.estado,
    createdAt: l.createdAt.toISOString(),
    atrasado: isOverdue({ estado: l.estado, proximoSeguimiento: l.proximoSeguimiento, createdAt: l.createdAt }, now),
  });
  const sinAsignar = sinAsignarRows.map(toPendiente);

  // ---- Sin atender: leads en "Nuevo" ingresados este mes ----
  const nuevosRows = await prisma.lead.findMany({
    where: { ...sucWhere, estado: "NUEVO", fecha: delMes },
    orderBy: { createdAt: "asc" },
    take: 1000,
    select: { id: true, nombre: true, telefono: true, interes: true, sucursal: true, estado: true, createdAt: true, proximoSeguimiento: true },
  });
  const sinAtender = nuevosRows.map(toPendiente);

  const agrupar = (lista: LeadPendiente[]): PorSucursal[] => {
    const m = new Map<Sucursal, PorSucursal>();
    for (const l of lista) {
      const e = m.get(l.sucursal) ?? { sucursal: l.sucursal, total: 0, atrasados: 0 };
      e.total++;
      if (l.atrasado) e.atrasados++;
      m.set(l.sucursal, e);
    }
    return [...m.values()].sort((a, b) => b.atrasados - a.atrasados || b.total - a.total);
  };

  // ---- Seguimientos de hoy o vencidos (leads abiertos ingresados este mes) ----
  const pendWhere = { ...sucWhere, fecha: delMes, proximoSeguimiento: { lt: manana }, estado: ABIERTO };
  const [seguimientosTotal, seguimientosRows] = await Promise.all([
    prisma.lead.count({ where: pendWhere }),
    prisma.lead.findMany({
      where: pendWhere,
      orderBy: { proximoSeguimiento: "asc" },
      take: 6,
      select: { id: true, nombre: true, estado: true, sucursal: true, asesor: true, proximoSeguimiento: true },
    }),
  ]);

  // ---- Ventas cerradas este mes (las más recientes) ----
  const ventasRows = await prisma.lead.findMany({
    where: { ...sucWhere, estado: "VENTA", fechaCierre: delMes },
    orderBy: [{ fechaCierre: "desc" }, { updatedAt: "desc" }],
    take: 6,
    select: { id: true, nombre: true, sucursal: true, asesor: true, montoVenta: true, fechaCierre: true },
  });

  // ---- Solo Coordinación ----
  let captura: { hoy: number; semana: number; mes: number } | null = null;
  let sucursalesSinAsesores: Sucursal[] = [];
  if (user.role === "coord") {
    const [cHoy, cSemana] = await Promise.all([
      prisma.lead.count({ where: { fecha: { gte: hoy, lt: manana } } }),
      prisma.lead.count({ where: { fecha: { gte: lunes, lt: manana } } }),
    ]);
    captura = { hoy: cHoy, semana: cSemana, mes: reporteMes.metrics.totalLeads };
    sucursalesSinAsesores = SUCURSALES.filter((s) => asesoresFor(s).length === 0);
  }

  return {
    hoy: hoy.toISOString().slice(0, 10),
    reporteMes,
    sinAsignar: { total: sinAsignar.length, items: sinAsignar.slice(0, 8), porSucursal: agrupar(sinAsignar) },
    sinAtender: { total: sinAtender.length, atrasados: sinAtender.filter((l) => l.atrasado).length, items: sinAtender.slice(0, 8), porSucursal: agrupar(sinAtender) },
    seguimientos: {
      total: seguimientosTotal,
      items: seguimientosRows.map((l) => ({
        id: l.id,
        nombre: l.nombre,
        estado: l.estado,
        sucursal: l.sucursal,
        asesor: l.asesor,
        seguimiento: l.proximoSeguimiento!.toISOString().slice(0, 10),
        vencido: l.proximoSeguimiento!.getTime() < hoy.getTime(),
      })),
    },
    ventasRecientes: ventasRows.map((v) => ({
      id: v.id,
      nombre: v.nombre,
      sucursal: v.sucursal,
      asesor: v.asesor,
      monto: v.montoVenta == null ? null : Number(v.montoVenta.toString()),
      fechaCierre: v.fechaCierre!.toISOString().slice(0, 10),
    })),
    captura,
    sucursalesSinAsesores,
  };
}
