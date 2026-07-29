import type { Estado, Fuente, Sucursal } from "@prisma/client";

// Shape of a Lead as it comes back from the API (JSON — dates are ISO
// strings, Decimal is serialized as a string).
export type LeadDTO = {
  id: string;
  fecha: string;
  nombre: string;
  telefono: string;
  sucursal: Sucursal;
  interes: string;
  fuente: Fuente;
  estado: Estado;
  responsable: string;
  proximoSeguimiento: string | null;
  notas: string;
  folioCotizacion: string | null;
  folioFactura: string | null;
  montoVenta: string | null;
  fechaCierre: string | null;
  createdAt: string;
  updatedAt: string;
};
