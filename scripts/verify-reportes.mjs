// Pruebas de los Reportes (comparativo, tendencia, embudo, canales, asesores, ticket promedio y Excel)
// contra un servidor LOCAL de prueba.   node scripts/verify-reportes.mjs   (http://localhost:3001)
import * as XLSX from "xlsx";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("Solo se permite contra un servidor local de prueba");
const PW = "ChangeMe123!";

class Client {
  jar = new Map();
  absorb(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i), val = pair.slice(i + 1);
      if (val === "" || /Max-Age=0/i.test(c)) this.jar.delete(name);
      else this.jar.set(name, val);
    }
  }
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  async raw(path, opts = {}) {
    const res = await fetch(BASE + path, { redirect: "manual", ...opts, headers: { ...(opts.headers ?? {}), cookie: this.cookie() } });
    this.absorb(res);
    return res;
  }
  async json(path, method = "GET", body) {
    const res = await this.raw(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, body: data };
  }
  async xlsx(path) {
    const res = await this.raw(path);
    if (res.status !== 200) return { status: res.status, wb: null, res };
    return { status: 200, wb: XLSX.read(Buffer.from(await res.arrayBuffer())), res };
  }
  async login(username, password) {
    const c = await this.raw("/api/auth/csrf"); const { csrfToken } = await c.json();
    const res = await this.raw("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, username, password, json: "true" }) });
    const data = await res.json().catch(() => ({}));
    return { ok: [...this.jar.keys()].some((k) => /session-token/.test(k)) && !(data.url && /error=/.test(data.url)) };
  }
}
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, extra); } };
const as = async (u) => { const c = new Client(); if (!(await c.login(u, PW)).ok) throw new Error("login " + u); return c; };
const denied = (st) => st === 401 || st === 307;
const rows = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });

const mexNow = new Date(Date.now() - 6 * 3_600_000);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const HOY = iso(mexNow);
const D = (n) => addDays(HOY, n);
const TAG = "REP" + Math.floor(Math.random() * 1e6);
const CANALES = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "WHATSAPP", "SITIO_WEB", "REFERIDO", "OTRO"];
const ESTADOS = ["NUEVO", "CONTACTADO", "COTIZACION", "SEGUIMIENTO", "NO_RESPONDIO", "VENTA", "PERDIDO"];

