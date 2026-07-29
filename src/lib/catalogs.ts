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
  TLI: "TLI (Tienda en línea)",
};

export const FUENTES: Fuente[] = [
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "WHATSAPP",
  "SITIO_WEB",
  "REFERIDO",
  "OTRO",
];

export const FUENTE_LABELS: Record<Fuente, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  WHATSAPP: "WhatsApp",
  SITIO_WEB: "Sitio web",
  REFERIDO: "Referido",
  OTRO: "Otro",
};

export const ESTADOS: Estado[] = [
  "NUEVO",
  "CONTACTADO",
  "COTIZACION",
  "SEGUIMIENTO",
  "NO_RESPONDIO",
  "VENTA",
  "PERDIDO",
];

export const ESTADO_LABELS: Record<Estado, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  COTIZACION: "Cotización",
  SEGUIMIENTO: "Seguimiento",
  NO_RESPONDIO: "No respondió",
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

export const GERENTE_ALLOWED_ESTADOS: Estado[] = [
  "CONTACTADO",
  "COTIZACION",
  "SEGUIMIENTO",
  "NO_RESPONDIO",
  "VENTA",
  "PERDIDO",
];

export const RESPONSABLE_CM = "Community Manager";
export const RESPONSABLE_COORDINADOR = "Coordinador";

export function gerenteResponsableLabel(sucursal: Sucursal): string {
  return `Gerente ${SUCURSAL_LABELS[sucursal]}`;
}

export function gerenteUsername(sucursal: Sucursal): string {
  return `gerente.${sucursal.toLowerCase()}`;
}
