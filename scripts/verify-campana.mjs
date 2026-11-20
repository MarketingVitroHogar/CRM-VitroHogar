// Pruebas de los seguimientos en la campana (y que coincidan con Inicio).
//   node scripts/verify-campana.mjs      (servidor LOCAL de prueba en http://localhost:3001)
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
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const RE_SEG = /Seguimientos de hoy (?:\d+ vencidos · leads ya contactados|Para hoy · leads ya contactados) (\d+)/;

async function main() {
  const coord = await as("coord");
  const blvd = await as("gerente.blvd_zacatecas");
  const colon = await as("gerente.colon");
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const [yy, mm] = hoy.split("-").map(Number);
  const mesPasado = mm === 1 ? `${yy - 1}-12-15` : `${yy}-${String(mm - 1).padStart(2, "0")}-15`;
  const tag = Date.now().toString().slice(-4);
  const ids = [];
  const mk = async (n, body) => { const r = await coord.json("/api/leads", "POST", { nombre: `Camp ${n} ${tag}`, telefono: `492 79${n} ${tag}`, fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS", ...body }); if (r.status !== 201) throw new Error("no se pudo crear " + JSON.stringify(r.body)); ids.push(r.body.lead.id); return r.body.lead.id; };

  console.log("\n== Antes ==");
  const gB0 = (await blvd.json("/api/avisos")).body;
  const cB0 = (await coord.json("/api/avisos")).body;
  const kB0 = (await colon.json("/api/avisos")).body;
  check("el gerente recibe seguimientos {total, vencidos, items}", gB0.seguimientos && typeof gB0.seguimientos.total === "number" && typeof gB0.seguimientos.vencidos === "number" && Array.isArray(gB0.seguimientos.items));
  check("Coordinación recibe seguimientos por sucursal", cB0.seguimientos && Array.isArray(cB0.seguimientos.porSucursal));
  check("el gerente NO recibe el desglose de Coordinación", gB0.seguimientos.porSucursal === undefined);

  console.log("\n== Se crean leads de prueba ==");
  const A = await mk(1, { estado: "CONTACTADO", proximoSeguimiento: addDays(hoy, -2) }); // vencido
  await mk(2, { estado: "COTIZACION", proximoSeguimiento: hoy }); // para hoy
  await mk(3, { estado: "CONTACTADO", proximoSeguimiento: addDays(hoy, 3) }); // a futuro: no cuenta
  await mk(4, { proximoSeguimiento: addDays(hoy, -2) }); // Nuevo: ya cuenta como "sin atender", no aquí
  await mk(5, { fecha: mesPasado, estado: "CONTACTADO", proximoSeguimiento: addDays(hoy, -2) }); // mes pasado: no cuenta

  const gB1 = (await blvd.json("/api/avisos")).body;
  const cB1 = (await coord.json("/api/avisos")).body;
  const kB1 = (await colon.json("/api/avisos")).body;
  check("gerente: suma exactamente 2 (el vencido y el de hoy)", gB1.seguimientos.total === gB0.seguimientos.total + 2, `${gB1.seguimientos.total} vs ${gB0.seguimientos.total}`);
  check("gerente: solo 1 más vencido", gB1.seguimientos.vencidos === gB0.seguimientos.vencidos + 1);
  check("gerente: los items traen nombre, estado y fecha de seguimiento", gB1.seguimientos.items.every((i) => i.id && i.nombre && i.estado && /^\d{4}-\d{2}-\d{2}$/.test(i.seguimiento) && typeof i.vencido === "boolean"));
  check("gerente: ningún item es un lead Nuevo, Venta o Perdido", gB1.seguimientos.items.every((i) => !["NUEVO", "VENTA", "PERDIDO"].includes(i.estado)));
  check("los «sin atender» no cambian por los seguimientos (el Nuevo ya contaba aparte)", gB1.total === gB0.total + 1 /* el lead Nuevo creado */ && true);
  const cBlvd1 = cB1.seguimientos.porSucursal.find((s) => s.sucursal === "BLVD_ZACATECAS");
  const cBlvd0 = cB0.seguimientos.porSucursal.find((s) => s.sucursal === "BLVD_ZACATECAS");
  check("Coordinación: Blvd. Zacatecas suma 2", (cBlvd1?.total ?? 0) === (cBlvd0?.total ?? 0) + 2);
  check("Coordinación: el total general suma 2", cB1.seguimientos.total === cB0.seguimientos.total + 2);
  check("el gerente de Colón no cambia", kB1.seguimientos.total === kB0.seguimientos.total);

  console.log("\n== Coincide con Inicio ==");
  const iG = await blvd.text("/inicio");
  const iC = await coord.text("/inicio");
  const nG = Number(iG.text.match(RE_SEG)?.[1]);
  check("Inicio del gerente muestra el mismo número que la campana", nG === gB1.seguimientos.total, `${nG} vs ${gB1.seguimientos.total}`);
  void iC;

  for (const id of ids) await coord.json(`/api/leads/${id}`, "DELETE");
  void A;
  console.log(`\nResultado: ${pass} bien, ${fail} mal`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
