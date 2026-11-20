// Pruebas de las reglas: Coordinación no asigna asesor + estados Seguimiento / No respondió como históricos.
//   node scripts/verify-reglas.mjs      (servidor LOCAL de prueba en http://localhost:3001)
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
  async text(path) {
    const r = await this.raw(path);
    const html = await r.text();
    return { status: r.status, text: html.replace(/<!--.*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ") };
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
const tag = Date.now().toString().slice(-4);
const created = [];

async function main() {
  const coord = await as("coord");
  const blvd = await as("gerente.blvd_zacatecas");
  const ASES = "Raul Esparza Gonzalez";

  console.log("\n== Coordinación no asigna asesor ==");
  const sinAs = await coord.json("/api/leads", "POST", { nombre: `Regla ${tag}`, telefono: `492 600 ${tag}`, fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS" });
  const L = sinAs.body?.lead; if (L) created.push(L.id);
  check("alta sin asesor → 201 y queda sin asesor", sinAs.status === 201 && L?.asesor === null);
  const conAs = await coord.json("/api/leads", "POST", { nombre: `Regla2 ${tag}`, telefono: `492 601 ${tag}`, fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS", asesor: ASES });
  if (conAs.body?.lead) created.push(conAs.body.lead.id);
  check("alta CON asesor → 400 (lo asigna el gerente)", conAs.status === 400 && /gerente/i.test(JSON.stringify(conAs.body)), JSON.stringify(conAs.body).slice(0, 100));
  const pa = await coord.json(`/api/leads/${L.id}`, "PATCH", { asesor: ASES });
  check("editar: Coordinación no puede poner un asesor → 403", pa.status === 403, String(pa.status));
  check("el lead sigue sin asesor", (await coord.json(`/api/leads/${L.id}`)).body.lead.asesor === null);
  check("editar otros campos y mandar asesor vacío → 200", (await coord.json(`/api/leads/${L.id}`, "PATCH", { notas: "ok", asesor: null })).status === 200);
  const ga = await blvd.json(`/api/leads/${L.id}`, "PATCH", { asesor: ASES });
  check("el gerente SÍ asigna el asesor → 200", ga.status === 200 && ga.body.lead.asesor === ASES);
  check("Coordinación puede editar el lead mandando el mismo asesor → 200", (await coord.json(`/api/leads/${L.id}`, "PATCH", { asesor: ASES, notas: "mismo asesor" })).status === 200);
  check("pero no cambiarlo por otro → 403", (await coord.json(`/api/leads/${L.id}`, "PATCH", { asesor: "Lucio" })).status === 403);
  check("ni quitarlo → 403", (await coord.json(`/api/leads/${L.id}`, "PATCH", { asesor: null })).status === 403);
  check("el asesor del gerente se conserva", (await coord.json(`/api/leads/${L.id}`)).body.lead.asesor === ASES);

  console.log("\n== Pantallas de Coordinación ==");
  const nuevo = await coord.text("/leads/new");
  check("Nuevo lead ya no ofrece elegir asesor", nuevo.status === 200 && !nuevo.text.includes("Asesor (opcional)") && !nuevo.text.includes("asesor, notas, fecha"));
  const ficha = await coord.text(`/leads/${L.id}`);
  check("la ficha muestra el asesor solo como dato (lo asigna el gerente)", ficha.text.includes("Lo asigna el gerente de la sucursal") && ficha.text.includes(ASES));
  const fichaG = await blvd.text(`/leads/${L.id}`);
  check("la ficha del gerente conserva el selector de asesor", fichaG.text.includes("Asesor asignado") && !fichaG.text.includes("Lo asigna el gerente de la sucursal"));

  console.log("\n== Estados históricos (Seguimiento / No respondió) ==");
  check("alta con estado Seguimiento → 400", (await coord.json("/api/leads", "POST", { nombre: "H1", telefono: `492 602 ${tag}`, fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS", estado: "SEGUIMIENTO" })).status === 400);
  check("alta con estado No respondió → 400", (await coord.json("/api/leads", "POST", { nombre: "H2", telefono: `492 603 ${tag}`, fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS", estado: "NO_RESPONDIO" })).status === 400);
  check("Coordinación no puede mover un lead a Seguimiento → 400", (await coord.json(`/api/leads/${L.id}`, "PATCH", { estado: "SEGUIMIENTO" })).status === 400);
  check("el gerente tampoco puede mover a No respondió → 400", (await blvd.json(`/api/leads/${L.id}`, "PATCH", { estado: "NO_RESPONDIO" })).status === 400);
  check("los 5 estados activos siguen funcionando (Contactado)", (await blvd.json(`/api/leads/${L.id}`, "PATCH", { estado: "CONTACTADO" })).status === 200);

  const todos = (await coord.json("/api/leads?desde=2000-01-01&hasta=2100-01-01")).body.leads;
  const hist = todos.filter((l) => l.estado === "SEGUIMIENTO" || l.estado === "NO_RESPONDIO");
  check("hay leads históricos en los datos de prueba", hist.length > 0, String(todos.length));
  if (hist.length) {
    const h = hist[0];
    const gh = h.sucursal === "BLVD_ZACATECAS" ? blvd : coord;
    check("un lead en estado histórico se puede editar sin cambiar su estado (estado reenviado) → 200", (await gh.json(`/api/leads/${h.id}`, "PATCH", { estado: h.estado, notas: `nota ${tag}` })).status === 200);
    check("y conserva su estado histórico", (await coord.json(`/api/leads/${h.id}`)).body.lead.estado === h.estado);
    const fh = await coord.text(`/leads/${h.id}`);
    check("la ficha lo muestra marcado como (histórico)", fh.text.includes("(histórico)"));
  }
  const noResp = todos.find((l) => l.estado === "NO_RESPONDIO");
  const segui = todos.find((l) => l.estado === "SEGUIMIENTO");
  const fContact = (await coord.json("/api/leads?estado=CONTACTADO&desde=2000-01-01&hasta=2100-01-01")).body.leads;
  const fCotiz = (await coord.json("/api/leads?estado=COTIZACION&desde=2000-01-01&hasta=2100-01-01")).body.leads;
  if (noResp) check("filtrar por Contactado incluye a «No respondió» (histórico)", fContact.some((l) => l.id === noResp.id));
  if (segui) check("filtrar por Cotización incluye a «Seguimiento» (histórico)", fCotiz.some((l) => l.id === segui.id));
  check("filtrar por Contactado no mezcla otros estados", fContact.every((l) => l.estado === "CONTACTADO" || l.estado === "NO_RESPONDIO"));

  for (const id of created) await coord.json(`/api/leads/${id}`, "DELETE");
  console.log(`\nResultado: ${pass} bien, ${fail} mal`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
