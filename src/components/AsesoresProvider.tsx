"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Sucursal } from "@prisma/client";

/** Asesores activos de cada sucursal (los administra Coordinación). Los lee el layout del servidor y los reparte a las pantallas. */
type Roster = Record<Sucursal, string[]>;

const Ctx = createContext<Roster | null>(null);

export function AsesoresProvider({ roster, children }: { roster: Roster; children: ReactNode }) {
  return <Ctx.Provider value={roster}>{children}</Ctx.Provider>;
}

/** Devuelve `asesoresFor(sucursal)`: la lista de asesores activos de esa sucursal. */
export function useAsesoresFor(): (sucursal: Sucursal) => string[] {
  const roster = useContext(Ctx);
  return (sucursal) => roster?.[sucursal] ?? [];
}
