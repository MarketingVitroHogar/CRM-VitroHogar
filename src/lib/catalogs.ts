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

// Roster of asesores (vendedores de piso) por sucursal, distinto de
// "responsable" (quién da seguimiento a nivel CRM: CM/Coordinador/Gerente).
// Blvd. Zacatecas no tiene lista todavía — agregar cuando esté disponible.
export const ASESORES_POR_SUCURSAL: Record<Sucursal, string[]> = {
  BLVD_ZACATECAS: [],
  UNIVERSIDAD: ["Ernesto Arturo Frausto Esparza", "Luis Fernando Muñoz Muñoz", "Jose Alfredo Macias Rodriguez"],
  HACIENDAS: ["Saray Salgado", "Miguel Torres", "Armando Gonzalez"],
  LOPEZ_MATEOS: ["Jose Andrés Mireles Cornejo", "Hugo Enrique Gonzalez Lara"],
  AYUNTAMIENTO: ["Jesús Daniel Pérez Rios", "Karla Fabiola Morales Ramírez", "Bricia Thalía Silva Pérez"],
  PASEO_DE_LA_CRUZ: ["Diana Limon", "David Medellin", "Alejandra Raygoza", "Miriam Cota", "Adrián Perez"],
  RINCON_DE_ROMOS: [
    "Ma del Rocío Flores Roa",
    "Wendoline Calderón Márgenes",
    "José Armando Suárez Salazar",
    "José Luis Ureña Ovalle",
  ],
  JESUS_MARIA: ["José Ignacio Galván Picón", "Raúl De Jesús De Luna Lugo"],
  GONZALEZ_GALLO: ["Sara Edelia Oregel Jara", "Yolanda Rios Reyes", "Lucía Adriana Salgado Rodríguez"],
  JUAN_PABLO: ["Lucio"],
  GUADALUPE: ["Junior Gamaliel Ramirez Rodriguez", "Mayra Elizabeth Lugo Najar", "Norma Del Carmen Gonzalez Garcia"],
  TLI: ["Cristian", "Karen", "Estefania"],
};

export function asesoresFor(sucursal: Sucursal): string[] {
  return ASESORES_POR_SUCURSAL[sucursal];
}
