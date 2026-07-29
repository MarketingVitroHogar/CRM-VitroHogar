import clsx from "clsx";
import type { Estado } from "@prisma/client";
import { ESTADO_BADGE_CLASSES, ESTADO_LABELS } from "@/lib/catalogs";

export function EstadoBadge({ estado }: { estado: Estado }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ESTADO_BADGE_CLASSES[estado]
      )}
    >
      {ESTADO_LABELS[estado]}
    </span>
  );
}
