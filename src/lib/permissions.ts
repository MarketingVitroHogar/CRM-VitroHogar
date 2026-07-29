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
};

export function assertCanAccessLead(user: SessionUser, lead: { sucursal: Sucursal }) {
  if (user.role === "gerente" && lead.sucursal !== user.sucursal) {
    throw new ForbiddenError("No autorizado para esta sucursal");
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
  "proximoSeguimiento",
  "notas",
  "folioCotizacion",
  "folioFactura",
  "montoVenta",
  "fechaCierre",
] as const;

/** For `gerente`, drops any key outside the whitelist. `coord` may edit everything. */
export function filterEditableFields(
  user: SessionUser,
  patch: Record<string, unknown>
): Record<string, unknown> {
  if (user.role === "coord") return patch;

  const allowed: Record<string, unknown> = {};
  for (const key of GERENTE_EDITABLE_FIELDS) {
    if (key in patch) allowed[key] = patch[key];
  }
  return allowed;
}
