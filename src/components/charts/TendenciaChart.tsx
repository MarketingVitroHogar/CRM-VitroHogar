type Punto = { key: string; label: string; leads: number; ventas: number };

/**
 * Gráfica de barras: leads (gris oscuro) y ventas (verde) por día, semana o mes.
 * Es SVG puro (sin librerías) y se adapta al ancho; cada barra tiene su valor como texto al pasar el mouse.
 */
export function TendenciaChart({ puntos, altura = 180 }: { puntos: Punto[]; altura?: number }) {
  if (puntos.length === 0 || puntos.every((p) => p.leads === 0 && p.ventas === 0)) {
    return <p className="py-8 text-center text-sm text-slate-400">Sin movimiento en este periodo.</p>;
  }
  const max = Math.max(1, ...puntos.map((p) => Math.max(p.leads, p.ventas)));
  const W = 640;
  const padL = 28;
  const padB = 28;
  const padT = 8;
  const H = altura;
  const plotW = W - padL - 4;
  const plotH = H - padB - padT;
  const slot = plotW / puntos.length;
  const barW = Math.max(2, Math.min(16, slot / 2.6));
  const step = Math.max(1, Math.ceil(puntos.length / 10)); // etiquetas del eje X sin amontonarse
  const ticks = [0, Math.ceil(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Leads y ventas por periodo">
        {ticks.map((t) => {
          const y = padT + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 4} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                {t}
              </text>
            </g>
          );
        })}
        {puntos.map((p, i) => {
          const cx = padL + slot * i + slot / 2;
          const hL = (p.leads / max) * plotH;
          const hV = (p.ventas / max) * plotH;
          return (
            <g key={p.key}>
              <title>{`${p.label}: ${p.leads} leads, ${p.ventas} ventas`}</title>
              <rect x={cx - barW - 0.5} y={padT + plotH - hL} width={barW} height={hL} rx="1.5" fill="#475569" />
              <rect x={cx + 0.5} y={padT + plotH - hV} width={barW} height={hV} rx="1.5" fill="#22c55e" />
              {i % step === 0 && (
                <text x={cx} y={H - 10} textAnchor="middle" fontSize="9" fill="#64748b">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 flex items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-600" aria-hidden /> Leads ingresados
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-500" aria-hidden /> Ventas cerradas
        </span>
      </p>
    </div>
  );
}
