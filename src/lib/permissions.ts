import { Role, Sucursal } from "@prisma/client";

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type SessionUser = {
  id: string;
  role: Role;
  sucursal: Sucursal | null;
  asesor?: string | null;
};

/**
 * Filtro de leads que puede ver cada perfil (se aplica SIEMPRE en el servidor):
 *  - Coordinación: todos.
 *  - Gerente: los de su sucursal.
 *  - Asesor: solo los que su gerente le asignó (misma sucursal y su nombre como asesor).
 */
export function leadScopeWhere(user: SessionUser): { sucursal?: Sucursal; asesor?: string } {
  if (user.role === "gerente") return { sucursal: user.sucursal! };
  if (user.role === "asesor") return { sucursal: user.sucursal!, asesor: user.asesor || "__sin_asesor__" }; // un asesor sin nombre no ve nada
  return {};
}

export function assertCanAccessLead(user: SessionUser, lead: { sucursal: Sucursal; asesor?: string | null }) {
  if (user.role === "gerente" && lead.sucursal !== user.sucursal) {
    throw new ForbiddenError("No autorizado para esta sucursal");
  }
  if (user.role === "asesor") {
    if (lead.sucursal !== user.sucursal || !user.asesor || (lead.asesor ?? null) !== user.asesor) {
      throw new ForbiddenError("No autorizado: este lead no está asignado a ti");
    }
  }
}

export function assertCanCreate(user: SessionUser) {
  if (user.role !== "coord") {
    throw new ForbiddenError("Solo Coordinador/CM puede crear leads");
  }
}

export function assertCanDelete(user: SessionUser) {
  if (user.role !== "coord") {
    throw new ForbiddenError("Solo Coordinador/CM puede eliminar leads");
  }
}

export function assertCanImport(user: SessionUser) {
  if (user.role !== "coord") {
    throw new ForbiddenError("Solo Coordinador/CM puede importar leads");
  }
}

const GERENTE_EDITABLE_FIELDS = [
  "estado",
  "responsable",
  "asesor",
  "proximoSeguimiento",
  "notas",
  "folioCotizacion",
  "folioFactura",
  "montoVenta",
  "fechaCierre",
] as const;

// El asesor atiende SUS leads: no cambia de asesor (lo asigna el gerente) ni el responsable.
const ASESOR_EDITABLE_FIELDS = [
  "estado",
  "proximoSeguimiento",
  "notas",
  "folioCotizacion",
  "folioFactura",
  "montoVenta",
  "fechaCierre",
] as const;

/** Para `gerente` y `asesor`, descarta cualquier campo fuera de su lista permitida. `coord` puede editar todo. */
export function filterEditableFields(
  user: SessionUser,
  patch: Record<string, unknown>
): Record<string, unknown> {
  if (user.role === "coord") return patch;

  const fields: readonly string[] = user.role === "asesor" ? ASESOR_EDITABLE_FIELDS : GERENTE_EDITABLE_FIELDS;
  const allowed: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in patch) allowed[key] = patch[key];
  }
  return allowed;
}
