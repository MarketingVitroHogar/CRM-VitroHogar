// Pruebas de "Abiertos de meses anteriores" (tarjeta de Inicio y filtro en Leads).
//   node scripts/verify-anteriores.mjs      (servidor LOCAL de prueba en http://localhost:3001)
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
const num = (text, re) => { const m = text.match(re); return m ? Number(m[1]) : null; };
const RE = /Abiertos de meses anteriores (?:\d+ con seguimiento vencido|Siguen sin cerrar: no los pierdas de vista) (\d+)/;

async function main() {
  const coord = await as("coord");
  const blvd = await as("gerente.blvd_zacatecas");
  const colon = await as("gerente.colon");
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const [yy, mm] = hoy.split("-").map(Number);
  const mesPasado = mm === 1 ? `${yy - 1}-12-15` : `${yy}-${String(mm - 1).padStart(2, "0")}-15`;
  const ayer = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const tag = Date.now().toString().slice(-4);
  const ids = [];
  const mk = async (n, body) => { const r = await coord.json("/api/leads", "POST", { nombre: `Ant ${n} ${tag}`, telefono: `492 78${n} ${tag}`, fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS", ...body }); if (r.status !== 201) throw new Error("no se pudo crear " + JSON.stringify(r.body)); ids.push(r.body.lead.id); return r.body.lead.id; };

  console.log("\n== Antes ==");
  const G0 = await blvd.text("/inicio");
  const C0 = await coord.text("/inicio");
  check("la tarjeta aparece en Inicio (gerente y Coordinación)", G0.text.includes("Abiertos de meses anteriores") && C0.text.includes("Abiertos de meses anteriores"));
  const g0 = num(G0.text, RE), c0 = num(C0.text, RE);
  check("tiene su número en ambos", typeof g0 === "number" && typeof c0 === "number", `${g0} ${c0}`);

  console.log("\n== Se crean leads de prueba ==");
  const A = await mk(1, { fecha: mesPasado, estado: "CONTACTADO", proximoSeguimiento: ayer }); // abierto, mes pasado, seguimiento vencido
  const B = await mk(2, { fecha: mesPasado }); // Nuevo, mes pasado
  const C = await mk(3, { fecha: mesPasado, estado: "VENTA", montoVenta: 100 }); // cerrado: no cuenta
  const D = await mk(4, { estado: "CONTACTADO" }); // de este mes: no cuenta
  const lista = (c, extra = "") => c.json(`/api/leads?abiertosAnteriores=1${extra}`);
  const rc = await lista(coord);
  const idsC = rc.body.leads.map((l) => l.id);
  check("Leads: incluye los abiertos del mes pasado", idsC.includes(A) && idsC.includes(B));
  check("no incluye uno ya cerrado (Venta)", !idsC.includes(C));
  check("no incluye uno de este mes", !idsC.includes(D));
  check("ninguno está en Venta o Perdido, y todos son anteriores a este mes", rc.body.leads.every((l) => l.estado !== "VENTA" && l.estado !== "PERDIDO" && l.fecha.slice(0, 7) < hoy.slice(0, 7)));

  console.log("\n== Alcance por perfil ==");
  const rb = await lista(blvd);
  check("el gerente solo ve los de su sucursal", rb.body.leads.length > 0 && rb.body.leads.every((l) => l.sucursal === "BLVD_ZACATECAS"));
  const rk = await lista(colon);
  check("el gerente de Colón no ve los de Blvd.", rk.body.leads.every((l) => l.sucursal === "COLON") && !rk.body.leads.some((l) => l.id === A));
  const rs = await lista(coord, "&sucursal=BLVD_ZACATECAS");
  check("Coordinación puede filtrar por sucursal", rs.body.leads.every((l) => l.sucursal === "BLVD_ZACATECAS") && rs.body.leads.some((l) => l.id === A));

  console.log("\n== Tarjeta de Inicio ==");
  const G1 = await blvd.text("/inicio");
  const C1 = await coord.text("/inicio");
  check("gerente: la tarjeta coincide con la lista de Leads", num(G1.text, RE) === rb.body.leads.length, `${num(G1.text, RE)} vs ${rb.body.leads.length}`);
  check("gerente: sube en 2 (los dos abiertos nuevos)", num(G1.text, RE) === g0 + 2);
  check("Coordinación: la tarjeta coincide con la lista de Leads", num(C1.text, RE) === rc.body.leads.length, `${num(C1.text, RE)} vs ${rc.body.leads.length}`);
  check("Coordinación: sube en 2", num(C1.text, RE) === c0 + 2);
  check("avisa que hay seguimientos vencidos", /Abiertos de meses anteriores \d+ con seguimiento vencido/.test(G1.text) && /Abiertos de meses anteriores \d+ con seguimiento vencido/.test(C1.text));
  check("el gerente de Colón no ve leads de Blvd. en su tarjeta", !(await colon.text("/inicio")).text.includes(`Ant 1 ${tag}`));
  const pg = await coord.raw("/leads?abiertos=anteriores");
  check("/leads?abiertos=anteriores carga", pg.status === 200);

  for (const id of ids) await coord.json(`/api/leads/${id}`, "DELETE");
  console.log(`\nResultado: ${pass} bien, ${fail} mal`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
