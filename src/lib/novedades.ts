import type { Role } from "@prisma/client";

/**
 * Aviso de "Novedades" del CRM. Al cambiar NOVEDADES_VERSION, todas las personas vuelven a ver el aviso
 * una vez (se guarda en su navegador, por usuario). Aquí se listan los cambios; no hay nada más que tocar.
 */
export const NOVEDADES_VERSION = "2026-11-17";

export type Novedad = { icono: string; titulo: string; texto: string; roles?: Role[] };

export const NOVEDADES: Novedad[] = [
  {
    icono: "🏠",
    titulo: "Nueva pantalla de Inicio",
    texto:
      "Al entrar verás tus pendientes del día: leads sin asignar, leads sin atender y seguimientos de hoy, junto con el desempeño del mes (solo se muestra lo del mes en curso para evitar confusiones). Coordinación ve lo mismo a nivel de todas las sucursales, más los leads cargados y los canales.",
  },
  {
    icono: "👤",
    titulo: "Asignar asesor en un paso",
    texto:
      "Los leads sin asesor muestran el botón Asignar (en Inicio, en Leads y en la campana). En Leads, el aviso \"por asignar\" te muestra solo los que faltan.",
    roles: ["gerente"],
  },
  {
    icono: "⚡",
    titulo: "Captura rápida de leads",
    texto:
      "Nuevo lead ahora pide solo nombre, teléfono, interés, canal y sucursal. Usa \"Guardar y cargar otro\" para registrar varios seguidos; avisa si el teléfono ya existe.",
    roles: ["coord"],
  },
  {
    icono: "🔍",
    titulo: "Filtro por periodo y mejor búsqueda",
    texto:
      "En Leads y en Reportes ahora puedes filtrar por Hoy, Ayer, Esta semana, Este mes o un rango personalizado. El buscador de leads busca mientras escribes, sin importar acentos o mayúsculas, y encuentra por nombre, teléfono, interés, asesor o folio.",
  },
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

/**
 * Para Coordinación, el aviso sale en CADA entrada (aunque lo cierre o lo abra las veces que sea)
 * hasta el 17 de noviembre de 2026 a las 12:00 h de México (UTC-6 → 18:00 UTC). Después vuelve a la
 * regla normal: una sola vez por persona y versión.
 */
export const NOVEDADES_COORD_HASTA = new Date("2026-11-17T18:00:00.000Z");

/** ¿Debe abrirse el aviso de Novedades automáticamente al entrar? */
export function debeMostrarNovedades(role: Role, yaVisto: boolean, ahora: Date = new Date()): boolean {
  if (!yaVisto) return true;
  return role === "coord" && ahora.getTime() < NOVEDADES_COORD_HASTA.getTime();
}

export function openNovedades() {
  window.dispatchEvent(new CustomEvent(NOVEDADES_EVENT));
}