async function main() {
  const coord = await as("coord");
  const colon = await as("gerente.colon");
  const blvd = await as("gerente.blvd_zacatecas");
  const ids = [];
  const mk = async (extra) => {
    const r = await coord.json("/api/leads", "POST", { nombre: "Lead Reporte", telefono: "4920002222", sucursal: "COLON", interes: TAG, fuente: "FACEBOOK", fecha: D(0), ...extra });
    if (r.status !== 201) throw new Error("no se pudo crear: " + JSON.stringify(r.body));
    ids.push(r.body.lead.id);
    return r.body.lead.id;
  };
  // Periodo actual = últimos 7 días; periodo anterior = los 7 días previos
  const ACT = `from=${D(-6)}&to=${D(0)}`;
  const rep = async (c, qs = ACT) => (await c.json(`/api/reports?${qs}`)).body;

  const antes = await rep(colon);
  const antesAsesor = (await rep(coord)).porAsesor;

  // Datos de prueba conocidos (todos en Colón, salvo uno de Blvd.)
  await mk({ fecha: D(-1), fuente: "TIKTOK" });
  await mk({ fecha: D(-2), fuente: "TIKTOK", estado: "SEGUIMIENTO", proximoSeguimiento: D(3) });
  await mk({ fecha: D(-3), fuente: "REFERIDO", estado: "COTIZACION" });
  await mk({ fecha: D(-4), fuente: "WHATSAPP", estado: "VENTA", montoVenta: 1000, fechaCierre: D(-2) });
  await mk({ fecha: D(-5), fuente: "OTRO", estado: "VENTA", montoVenta: 3000, fechaCierre: D(-1) });
  await mk({ fecha: D(-3), fuente: "FACEBOOK", estado: "PERDIDO", fechaCierre: D(-1) });
  await mk({ fecha: D(-10), fuente: "INSTAGRAM" }); // periodo anterior
  const B1 = await mk({ fecha: D(-1), sucursal: "BLVD_ZACATECAS", asesor: "Genaro Samuel Alvarado Melesio", estado: "VENTA", montoVenta: 500, fechaCierre: D(0) });

  const despues = await rep(colon);
  const mC = despues.metrics, mA = antes.metrics;

  console.log("\n== Comparativo con el periodo anterior ==");
  check("trae el periodo anterior de la misma duración (7 días justo antes)", despues.comparativo && despues.comparativo.desde === D(-13) && despues.comparativo.hasta === D(-7));
  check("el periodo actual suma los 6 leads de prueba de Colón", mC.totalLeads - mA.totalLeads === 6);
  check("el periodo anterior suma 1 lead de prueba (el de hace 10 días)", despues.comparativo.metrics.totalLeads - antes.comparativo.metrics.totalLeads === 1);
  check("ventas y total vendido del periodo (2 ventas: $1,000 + $3,000)", mC.ventas - mA.ventas === 2 && mC.totalVendido - mA.totalVendido === 4000);
  check("ticket promedio = total vendido ÷ ventas", mC.ticketPromedio === Math.round((mC.totalVendido / mC.ventas) * 100) / 100);
  check("'todo el tiempo' no compara", (await coord.json("/api/reports")).body.comparativo === null);
  check("el comparativo incluye las mismas métricas (incluido el ticket)", ["totalLeads", "ventas", "totalVendido", "ticketPromedio", "tasaConversion"].every((k) => typeof despues.comparativo.metrics[k] === "number"));

  console.log("\n== Gráfica de tendencia ==");
  check("7 días → un punto por día", despues.tendencia.granularidad === "dia" && despues.tendencia.puntos.length === 7);
  check("la tendencia suma los leads del periodo", despues.tendencia.puntos.reduce((n, p) => n + p.leads, 0) === mC.totalLeads);
  check("la tendencia suma las ventas del periodo", despues.tendencia.puntos.reduce((n, p) => n + p.ventas, 0) === mC.ventas);
  const pDia = (r, d) => r.tendencia.puntos.find((p) => p.key === d);
  check("un día concreto suma justo lo creado (hace 3 días: 2 leads)", pDia(despues, D(-3)).leads - pDia(antes, D(-3)).leads === 2);
  check("las ventas se ubican por fecha de cierre (hace 2 días: 1 venta de $1,000)", pDia(despues, D(-2)).ventas - pDia(antes, D(-2)).ventas === 1 && pDia(despues, D(-2)).monto - pDia(antes, D(-2)).monto === 1000);
  const largo = await rep(coord, `from=${D(-90)}&to=${D(0)}`);
  check("90 días → por semana", largo.tendencia.granularidad === "semana" && largo.tendencia.puntos.length >= 12 && largo.tendencia.puntos.length <= 15);
  const todo = (await coord.json("/api/reports")).body;
  check("todo el tiempo → nunca cientos de barras", todo.tendencia.puntos.length <= 90 && todo.tendencia.puntos.reduce((n, p) => n + p.leads, 0) === todo.metrics.totalLeads);

  console.log("\n== Canales de llegada (los del CRM) ==");
  check("salen los 7 canales: Facebook, Instagram, TikTok, WhatsApp, Sitio web, Referido y Otro", despues.porCanal.length === 7 && CANALES.every((c) => despues.porCanal.some((x) => x.fuente === c)), JSON.stringify(despues.porCanal.map((x) => x.fuente)));
  const can = (r, c) => r.porCanal.find((x) => x.fuente === c);
  check("TikTok +2 leads, Referido +1, WhatsApp +1 con su venta de $1,000", can(despues, "TIKTOK").total - can(antes, "TIKTOK").total === 2 && can(despues, "REFERIDO").total - can(antes, "REFERIDO").total === 1 && can(despues, "WHATSAPP").ventas - can(antes, "WHATSAPP").ventas === 1 && can(despues, "WHATSAPP").monto - can(antes, "WHATSAPP").monto === 1000);
  check("los canales suman los leads del periodo y van ordenados por volumen", despues.porCanal.reduce((n, c) => n + c.total, 0) === mC.totalLeads && despues.porCanal.every((c, i, a) => i === 0 || a[i - 1].total >= c.total));
  const vacio = await rep(coord, "from=2020-01-01&to=2020-01-02");
  check("sin leads en el periodo siguen saliendo los 7 canales (en cero)", vacio.porCanal.length === 7 && vacio.porCanal.every((c) => c.total === 0 && c.porcentaje === 0));

  console.log("\n== Embudo (los estados del CRM) ==");
  check("el embudo trae los 7 estados en su orden", JSON.stringify(despues.embudo.map((e) => e.estado)) === JSON.stringify(ESTADOS));
  const est = (r, e) => r.embudo.find((x) => x.estado === e).total;
  check("Seguimiento +1, Cotización +1, Perdido +1, Venta +2, Nuevo +2", est(despues, "SEGUIMIENTO") - est(antes, "SEGUIMIENTO") === 1 && est(despues, "COTIZACION") - est(antes, "COTIZACION") === 1 && est(despues, "PERDIDO") - est(antes, "PERDIDO") === 1 && est(despues, "VENTA") - est(antes, "VENTA") === 2 && est(despues, "NUEVO") - est(antes, "NUEVO") === 1);
  check("el embudo suma los leads del periodo", despues.embudo.reduce((n, e) => n + e.total, 0) === mC.totalLeads);
  check("sin leads siguen los 7 estados", vacio.embudo.length === 7);

  console.log("\n== Desempeño por asesor ==");
  const rc = await rep(coord);
  const gen = (rows) => rows.find((a) => a.asesor.startsWith("Genaro") && a.sucursal === "BLVD_ZACATECAS");
  check("Coordinación ve la venta de $500 de Genaro (Blvd. Zacatecas)", gen(rc.porAsesor).ventas - (gen(antesAsesor)?.ventas ?? 0) === 1 && gen(rc.porAsesor).monto - (gen(antesAsesor)?.monto ?? 0) === 500);
  check("por asesor suma los leads y trae 'Sin asignar'", rc.porAsesor.reduce((n, a) => n + a.leads, 0) === rc.metrics.totalLeads && rc.porAsesor.some((a) => a.asesor === "Sin asignar"));
  check("viene ordenado por monto vendido", rc.porAsesor.every((a, i, x) => i === 0 || x[i - 1].monto >= a.monto));
  check("trae leads, ventas, monto y conversión", rc.porAsesor.every((a) => ["leads", "ventas", "monto", "conversion"].every((k) => typeof a[k] === "number")));

  console.log("\n== Alcance por rol ==");
  check("el gerente de Colón: sin comparativo de sucursales y solo su sucursal por asesor", despues.porSucursal.length === 0 && (await rep(colon)).porAsesor.every((a) => a.sucursal === "COLON"));
  check("el gerente de Colón NO ve la venta de Blvd. (Genaro)", !despues.porAsesor.some((a) => a.asesor.startsWith("Genaro")));
  const rb = await rep(blvd);
  check("el gerente de Blvd. Zacatecas sí ve a Genaro y no a asesores de otras sucursales", rb.porAsesor.some((a) => a.asesor.startsWith("Genaro")) && rb.porAsesor.every((a) => a.sucursal === "BLVD_ZACATECAS"));
  check("Coordinación ve el comparativo por sucursal", rc.porSucursal.length >= 2);
  check("sin sesión se niega", denied((await new Client().json(`/api/reports?${ACT}`)).status));

  console.log("\n== Exportar el reporte a Excel ==");
  const x = await coord.xlsx(`/api/reports/export?${ACT}`);
  check("responde un archivo .xlsx para descargar", x.status === 200 && /spreadsheetml/.test(x.res.headers.get("content-type")) && /attachment; filename="reporte-/.test(x.res.headers.get("content-disposition")));
  check("hojas: Resumen, Tendencia, Por canal, Por sucursal, Por asesor y Embudo", ["Resumen", "Por canal", "Por sucursal", "Por asesor", "Embudo"].every((n) => x.wb.SheetNames.includes(n)) && x.wb.SheetNames.some((n) => n.startsWith("Tendencia")));
  const resumen = rows(x.wb, "Resumen");
  const val = (label) => resumen.find((r) => r[0] === label);
  check("el Resumen coincide con la pantalla (leads, ventas, total vendido, ticket)", val("Leads totales")[1] === rc.metrics.totalLeads && val("Ventas")[1] === rc.metrics.ventas && val("Total vendido (MXN)")[1] === rc.metrics.totalVendido && val("Ticket promedio (MXN)")[1] === rc.metrics.ticketPromedio);
  check("el Resumen trae la columna del periodo anterior", String(resumen.find((r) => r[0] === "Métrica")[2]).startsWith("Periodo anterior"));
  check("'Por canal' trae los 7 canales y 'Embudo' los 7 estados", rows(x.wb, "Por canal").length === 8 && rows(x.wb, "Embudo").length === 8);
  check("'Por canal' coincide con la pantalla", rows(x.wb, "Por canal").slice(1).reduce((n, r) => n + r[1], 0) === rc.metrics.totalLeads);
  const xg = await colon.xlsx(`/api/reports/export?${ACT}`);
  check("el gerente exporta solo su sucursal (sin hoja 'Por sucursal')", xg.status === 200 && !xg.wb.SheetNames.includes("Por sucursal") && rows(xg.wb, "Resumen").some((r) => String(r[1] ?? "").includes("Colón")) && rows(xg.wb, "Resumen").find((r) => r[0] === "Leads totales")[1] === mC.totalLeads);
  check("exportar 'todo el tiempo' funciona", (await coord.xlsx("/api/reports/export")).status === 200);
  check("exportar sin sesión se niega", denied((await new Client().raw("/api/reports/export")).status));
  check("periodo inválido → 400", (await coord.raw("/api/reports/export?from=hoy&to=ayer")).status === 400);

  console.log("\n== Pantalla ==");
  const page = await coord.raw("/reports");
  check("la página /reports abre", page.status === 200);
  check("la página es la de siempre para el gerente", (await colon.raw("/reports")).status === 200);

  for (const id of ids) await coord.json(`/api/leads/${id}`, "DELETE");
  console.log(`\nResultado: ${pass} correctas, ${fail} fallidas.`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
