import type { Role, Sucursal } from "@prisma/client";

/**
 * Sucursales cuyos leads también asigna Coordinación (hoy: Tienda en línea). En las demás sucursales el asesor
 * lo asigna solo el gerente. Se usa igual en el servidor (permiso real) y en las pantallas (para mostrar el botón).
 */
export const SUCURSALES_ASIGNA_COORD: Sucursal[] = ["TLI"];

/** ¿Este perfil puede asignar asesor a un lead de esta sucursal? (el gerente siempre está limitado a su sucursal en el servidor) */
export function puedeAsignarAsesor(role: Role, sucursal: Sucursal): boolean {
  return role === "gerente" || (role === "coord" && SUCURSALES_ASIGNA_COORD.includes(sucursal));
}
