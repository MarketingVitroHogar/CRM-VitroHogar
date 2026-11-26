import type { Role, Sucursal } from "@prisma/client";

/**
 * Aviso de "Novedades" del CRM. Cada novedad lleva la versión (`v`) en que se publicó. Al entrar, cada persona ve SOLO las
 * novedades más recientes que su última visita (se guarda en su navegador, por usuario); el menú "Novedades" muestra todas.
 *
 * Para anunciar un cambio: agrega la entrada ARRIBA de la lista con una `v` nueva (mayor que las anteriores,
 * p. ej. "2026-11-22") y sube NOVEDADES_VERSION a ese mismo valor. No hay nada más que tocar.
 */
export const NOVEDADES_VERSION = "2026-11-26";

/**
 * `roles`: solo para esos perfiles. `sucursales`: solo para los gerentes de esas sucursales (p. ej. un asesor nuevo en una
 * sucursal solo se anuncia a su gerente, no a todos).
 */
export type Novedad = { icono: string; titulo: string; texto: string; v: string; roles?: Role[]; sucursales?: Sucursal[] };

export const NOVEDADES: Novedad[] = [
  {
    icono: "👋",
    titulo: "Bienvenido al CRM",
    v: "2026-11-26",
    roles: ["asesor"],
    texto:
      "Tu usuario es tu número de nómina. Aquí ves los leads que te asignan. Abre un lead para actualizar su estado, seguimiento, notas, folios y venta. En Inicio ves tus pendientes y tu desempeño del mes, y en Reportes los números de tu sucursal. Puedes cambiar tu contraseña desde tu nombre de usuario, arriba a la derecha.",
  },
  {
    icono: "🧑‍💼",
    titulo: "Los asesores de Tienda en línea ya tienen usuario",
    v: "2026-11-26",
    sucursales: ["TLI"],
    texto:
      "Cristian, Karen y Paola ya pueden entrar al CRM con su propio usuario (su número de nómina) y ver solo los leads que se les asignen. Ellos actualizan el estado, el seguimiento, las notas y las ventas de sus leads. Los leads de la sucursal los pueden asignar tanto tú como Coordinación, y tú ves todos los de la sucursal. Coordinación les entrega su contraseña inicial.",
  },
  {
    icono: "🔐",
    titulo: "Asesores de Tienda en línea: cuentas y asignación",
    v: "2026-11-26",
    roles: ["coord"],
    texto:
      "Los asesores de Tienda en línea ya tienen cuenta y su usuario es su número de nómina. En la pestaña Usuarios aparecen como Asesor y puedes activarlas, desactivarlas o restablecer su contraseña igual que las demás. Además, ahora puedes asignar el asesor de los leads de Tienda en línea (botón Asignar asesor o al editar el lead); en las demás sucursales lo sigue asignando el gerente.",
  },
  {
    icono: "👥",
    titulo: "Nuevos asesores en Juan Pablo",
    v: "2026-11-23",
    sucursales: ["JUAN_PABLO"],
    texto: "En la sucursal Juan Pablo ya aparecen Mario Rafael Butron Muñoz y Christian Oswaldo Tavares Hernandez para que el gerente les asigne leads. Lucio ya no está en la lista.",
  },
  {
    icono: "🔔",
    titulo: "Seguimientos en la campana y avisos en el navegador",
    v: "2026-11-22",
    texto:
      "La campana ahora también te avisa de los seguimientos de hoy o vencidos de los leads que ya contactaste. Además, en el menú de la campana puedes activar un aviso del navegador y un sonido para enterarte al momento cuando llega un lead nuevo, aunque estés en otra pestaña (funciona mientras el CRM esté abierto).",
  },
  {
    icono: "🔄",
    titulo: "Las pantallas se actualizan solas",
    v: "2026-11-22",
    texto: "Leads e Inicio se actualizan solos cada minuto, para que veas los leads nuevos y los cambios sin tener que recargar la página.",
  },
  {
    icono: "✏️",
    titulo: "Editar un lead en un panel lateral",
    v: "2026-11-21",
    texto:
      "Al tocar un lead (o su lápiz) ya no se abre otra pantalla: se abre un panel a la derecha, encima de la lista, igual que al cargar un lead nuevo. Guardas y la lista se actualiza sola. Lo mismo pasa al abrir un lead desde Inicio o desde la campana. Si necesitas la ficha completa, abre el lead con Ctrl + clic.",
  },
  {
    icono: "📂",
    titulo: "Abiertos de meses anteriores",
    v: "2026-11-20-c",
    texto:
      "En Inicio hay una tarjeta nueva con los leads que siguen sin cerrar (ni venta ni perdido) de meses anteriores, y cuántos tienen el seguimiento vencido. Así no se pierden de vista aunque Inicio y la campana solo muestren el mes en curso. Tócala para verlos en Leads.",
  },
  {
    icono: "👩‍💼",
    titulo: "Nueva asesora en López Mateos",
    v: "2026-11-20-b",
    sucursales: ["LOPEZ_MATEOS"],
    texto: "Karen Paola Ponce Reyes ya aparece entre los asesores de la sucursal López Mateos, para que el gerente le pueda asignar leads.",
  },
  {
    icono: "⏰",
    titulo: "Filtro “Sin seguimiento” en Leads",
    v: "2026-11-20-b",
    texto:
      "En el menú Estado de Leads (también en Kanban) ya puedes elegir “Sin seguimiento” para ver de inmediato los leads que llevan tiempo sin atenderse: los mismos que aparecen marcados como “Sin seguimiento a tiempo”.",
  },
  {
    icono: "🌙",
    titulo: "Modo noche: menús más legibles",
    v: "2026-11-20-b",
    texto:
      "Corregimos los menús desplegables (sucursal, estado, periodo…) que en algunos equipos se veían en blanco en modo noche. Si aún notas algo raro, avísanos con el nombre del navegador que usas.",
  },
  {
    icono: "🌙",
    titulo: "Modo noche",
    v: "2026-11-20",
    texto:
      "Ahora puedes cambiar a modo noche con el botón de la luna, arriba junto a tu nombre. Es más cómodo para trabajar de noche o con poca luz. El CRM recuerda tu elección; si prefieres, en tu menú puedes elegir “Modo según el dispositivo”.",
  },
  {
    icono: "✅",
    titulo: "Marcar todo como leído",
    v: "2026-11-20",
    texto:
      "En la campana de avisos hay un botón para marcar todo como leído y apagar el número rojo. Los leads siguen pendientes en Inicio y en Leads, y la campana vuelve a avisarte solo cuando llega algo nuevo.",
  },
  {
    icono: "➕",
    titulo: "Nuevo lead en un panel lateral",
    v: "2026-11-20",
    texto:
      "Coordinación ahora carga los leads desde un panel que se abre encima de la lista de Leads, sin cambiar de pantalla. “Guardar y cargar otro” deja el panel abierto para registrar varios seguidos.",
  },
  {
    icono: "🤝",
    titulo: "Coordinación elige la sucursal; el gerente asigna al asesor",
    v: "2026-11-20",
    texto:
      "Al cargar un lead, Coordinación solo indica la sucursal a la que va. El gerente de esa sucursal es quien asigna al asesor que lo atiende. En Colón, por ahora, el lead se asigna a Alejandra.",
  },
  {
    icono: "🏷️",
    titulo: "Estados: Seguimiento y No respondió ahora son históricos",
    v: "2026-11-20",
    texto:
      "Los estados de trabajo son Nuevo, Contactado, Cotización, Venta y Perdido. Los leads que ya estaban en Seguimiento o No respondió se conservan, marcados como “histórico”, pero ya no se pueden elegir. Lo mismo pasa con los canales Referido y Otro.",
  },
  {
    icono: "🏠",
    titulo: "Nueva pantalla de Inicio",
    v: "2026-11-17",
    texto:
      "Al entrar verás tus pendientes del día: leads sin asignar, leads sin atender y seguimientos de hoy, junto con el desempeño del mes (solo se muestra lo del mes en curso para evitar confusiones). Coordinación ve lo mismo a nivel de todas las sucursales, más los leads cargados y los canales.",
  },
  {
    icono: "👤",
    titulo: "Asignar asesor en un paso",
    v: "2026-11-17",
    texto:
      "Los leads sin asesor muestran el botón Asignar al gerente (en Inicio, en Leads y en la campana). En Leads, el aviso \"por asignar\" le muestra solo los que faltan.",
  },
  {
    icono: "⚡",
    titulo: "Captura rápida de leads",
    v: "2026-11-17",
    texto:
      "Nuevo lead ahora pide solo nombre, teléfono, interés, canal y sucursal. Usa \"Guardar y cargar otro\" para registrar varios seguidos; avisa si el teléfono ya existe.",
  },
  {
    icono: "🔍",
    titulo: "Filtro por periodo y mejor búsqueda",
    v: "2026-11-16-b",
    texto:
      "En Leads y en Reportes ahora puedes filtrar por Hoy, Ayer, Esta semana, Este mes o un rango personalizado. El buscador de leads busca mientras escribes, sin importar acentos o mayúsculas, y encuentra por nombre, teléfono, interés, asesor o folio.",
  },
  {
    icono: "▦",
    titulo: "Leads en Kanban, Lista o Tarjetas",
    v: "2026-11-16-b",
    texto:
      "En Leads ahora puedes ver tus leads como tablero (Kanban), como lista o como tarjetas, y el CRM recuerda tu elección. En el Kanban arrastra un lead de una columna a otra para cambiar su estado.",
  },
  {
    icono: "🔔",
    titulo: "Campana de avisos",
    v: "2026-11-16-b",
    texto:
      "La campana de arriba te muestra los leads nuevos por atender y cuáles llevan más de 24 horas sin atenderse. Se actualiza sola y te avisa cuando llega uno nuevo.",
  },
  {
    icono: "🔑",
    titulo: "Cambiar tu contraseña",
    v: "2026-11-16-b",
    texto: "Puedes cambiar tu contraseña cuando quieras desde tu nombre de usuario, arriba a la derecha → Cambiar contraseña.",
  },
  {
    icono: "👥",
    titulo: "Pestaña Usuarios",
    v: "2026-11-16-b",
    texto: "Coordinación puede activar o desactivar cuentas, restablecer contraseñas y quitar bloqueos desde la pestaña Usuarios.",
    roles: ["coord"],
  },
];

