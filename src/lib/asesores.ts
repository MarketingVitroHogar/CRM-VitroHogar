import type { Sucursal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SUCURSALES } from "@/lib/catalogs";

/** Asesores ACTIVOS de cada sucursal (los que se pueden elegir al asignar un lead), en el orden en que se dieron de alta. */
export type Roster = Record<Sucursal, string[]>;

export async function getRoster(): Promise<Roster> {
  const rows = await prisma.asesor.findMany({
    where: { activo: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { sucursal: true, nombre: true },
  });
  const roster = Object.fromEntries(SUCURSALES.map((s) => [s, [] as string[]])) as Roster;
  for (const r of rows) roster[r.sucursal].push(r.nombre);
  return roster;
}

export async function asesoresActivos(sucursal: Sucursal): Promise<string[]> {
  const rows = await prisma.asesor.findMany({
    where: { sucursal, activo: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { nombre: true },
  });
  return rows.map((r) => r.nombre);
}

/** Un lead solo puede asignarse a un asesor activo de su sucursal (o quedar sin asignar). */
export async function isValidAsesorFor(sucursal: Sucursal, asesor: string | null): Promise<boolean> {
  if (asesor === null || asesor === "") return true; // sin asignar siempre es válido
  const n = await prisma.asesor.count({ where: { sucursal, nombre: asesor, activo: true } });
  return n > 0;
}
