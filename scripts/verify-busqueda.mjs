// Pruebas de filtro por periodo y búsqueda de leads contra un servidor LOCAL de prueba.
//   node scripts/verify-busqueda.mjs      (servidor en http://localhost:3001)
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

// Fechas en calendario de México (UTC-6), igual que el CRM.
const mexNow = new Date(Date.now() - 6 * 3_600_000);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const HOY = iso(mexNow), AYER = addDays(HOY, -1), HACE8 = addDays(HOY, -8);
const lunes = addDays(HOY, -((new Date(HOY + "T00:00:00Z").getUTCDay() + 6) % 7));
const inicioMes = HOY.slice(0, 8) + "01";
const TAG = "ZZTAG" + Math.floor(Math.random() * 1e6);

async function main() {
  const coord = await as("coord");
  const colon = await as("gerente.colon");
  const blvd = await as("gerente.blvd_zacatecas");
  const mk = (extra) => coord.json("/api/leads", "POST", { nombre: "Lead Prueba", telefono: "4929990000", sucursal: "COLON", interes: TAG, fuente: "FACEBOOK", fecha: HOY, ...extra });
  const ids = [];
  const mkId = async (extra) => { const r = await mk(extra); if (r.status !== 201) throw new Error("no se pudo crear " + JSON.stringify(r.body)); ids.push(r.body.lead.id); return r.body.lead.id; };
  const A = await mkId({ nombre: "José Ángel Peña Ñandú", telefono: "492 123 4567", fecha: HOY, interes: "Piso laminado " + TAG });
  const B = await mkId({ nombre: "Beatriz Luna Prueba", telefono: "492 555 0002", fecha: AYER });
  const C = await mkId({ nombre: "Carlos Hace Ocho", telefono: "492 555 0003", fecha: HACE8 });
  const D = await mkId({ nombre: "Diana Con Folio", telefono: "492 555 0004", fecha: HOY, sucursal: "BLVD_ZACATECAS", asesor: "Genaro Samuel Alvarado Melesio", estado: "VENTA", folioFactura: "FAC-TEST-9001", montoVenta: 1500 });
  const q = async (c, qs) => (await c.json("/api/leads?" + qs)).body;
  const idsOf = (b) => (b.leads ?? []).map((l) => l.id);
  const mine = (b) => idsOf(b).filter((id) => ids.includes(id));
  const range = (d, h) => `desde=${d}&hasta=${h}`;

  console.log("\n== Periodos de fecha ==");
  check("Hoy: solo los de hoy (A y D; no B de ayer ni C de hace 8 días)", JSON.stringify(mine(await q(coord, range(HOY, HOY) + `&q=${TAG}&qEnPeriodo=1`)).sort()) === JSON.stringify([A, D].sort()));
  const hoyAll = await q(coord, range(HOY, HOY));
  check("Hoy: trae A y D y no B ni C", idsOf(hoyAll).includes(A) && idsOf(hoyAll).includes(D) && !idsOf(hoyAll).includes(B) && !idsOf(hoyAll).includes(C));
  check("Hoy: todos los resultados tienen fecha de hoy", hoyAll.leads.every((l) => l.fecha.slice(0, 10) === HOY));
  const ayer = await q(coord, range(AYER, AYER));
  check("Ayer: solo B", idsOf(ayer).includes(B) && !idsOf(ayer).includes(A) && !idsOf(ayer).includes(C) && ayer.leads.every((l) => l.fecha.slice(0, 10) === AYER));
  const semana = await q(coord, range(lunes, HOY));
  check("Esta semana (lunes → hoy): incluye A y excluye C (hace 8 días)", idsOf(semana).includes(A) && !idsOf(semana).includes(C));
  check("Esta semana incluye B si ayer cae en la misma semana", idsOf(semana).includes(B) === (AYER >= lunes));
  const mes = await q(coord, range(inicioMes, HOY));
  check("Este mes (día 1 → hoy): A dentro; C solo si hace 8 días sigue en el mes", idsOf(mes).includes(A) && idsOf(mes).includes(C) === (HACE8 >= inicioMes));
  const pers = await q(coord, range(HACE8, AYER));
  check("Personalizado (hace 8 días → ayer): incluye B y C, excluye A (hoy)", idsOf(pers).includes(B) && idsOf(pers).includes(C) && !idsOf(pers).includes(A));
  const borde = await q(coord, range(HACE8, HACE8));
  check("Los extremos del rango se incluyen (un solo día)", idsOf(borde).includes(C) && borde.leads.every((l) => l.fecha.slice(0, 10) === HACE8));
  const orden = await q(coord, range(HACE8, HOY) + "&orden=asc");
  check("Orden ascendente: de la fecha más antigua a la más reciente", orden.leads.every((l, i, a) => i === 0 || a[i - 1].fecha <= l.fecha));
  check("Sin rango (Todo el tiempo) devuelve más que un solo día", (await q(coord, "")).count > hoyAll.count);
  check("Compatibilidad: ?mes=AAAA-MM sigue funcionando", (await q(coord, `mes=${HOY.slice(0, 7)}`)).count > 0);
  check("solo 'desde' sin 'hasta' → 400", (await coord.json(`/api/leads?desde=${HOY}`)).status === 400);
  check("fecha con formato inválido → 400", (await coord.json("/api/leads?desde=ayer&hasta=hoy")).status === 400);

  console.log("\n== Periodos por rol ==");
  const gHoy = await q(colon, range(HOY, HOY));
  check("el gerente de Colón filtra por periodo y solo ve su sucursal", idsOf(gHoy).includes(A) && gHoy.leads.every((l) => l.sucursal === "COLON"));
  check("el gerente NO ve el lead de Blvd. Zacatecas (D) aunque sea de hoy", !idsOf(gHoy).includes(D));
  const gForz = await q(colon, range(HOY, HOY) + "&sucursal=BLVD_ZACATECAS");
  check("el gerente no puede ver otra sucursal forzando ?sucursal=", gForz.leads.every((l) => l.sucursal === "COLON") && !idsOf(gForz).includes(D));
  const bHoy = await q(blvd, range(HOY, HOY));
  check("el gerente de Blvd. Zacatecas ve D de hoy y no A", idsOf(bHoy).includes(D) && !idsOf(bHoy).includes(A));
  check("Coordinación filtra por periodo y sucursal a la vez", (await q(coord, range(HOY, HOY) + "&sucursal=BLVD_ZACATECAS")).leads.every((l) => l.sucursal === "BLVD_ZACATECAS"));

  console.log("\n== Reportes con periodo ==");
  const rHoy = await coord.json(`/api/reports?from=${HOY}&to=${HOY}`);
  check("Reportes: Hoy responde con métricas", rHoy.status === 200 && typeof rHoy.body.metrics.totalLeads === "number" && rHoy.body.metrics.totalLeads >= 2);
  const rAyer = await coord.json(`/api/reports?from=${AYER}&to=${AYER}`);
  check("Reportes: Ayer responde y cuenta el lead de ayer (B)", rAyer.status === 200 && rAyer.body.metrics.totalLeads >= 1);
  const rColon = await colon.json(`/api/reports?from=${HOY}&to=${HOY}`);
  check("Reportes del gerente: solo su sucursal (menos que Coordinación)", rColon.status === 200 && rColon.body.metrics.totalLeads < rHoy.body.metrics.totalLeads && rColon.body.porSucursal.every((s) => s.sucursal === "COLON"));
  check("Reportes: Todo el tiempo (sin fechas) funciona", (await coord.json("/api/reports")).status === 200);

  console.log("\n== Búsqueda ==");
  check("sin acentos ni mayúsculas: 'jose angel pena nandu'", idsOf(await q(coord, "q=" + encodeURIComponent("jose angel pena nandu"))).includes(A));
  check("con acentos: 'PEÑA ÑANDÚ'", idsOf(await q(coord, "q=" + encodeURIComponent("PEÑA ÑANDÚ"))).includes(A));
  check("varias palabras en otro orden: 'nandu jose'", idsOf(await q(coord, "q=" + encodeURIComponent("nandu jose"))).includes(A));
  check("todas las palabras deben aparecer: 'jose zzzzzz' no encuentra", !idsOf(await q(coord, "q=" + encodeURIComponent("jose zzzzzz"))).includes(A));
  for (const t of ["4921234567", "492 123 4567", "492-123-4567", "(492) 123", "123 4567", "1234567"]) {
    check(`teléfono escrito como '${t}'`, idsOf(await q(coord, "q=" + encodeURIComponent(t))).includes(A));
  }
  check("por interés: 'laminado' + etiqueta", idsOf(await q(coord, "q=" + encodeURIComponent("laminado " + TAG))).includes(A));
  check("por asesor: 'genaro alvarado'", idsOf(await q(coord, "q=" + encodeURIComponent("genaro alvarado"))).includes(D));
  check("por folio de factura: 'FAC-TEST-9001'", idsOf(await q(coord, "q=FAC-TEST-9001")).includes(D));
  check("por número de folio: '9001'", idsOf(await q(coord, "q=9001")).includes(D));

  console.log("\n== Búsqueda y periodo ==");
  const sinP = await q(coord, `q=${TAG}&` + range(HOY, HOY));
  check("por defecto la búsqueda ignora el periodo (encuentra A, B y C aunque el periodo sea Hoy)", [A, B, C].every((id) => idsOf(sinP).includes(id)), JSON.stringify(mine(sinP)));
  const conP = await q(coord, `q=${TAG}&qEnPeriodo=1&` + range(HOY, HOY));
  check("con 'solo dentro del periodo' se limita a lo de hoy", idsOf(conP).includes(A) && !idsOf(conP).includes(C) && !idsOf(conP).includes(B));
  check("la búsqueda más el periodo respetan el orden", (await q(coord, `q=${TAG}&orden=asc`)).leads.every((l, i, a) => i === 0 || a[i - 1].fecha <= l.fecha));

  console.log("\n== Búsqueda por rol ==");
  check("el gerente de Colón busca y encuentra lo suyo", idsOf(await q(colon, "q=" + encodeURIComponent("jose angel"))).includes(A));
  check("el gerente de Colón NO encuentra leads de otra sucursal (D de Blvd.)", !idsOf(await q(colon, "q=FAC-TEST-9001")).includes(D) && !idsOf(await q(colon, "q=" + encodeURIComponent("genaro alvarado"))).includes(D));
  check("el gerente de Blvd. sí encuentra D por asesor", idsOf(await q(blvd, "q=" + encodeURIComponent("genaro alvarado"))).includes(D));
  check("sin sesión se niega", [401, 307].includes((await new Client().json("/api/leads?q=a")).status));
  check("búsqueda sin resultados → lista vacía, no error", (await coord.json("/api/leads?q=" + encodeURIComponent("xqzwv no existe"))).body.count === 0);

  for (const id of ids) await coord.json(`/api/leads/${id}`, "DELETE");
  console.log(`\nResultado: ${pass} correctas, ${fail} fallidas.`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
