import type { Role } from "@prisma/client";

/**
 * Aviso de "Novedades" del CRM. Al cambiar NOVEDADES_VERSION, todas las personas vuelven a ver el aviso
 * una vez (se guarda en su navegador, por usuario). Aquí se listan los cambios; no hay nada más que tocar.
 */
export const NOVEDADES_VERSION = "2026-11-16";

export type Novedad = { icono: string; titulo: string; texto: string; roles?: Role[] };

export const NOVEDADES: Novedad[] = [
  {
    icono: "▦",
    titulo: "Leads en Kanban, Lista o Tarjetas",
    texto:
      "En Leads ahora puedes ver tus leads como tablero (Kanban), como lista o como tarjetas, y el CRM recuerda tu elección. En el Kanban arrastra un lead de una columna a otra para cambiar su estado.",
  },
  {
    icono: "🔔",
    titulo: "Campana de avisos",
    texto:
      "La campana de arriba te muestra los leads nuevos por atender y cuáles llevan más de 24 horas sin atenderse. Se actualiza sola y te avisa cuando llega uno nuevo.",
  },
  {
    icono: "🔑",
    titulo: "Cambiar tu contraseña",
    texto: "Puedes cambiar tu contraseña cuando quieras desde tu nombre de usuario, arriba a la derecha → Cambiar contraseña.",
  },
  {
    icono: "👥",
    titulo: "Pestaña Usuarios",
    texto: "Coordinación puede activar o desactivar cuentas, restablecer contraseñas y quitar bloqueos desde la pestaña Usuarios.",
    roles: ["coord"],
  },
];

export const NOVEDADES_EVENT = "crm:open-novedades";
export const novedadesKey = (username: string) => `crm:novedades:${NOVEDADES_VERSION}:${username}`;

export function novedadesFor(role: Role): Novedad[] {
  return NOVEDADES.filter((n) => !n.roles || n.roles.includes(role));
}

export function openNovedades() {
  window.dispatchEvent(new CustomEvent(NOVEDADES_EVENT));
}
