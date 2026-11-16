// Pruebas de los Reportes (comparativo, tendencia, embudo de 5 estados, 5 canales, asesores y ticket promedio)
// contra un servidor LOCAL de prueba.   node scripts/verify-reportes.mjs   (http://localhost:3001)
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("Solo se permite contra un servidor local de prueba");
const PW = "ChangeMe123!";
const KEY = process.env.INTAKE_API_KEY ?? "clave-de-prueba-local-0123456789abcdef";

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
  async json(path, method = "GET", body, headers = {}) {
    const res = await this.raw(path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, body: data };
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

const mexNow = new Date(Date.now() - 6 * 3_600_000);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const HOY = iso(mexNow);
const D = (n) => addDays(HOY, n);
const TAG = "REP" + Math.floor(Math.random() * 1e6);
// Los 5 canales con los que se carga un lead (en este orden de catálogo) y los 5 estados del CRM
const CANALES = ["FACEBOOK", "WHATSAPP", "INSTAGRAM", "TIKTOK", "SITIO_WEB"];
const ESTADOS = ["NUEVO", "CONTACTADO", "COTIZACION", "VENTA", "PERDIDO"];

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

  // Datos de prueba conocidos (Colón, salvo uno de Blvd.)
  await mk({ fecha: D(-1), fuente: "TIKTOK" }); // Nuevo
  await mk({ fecha: D(-2), fuente: "TIKTOK", estado: "SEGUIMIENTO", proximoSeguimiento: D(3) }); // Seguimiento → cuenta como Cotización
  await mk({ fecha: D(-3), fuente: "SITIO_WEB", estado: "COTIZACION" });
  await mk({ fecha: D(-4), fuente: "WHATSAPP", estado: "VENTA", montoVenta: 1000, fechaCierre: D(-2) });
  await mk({ fecha: D(-5), fuente: "INSTAGRAM", estado: "VENTA", montoVenta: 3000, fechaCierre: D(-1) });
  await mk({ fecha: D(-3), fuente: "FACEBOOK", estado: "PERDIDO", fechaCierre: D(-1) });
  await mk({ fecha: D(-10), fuente: "INSTAGRAM" }); // periodo anterior
  await mk({ fecha: D(-1), estado: "NO_RESPONDIO", proximoSeguimiento: D(2) }); // No respondió → cuenta como Contactado
  await mk({ fecha: D(-1), sucursal: "BLVD_ZACATECAS", asesor: "Genaro Samuel Alvarado Melesio", estado: "VENTA", montoVenta: 500, fechaCierre: D(0) });

  const despues = await rep(colon);
  const mC = despues.metrics, mA = antes.metrics;

  console.log("\n== Comparativo con el periodo anterior ==");
  check("trae el periodo anterior de la misma duración (7 días justo antes)", despues.comparativo && despues.comparativo.desde === D(-13) && despues.comparativo.hasta === D(-7));
  check("el periodo actual suma los 7 leads de prueba de Colón", mC.totalLeads - mA.totalLeads === 7);
  check("el periodo anterior suma 1 lead de prueba (el de hace 10 días)", despues.comparativo.metrics.totalLeads - antes.comparativo.metrics.totalLeads === 1);
  check("ventas y total vendido del periodo (2 ventas: $1,000 + $3,000)", mC.ventas - mA.ventas === 2 && mC.totalVendido - mA.totalVendido === 4000);
  check("ticket promedio = total vendido ÷ ventas", mC.ticketPromedio === Math.round((mC.totalVendido / mC.ventas) * 100) / 100);
  check("'todo el tiempo' no compara", (await coord.json("/api/reports")).body.comparativo === null);
  check("'Cotizaciones' cuenta Cotización + Seguimiento (+2)", mC.cotizaciones - mA.cotizaciones === 2);

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

  console.log("\n== Canales de llegada (los mismos con los que se carga un lead) ==");
  const vacio = await rep(coord, "from=2020-01-01&to=2020-01-02");
  check("sin leads en el periodo salen EXACTAMENTE los 5 canales, en cero, en este orden: Facebook, WhatsApp, Instagram, TikTok, Tienda en línea", JSON.stringify(vacio.porCanal.map((c) => c.fuente)) === JSON.stringify(CANALES) && vacio.porCanal.every((c) => c.total === 0 && c.porcentaje === 0));
  check("con datos, los 5 canales siempre están", CANALES.every((c) => despues.porCanal.some((x) => x.fuente === c)));
  const extra = todo.porCanal.filter((c) => !CANALES.includes(c.fuente));
  check("cualquier otro canal es histórico (Referido/Otro) y solo sale si tiene leads", extra.every((c) => ["REFERIDO", "OTRO"].includes(c.fuente) && c.total + c.ventas > 0));
  check("el total por canal cuadra con los leads del periodo (incluye históricos)", todo.porCanal.reduce((n, c) => n + c.total, 0) === todo.metrics.totalLeads && despues.porCanal.reduce((n, c) => n + c.total, 0) === mC.totalLeads);
  const can = (r, c) => r.porCanal.find((x) => x.fuente === c);
  check("TikTok +2, Tienda en línea +1, WhatsApp +1 con su venta de $1,000", can(despues, "TIKTOK").total - can(antes, "TIKTOK").total === 2 && can(despues, "SITIO_WEB").total - can(antes, "SITIO_WEB").total === 1 && can(despues, "WHATSAPP").ventas - can(antes, "WHATSAPP").ventas === 1 && can(despues, "WHATSAPP").monto - can(antes, "WHATSAPP").monto === 1000);
  check("Instagram: +1 lead del periodo y su venta de $3,000", can(despues, "INSTAGRAM").total - can(antes, "INSTAGRAM").total === 1 && can(despues, "INSTAGRAM").monto - can(antes, "INSTAGRAM").monto === 3000);
  check("ordenados por volumen", despues.porCanal.every((c, i, a) => i === 0 || a[i - 1].total >= c.total));

  console.log("\n== Los canales al cargar un lead son los mismos ==");
  for (const f of ["REFERIDO", "OTRO", "GOOGLE_ADS", "SITIO WEB"]) {
    check(`cargar un lead con canal '${f}' → 400`, (await coord.json("/api/leads", "POST", { nombre: "Canal Invalido", telefono: "4920003333", sucursal: "COLON", interes: TAG, fuente: f, fecha: D(0) })).status === 400);
  }
  for (const f of CANALES) {
    const r = await coord.json("/api/leads", "POST", { nombre: "Canal Valido", telefono: "4920004444", sucursal: "COLON", interes: TAG, fuente: f, fecha: D(0) });
    check(`cargar un lead con canal ${f} → 201`, r.status === 201);
    if (r.status === 201) ids.push(r.body.lead.id);
  }
  const fi = ids[ids.length - 1];
  check("editar el canal a otro de los 5 → 200", (await coord.json(`/api/leads/${fi}`, "PATCH", { fuente: "WHATSAPP" })).status === 200);
  check("la captura automática acepta 'tienda en línea'", (await (async () => { const r = await new Client().json("/api/intake/leads", "POST", { nombre: "Auto Tienda", telefono: "492 555 " + String(1000 + Math.floor(Math.random() * 8999)), sucursal: "COLON", fuente: "tienda en línea" }, { "x-api-key": KEY }); if (r.body?.id) ids.push(r.body.id); return r; })()).status === 201);
  check("la captura automática rechaza 'referido' y 'otro' → 400", (await new Client().json("/api/intake/leads", "POST", { nombre: "Auto Ref", telefono: "492 555 1111", sucursal: "COLON", fuente: "referido" }, { "x-api-key": KEY })).status === 400 && (await new Client().json("/api/intake/leads", "POST", { nombre: "Auto Otro", telefono: "492 555 2222", sucursal: "COLON", fuente: "otro" }, { "x-api-key": KEY })).status === 400);

  console.log("\n== Embudo (los 5 estados del CRM) ==");
  check("el embudo trae los 5 estados, en su orden: Nuevo, Contactado, Cotización, Venta, Perdido", JSON.stringify(despues.embudo.map((e) => e.key)) === JSON.stringify(ESTADOS) && JSON.stringify(despues.embudo.map((e) => e.label)) === JSON.stringify(["Nuevo", "Contactado", "Cotización", "Venta", "Perdido"]), JSON.stringify(despues.embudo.map((e) => e.label)));
  const est = (r, e) => r.embudo.find((x) => x.key === e).total;
  check("Seguimiento se cuenta dentro de Cotización (+2 = Cotización + Seguimiento)", est(despues, "COTIZACION") - est(antes, "COTIZACION") === 2);
  check("No respondió se cuenta dentro de Contactado (+1)", est(despues, "CONTACTADO") - est(antes, "CONTACTADO") === 1);
  check("Nuevo +1, Venta +2, Perdido +1", est(despues, "NUEVO") - est(antes, "NUEVO") === 1 && est(despues, "VENTA") - est(antes, "VENTA") === 2 && est(despues, "PERDIDO") - est(antes, "PERDIDO") === 1);
  check("el embudo suma los leads del periodo (ninguno se pierde)", despues.embudo.reduce((n, e) => n + e.total, 0) === mC.totalLeads);
  check("sin leads siguen los 5 estados (en cero)", vacio.embudo.length === 5 && vacio.embudo.every((e) => e.total === 0));
  check("cada estado trae su color para la barra", despues.embudo.every((e) => /^bg-/.test(e.dot)));

  console.log("\n== Desempeño por asesor ==");
  const rc = await rep(coord);
  const gen = (rows) => rows.find((a) => a.asesor.startsWith("Genaro") && a.sucursal === "BLVD_ZACATECAS");
  check("Coordinación ve la venta de $500 de Genaro (Blvd. Zacatecas)", gen(rc.porAsesor).ventas - (gen(antesAsesor)?.ventas ?? 0) === 1 && gen(rc.porAsesor).monto - (gen(antesAsesor)?.monto ?? 0) === 500);
  check("por asesor suma los leads y trae 'Sin asignar'", rc.porAsesor.reduce((n, a) => n + a.leads, 0) === rc.metrics.totalLeads && rc.porAsesor.some((a) => a.asesor === "Sin asignar"));
  check("viene ordenado por monto vendido", rc.porAsesor.every((a, i, x) => i === 0 || x[i - 1].monto >= a.monto));
  check("trae leads, ventas, monto y conversión", rc.porAsesor.every((a) => ["leads", "ventas", "monto", "conversion"].every((k) => typeof a[k] === "number")));

  console.log("\n== Alcance por rol ==");
  check("el gerente de Colón: sin comparativo de sucursales y solo su sucursal por asesor", despues.porSucursal.length === 0 && despues.porAsesor.every((a) => a.sucursal === "COLON"));
  check("el gerente de Colón NO ve la venta de Blvd. (Genaro)", !despues.porAsesor.some((a) => a.asesor.startsWith("Genaro")));
  const rb = await rep(blvd);
  check("el gerente de Blvd. Zacatecas sí ve a Genaro y no a asesores de otras sucursales", rb.porAsesor.some((a) => a.asesor.startsWith("Genaro")) && rb.porAsesor.every((a) => a.sucursal === "BLVD_ZACATECAS"));
  check("el gerente también ve los 5 canales y los 5 estados", rb.porCanal.length >= 5 && rb.embudo.length === 5);
  check("Coordinación ve el comparativo por sucursal", rc.porSucursal.length >= 2);
  check("sin sesión se niega", denied((await new Client().json(`/api/reports?${ACT}`)).status));

  console.log("\n== Sin exportar ni imprimir ==");
  check("ya no existe la exportación de reportes (404)", (await coord.raw("/api/reports/export")).status === 404);
  const html = await (await coord.raw("/reports")).text();
  check("la página de reportes abre y no ofrece 'Exportar' ni 'Imprimir'", html.length > 1000 && !/Exportar a Excel|Imprimir \/ PDF/.test(html));

  for (const id of ids) await coord.json(`/api/leads/${id}`, "DELETE");
  console.log(`\nResultado: ${pass} correctas, ${fail} fallidas.`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
