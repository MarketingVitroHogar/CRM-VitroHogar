import { Estado, Fuente, Sucursal } from "@prisma/client";

export const SUCURSALES: Sucursal[] = [
  "BLVD_ZACATECAS",
  "UNIVERSIDAD",
  "HACIENDAS",
  "LOPEZ_MATEOS",
  "AYUNTAMIENTO",
  "PASEO_DE_LA_CRUZ",
  "RINCON_DE_ROMOS",
  "JESUS_MARIA",
  "GONZALEZ_GALLO",
  "JUAN_PABLO",
  "GUADALUPE",
  "COLON",
  "TLI",
];

export const SUCURSAL_LABELS: Record<Sucursal, string> = {
  BLVD_ZACATECAS: "Blvd. Zacatecas",
  UNIVERSIDAD: "Universidad",
  HACIENDAS: "Haciendas",
  LOPEZ_MATEOS: "López Mateos",
  AYUNTAMIENTO: "Ayuntamiento",
  PASEO_DE_LA_CRUZ: "Paseo de la Cruz",
  RINCON_DE_ROMOS: "Rincón de Romos",
  JESUS_MARIA: "Jesús María",
  GONZALEZ_GALLO: "González Gallo",
  JUAN_PABLO: "Juan Pablo",
  GUADALUPE: "Guadalupe",
  COLON: "Colón",
  TLI: "TLI (Tienda en línea)",
};

/** Canales de llegada que se pueden elegir al cargar un lead (y los que salen en los reportes). */
export const FUENTES: Fuente[] = ["FACEBOOK", "WHATSAPP", "INSTAGRAM", "TIKTOK", "SITIO_WEB"];

/** Todos los valores válidos en la base: incluye REFERIDO y OTRO, que solo existen en leads históricos. */
export const FUENTES_TODAS: Fuente[] = [...FUENTES, "REFERIDO", "OTRO"];

export const FUENTE_LABELS: Record<Fuente, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  WHATSAPP: "WhatsApp",
  SITIO_WEB: "Tienda en línea",
  REFERIDO: "Referido (histórico)",
  OTRO: "Otro (histórico)",
};

// Estados con los que se trabaja hoy. "Seguimiento" y "No respondió" son HISTÓRICOS: solo los conservan
// los leads que ya los tenían; no se pueden elegir de nuevo (igual que los canales Referido y Otro).
export const ESTADOS: Estado[] = ["NUEVO", "CONTACTADO", "COTIZACION", "VENTA", "PERDIDO"];
export const ESTADOS_HISTORICOS: Estado[] = ["SEGUIMIENTO", "NO_RESPONDIO"];
export const ESTADOS_TODOS: Estado[] = ["NUEVO", "CONTACTADO", "COTIZACION", "SEGUIMIENTO", "NO_RESPONDIO", "VENTA", "PERDIDO"];

export const ESTADO_LABELS: Record<Estado, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  COTIZACION: "Cotización",
  SEGUIMIENTO: "Seguimiento (histórico)",
  NO_RESPONDIO: "No respondió (histórico)",
  VENTA: "Venta",
  PERDIDO: "Perdido",
};

export const ESTADO_BADGE_CLASSES: Record<Estado, string> = {
  NUEVO: "bg-slate-200 text-slate-800",
  CONTACTADO: "bg-blue-100 text-blue-800",
  COTIZACION: "bg-amber-100 text-amber-800",
  SEGUIMIENTO: "bg-purple-100 text-purple-800",
  NO_RESPONDIO: "bg-orange-100 text-orange-800",
  VENTA: "bg-green-100 text-green-800",
  PERDIDO: "bg-red-100 text-red-800",
};

export const GERENTE_ALLOWED_ESTADOS: Estado[] = ["CONTACTADO", "COTIZACION", "VENTA", "PERDIDO"];

export const RESPONSABLE_CM = "Community Manager";
export const RESPONSABLE_COORDINADOR = "Coordinador";

export function gerenteResponsableLabel(sucursal: Sucursal): string {
  return `Gerente ${SUCURSAL_LABELS[sucursal]}`;
}

export function gerenteUsername(sucursal: Sucursal): string {
  return `gerente.${sucursal.toLowerCase()}`;
}

// Los asesores (vendedores de piso) de cada sucursal ya no viven aquí: están en la base de datos (tabla Asesor) y los administra
// Coordinación desde Usuarios → Asesores. Se leen con getRoster() / asesoresActivos() (src/lib/asesores.ts) en el servidor y con
// useAsesoresFor() (AsesoresProvider) en las pantallas. Son distintos de "responsable" (CM / Coordinador / Gerente).
