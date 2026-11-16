import clsx from "clsx";

/** Comparación contra el periodo anterior. `menosEsMejor`: para métricas donde bajar es bueno (p. ej. sin seguimiento). */
export type Delta = { actual: number; anterior: number; menosEsMejor?: boolean; puntos?: boolean };

function deltaTexto(d: Delta): { texto: string; tono: "bien" | "mal" | "igual" } {
  const dif = d.actual - d.anterior;
  if (dif === 0) return { texto: "igual que el periodo anterior", tono: "igual" };
  const mejora = d.menosEsMejor ? dif < 0 : dif > 0;
  const flecha = dif > 0 ? "▲" : "▼";
  let magnitud: string;
  if (d.puntos) magnitud = `${Math.abs(Math.round(dif * 10) / 10)} pts`;
  else if (d.anterior === 0) magnitud = "nuevo";
  else magnitud = `${Math.abs(Math.round((dif / d.anterior) * 100))}%`;
  return { texto: `${flecha} ${magnitud} vs periodo anterior`, tono: mejora ? "bien" : "mal" };
}

export function MetricCard({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: Delta | null }) {
  const d = delta ? deltaTexto(delta) : null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {d && (
        <p className={clsx("mt-1 text-xs font-medium", d.tono === "bien" && "text-green-700", d.tono === "mal" && "text-red-600", d.tono === "igual" && "text-slate-400")}>
          {d.texto}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
