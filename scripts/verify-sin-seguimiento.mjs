// Pruebas del filtro de estado "Sin seguimiento" (leads Nuevos sin atender a tiempo).
//   node scripts/verify-sin-seguimiento.mjs      (servidor LOCAL de prueba en http://localhost:3001)
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
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function main() {
  const coord = await as("coord");
  const blvd = await as("gerente.blvd_zacatecas");
  const colon = await as("gerente.colon");
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const mesIni = hoy.slice(0, 8) + "01";
  const tag = Date.now().toString().slice(-4);
  const ids = [];
  const mk = async (extra) => { const r = await coord.json("/api/leads", "POST", { nombre: `SinSeg ${extra.n} ${tag}`, telefono: `492 77${extra.n} ${tag}`, fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS", ...extra.body }); if (r.status !== 201) throw new Error("no se pudo crear " + JSON.stringify(r.body)); ids.push(r.body.lead.id); return r.body.lead.id; };

  console.log("\n== Filtro Sin seguimiento ==");
  const A = await mk({ n: 1, body: { proximoSeguimiento: addDays(hoy, -2) } }); // Nuevo con seguimiento vencido
  const B = await mk({ n: 2, body: { proximoSeguimiento: addDays(hoy, 3) } }); // Nuevo con seguimiento a futuro
  const C = await mk({ n: 3, body: {} }); // Nuevo recién creado, sin fecha (menos de 24 h)
  const D = await mk({ n: 4, body: { estado: "CONTACTADO", proximoSeguimiento: addDays(hoy, -2) } }); // ya contactado
  const q = (c, extra = "") => c.json(`/api/leads?estado=SIN_SEGUIMIENTO&desde=${mesIni}&hasta=${hoy}${extra}`);
  const rc = await q(coord);
  check("responde 200", rc.status === 200);
  const idsC = rc.body.leads.map((l) => l.id);
  check("incluye al Nuevo con seguimiento vencido", idsC.includes(A));
  check("no incluye al Nuevo con seguimiento a futuro", !idsC.includes(B));
  check("no incluye al Nuevo recién creado (menos de 24 h)", !idsC.includes(C));
  check("no incluye a un lead que ya no es Nuevo aunque tenga seguimiento vencido", !idsC.includes(D));
  check("todos los resultados están en estado Nuevo", rc.body.leads.every((l) => l.estado === "NUEVO"));

  console.log("\n== Coincide con la campana y respeta el alcance de cada gerente ==");
  const avB = (await blvd.json("/api/avisos")).body;
  const rb = await q(blvd);
  check("el gerente solo ve los de SU sucursal", rb.body.leads.length > 0 && rb.body.leads.every((l) => l.sucursal === "BLVD_ZACATECAS"));
  check("la cantidad coincide con «con más de 24 h» de su campana", rb.body.leads.length === avB.atrasados, `${rb.body.leads.length} vs ${avB.atrasados}`);
  const rk = await q(colon);
  check("el gerente de Colón no ve leads de otra sucursal", rk.body.leads.every((l) => l.sucursal === "COLON") && !rk.body.leads.some((l) => l.id === A));
  const avC = (await coord.json("/api/avisos")).body;
  check("Coordinación: la cantidad coincide con los atrasados de su campana", rc.body.leads.length === avC.atrasados, `${rc.body.leads.length} vs ${avC.atrasados}`);
  const rs = await q(coord, "&sucursal=BLVD_ZACATECAS");
  check("se combina con el filtro de sucursal", rs.body.leads.every((l) => l.sucursal === "BLVD_ZACATECAS") && rs.body.leads.some((l) => l.id === A));
  const r2 = await coord.json(`/api/leads?estado=COTIZACION&desde=${mesIni}&hasta=${hoy}`);
  check("los demás filtros de estado siguen igual", r2.status === 200 && r2.body.leads.every((l) => l.estado === "COTIZACION" || l.estado === "SEGUIMIENTO"));
  const rq = await coord.json(`/api/leads?estado=SIN_SEGUIMIENTO&q=${encodeURIComponent("SinSeg 1 " + tag)}`);
  check("funciona junto con la búsqueda por texto", rq.status === 200 && rq.body.leads.some((l) => l.id === A) && rq.body.leads.every((l) => l.estado === "NUEVO"));

  for (const id of ids) await coord.json(`/api/leads/${id}`, "DELETE");
  console.log(`\nResultado: ${pass} bien, ${fail} mal`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
