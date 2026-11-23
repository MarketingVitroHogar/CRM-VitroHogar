import clsx from "clsx";

const ICONOS = { ok: "✅", buscar: "🔍", grafica: "📊", leads: "📥", venta: "💰" } as const;

/** Mensaje cuando no hay nada que mostrar: qué pasa, por qué y (si se puede) qué hacer. */
export function EstadoVacio({
  icono = "ok",
  titulo,
  texto,
  compact = false,
  children,
}: {
  icono?: keyof typeof ICONOS;
  titulo: string;
  texto?: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={clsx("flex flex-col items-center text-center", compact ? "gap-1 py-4" : "gap-1.5 py-10")}>
      <span aria-hidden className={clsx("grid place-items-center rounded-full bg-slate-100", compact ? "h-9 w-9 text-lg" : "h-12 w-12 text-2xl")}>
        {ICONOS[icono]}
      </span>
      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
      {texto && <p className="max-w-xs text-xs text-slate-500">{texto}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
