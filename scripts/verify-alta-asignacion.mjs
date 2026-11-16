// Pruebas de alta rápida y asignación de asesor (CRM 1.0) contra un servidor LOCAL de prueba.
//   node scripts/verify-alta-asignacion.mjs      (servidor en http://localhost:3001)
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
const denied = (st) => st === 401 || st === 307;
const tag = Date.now().toString().slice(-6);
const tel = (n) => `492 ${String(n).padStart(3, "0")} ${tag.slice(-4)}`;
const created = [];

async function main() {
  const coord = await as("coord");
  const blvd = await as("gerente.blvd_zacatecas");
  const colon = await as("gerente.colon");

  console.log("\n== Alta rápida (Coordinación) ==");
  const min = await coord.json("/api/leads", "POST", { nombre: `Prueba Alta ${tag}`, telefono: tel(111), fuente: "WHATSAPP", sucursal: "BLVD_ZACATECAS" });
  const L = min.body?.lead;
  if (L) created.push(L.id);
  check("solo con nombre, teléfono, canal y sucursal → 201", min.status === 201 && !!L, JSON.stringify(min.body).slice(0, 100));
  check("entra como Nuevo, sin asesor", L?.estado === "NUEVO" && L?.asesor === null);
  check("responsable = gerente de la sucursal", typeof L?.responsable === "string" && L.responsable.length > 0);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  check("la fecha es hoy (hora de México)", L?.fecha?.slice(0, 10) === hoy, `${L?.fecha} vs ${hoy}`);

  const corto = await coord.json("/api/leads", "POST", { nombre: "Corto", telefono: "12345", fuente: "WHATSAPP", sucursal: "BLVD_ZACATECAS" });
  check("teléfono con menos de 10 dígitos → 400", corto.status === 400);
  const sinCanal = await coord.json("/api/leads", "POST", { nombre: "Sin canal", telefono: tel(112), sucursal: "BLVD_ZACATECAS" });
  check("sin canal → 400", sinCanal.status === 400);
  const refer = await coord.json("/api/leads", "POST", { nombre: "Ref", telefono: tel(113), fuente: "REFERIDO", sucursal: "BLVD_ZACATECAS" });
  check("el canal histórico Referido ya no se acepta en altas → 400", refer.status === 400);
  const conAs = await coord.json("/api/leads", "POST", { nombre: `Con asesor ${tag}`, telefono: tel(114), fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS", asesor: "Raul Esparza Gonzalez" });
  if (conAs.body?.lead) created.push(conAs.body.lead.id);
  check("alta con asesor elegido → 201 y queda asignado", conAs.status === 201 && conAs.body.lead.asesor === "Raul Esparza Gonzalez");
  const asMal = await coord.json("/api/leads", "POST", { nombre: "Asesor malo", telefono: tel(115), fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS", asesor: "Lucio" });
  check("asesor de otra sucursal → 400", asMal.status === 400);
  check("el gerente NO puede crear leads", (await blvd.json("/api/leads", "POST", { nombre: "X", telefono: tel(116), fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS" })).status === 403);
  check("sin sesión no se puede crear", denied((await new Client().json("/api/leads", "POST", { nombre: "X", telefono: tel(117), fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS" })).status));

  console.log("\n== Aviso de teléfono repetido ==");
  check("sin sesión se niega", denied((await new Client().json(`/api/leads/duplicados?telefono=${encodeURIComponent(tel(111))}`)).status));
  const dup = await coord.json(`/api/leads/duplicados?telefono=${encodeURIComponent(tel(111))}`);
  check("encuentra el lead recién creado", dup.status === 200 && dup.body.duplicados.some((d) => d.id === L.id));
  const dupFmt = await coord.json(`/api/leads/duplicados?telefono=${encodeURIComponent("+52 (492) 111-" + tag.slice(-4))}`);
  check("reconoce el mismo número escrito con otro formato", dupFmt.body.duplicados.some((d) => d.id === L.id));
  check("con menos de 10 dígitos no busca", (await coord.json("/api/leads/duplicados?telefono=492111")).body.duplicados.length === 0);
  check("excluir=id omite ese lead", !(await coord.json(`/api/leads/duplicados?telefono=${encodeURIComponent(tel(111))}&excluir=${L.id}`)).body.duplicados.some((d) => d.id === L.id));
  check("el gerente de la misma sucursal lo ve", (await blvd.json(`/api/leads/duplicados?telefono=${encodeURIComponent(tel(111))}`)).body.duplicados.some((d) => d.id === L.id));
  check("el gerente de OTRA sucursal no lo ve", !(await colon.json(`/api/leads/duplicados?telefono=${encodeURIComponent(tel(111))}`)).body.duplicados.some((d) => d.id === L.id));

  console.log("\n== Por asignar (leads sin asesor) ==");
  const sin = await blvd.json("/api/leads?sinAsesor=1");
  check("el gerente recibe solo leads sin asesor", sin.status === 200 && sin.body.leads.length > 0 && sin.body.leads.every((l) => !l.asesor));
  check("solo de su sucursal", sin.body.leads.every((l) => l.sucursal === "BLVD_ZACATECAS"));
  check("sin ventas ni perdidos", sin.body.leads.every((l) => l.estado !== "VENTA" && l.estado !== "PERDIDO"));
  check("incluye el lead recién creado (sin importar el periodo)", sin.body.leads.some((l) => l.id === L.id));
  check("no incluye el que sí tiene asesor", !sin.body.leads.some((l) => l.id === conAs.body.lead.id));
  const sinCoord = await coord.json("/api/leads?sinAsesor=1");
  check("Coordinación ve los sin asesor de todas las sucursales", new Set(sinCoord.body.leads.map((l) => l.sucursal)).size >= 2);
  const sinMes = await blvd.json("/api/leads?sinAsesor=1&desde=2000-01-01&hasta=2000-01-02");
  check("el periodo sigue funcionando si se envía", sinMes.status === 200 && !sinMes.body.leads.some((l) => l.id === L.id));

  console.log("\n== Asignar asesor (gerente) ==");
  const as1 = await blvd.json(`/api/leads/${L.id}`, "PATCH", { asesor: "Raul Esparza Gonzalez" });
  check("el gerente asigna solo el asesor → 200", as1.status === 200 && as1.body.lead.asesor === "Raul Esparza Gonzalez");
  check("asignar NO cambia el estado (sigue Nuevo)", as1.body.lead.estado === "NUEVO");
  check("ya no aparece en Por asignar", !(await blvd.json("/api/leads?sinAsesor=1")).body.leads.some((l) => l.id === L.id));
  const as2 = await blvd.json(`/api/leads/${L.id}`, "PATCH", { asesor: "Lucio" });
  check("asesor de otra sucursal → 400", as2.status === 400);
  const as3 = await blvd.json(`/api/leads/${L.id}`, "PATCH", { asesor: "Karen Arely Ortega Hernandez", estado: "CONTACTADO" });
  check("asignar + marcar Contactado en una sola llamada → 200", as3.status === 200 && as3.body.lead.estado === "CONTACTADO" && as3.body.lead.asesor === "Karen Arely Ortega Hernandez");
  check("el gerente de otra sucursal NO puede asignar → 403", (await colon.json(`/api/leads/${L.id}`, "PATCH", { asesor: "Raul Esparza Gonzalez" })).status === 403);
  const colonLead = (await coord.json("/api/leads?sinAsesor=1&sucursal=COLON")).body.leads[0];
  if (colonLead) check("Colón (sin asesores registrados) no admite asignar un nombre inventado → 400", (await colon.json(`/api/leads/${colonLead.id}`, "PATCH", { asesor: "Inventado" })).status === 400);
  check("el gerente no puede tocar otros campos (nombre) → 400", (await blvd.json(`/api/leads/${L.id}`, "PATCH", { nombre: "Hackeado" })).status === 400);
  check("quitar asesor (null) sigue permitido", (await blvd.json(`/api/leads/${L.id}`, "PATCH", { asesor: null })).body.lead.asesor === null);

  console.log("\n== Campana del gerente ==");
  const av = (await blvd.json("/api/avisos")).body;
  check("cada aviso incluye el campo asesor", av.items.length > 0 && av.items.every((i) => "asesor" in i));

  // limpieza de los leads de prueba creados aquí
  for (const id of created) await coord.json(`/api/leads/${id}`, "DELETE");
  console.log(`\nResultado: ${pass} bien, ${fail} mal`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