export const NOVEDADES_EVENT = "crm:open-novedades";
/** Última versión de Novedades que esta persona ya vio. */
export const novedadesVistaKey = (username: string) => `crm:novedades-vista:${username}`;
/** Clave que se usaba antes (una por versión): sirve para no volver a mostrar lo que ya se había visto. */
const novedadesKeyAntigua = (version: string, username: string) => `crm:novedades:${version}:${username}`;

/** Sin ningún registro (equipo nuevo o primera vez), solo se muestran las más recientes. */
export const MAX_SIN_REGISTRO = 5;

export function novedadesFor(role: Role, sucursal: Sucursal | null = null): Novedad[] {
  return NOVEDADES.filter((n) => {
    if (n.roles && !n.roles.includes(role)) return false;
    // Avisos de una sucursal: solo los ve el gerente de esa sucursal.
    if (n.sucursales && !(role === "gerente" && sucursal && n.sucursales.includes(sucursal))) return false;
    return true;
  });
}

/** Las novedades que esta persona todavía no ha visto: las publicadas después de su última visita. */
export function novedadesNuevas(role: Role, sucursal: Sucursal | null, ultimaVista: string | null): Novedad[] {
  const mias = novedadesFor(role, sucursal);
  if (!ultimaVista) return mias.slice(0, MAX_SIN_REGISTRO);
  return mias.filter((n) => n.v > ultimaVista);
}

/** Lee del navegador la última versión vista (null = nunca). Solo en el cliente. */
export function leerUltimaVista(username: string): string | null {
  try {
    const guardada = localStorage.getItem(novedadesVistaKey(username));
    if (guardada) return guardada;
    // Compatibilidad: personas que ya habían visto versiones con la clave anterior.
    const versiones = [...new Set(NOVEDADES.map((n) => n.v))].sort().reverse();
    for (const v of versiones) {
      if (localStorage.getItem(novedadesKeyAntigua(v, username))) return v;
    }
  } catch {
    /* sin almacenamiento */
  }
  return null;
}

export function guardarUltimaVista(username: string) {
  try {
    localStorage.setItem(novedadesVistaKey(username), NOVEDADES_VERSION);
  } catch {
    /* ignorar */
  }
}

/** Abre el aviso con TODAS las novedades (menú de usuario → Novedades). */
export function openNovedades() {
  window.dispatchEvent(new CustomEvent(NOVEDADES_EVENT));
}
