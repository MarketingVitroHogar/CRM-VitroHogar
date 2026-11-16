// Pruebas de "solo el mes en curso" (Inicio, campana y Por asignar) contra un servidor LOCAL de prueba.
//   node scripts/verify-mes-corriente.mjs
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
    const text = html.replace(/<!--.*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
    return { status: r.status, text };
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
const RE_ASIG_G = /Leads sin asignar Elige qué asesor los atiende (\d+)/;
const RE_ATEN_G = /Leads sin atender (?:\d+ con más de 24 h|Leads nuevos sin primer contacto) (\d+)/;
const RE_ASIG_C = /Leads sin asignar Aún no tienen asesor (\d+)/;

async function main() {
  const coord = await as("coord");
  const blvd = await as("gerente.blvd_zacatecas");

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const mesIni = hoy.slice(0, 8) + "01";
  const [yy, mm] = hoy.split("-").map(Number);
  const mesPasado = mm === 1 ? `${yy - 1}-12-15` : `${yy}-${String(mm - 1).padStart(2, "0")}-15`;
  const mesNombre = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", month: "long" }).format(new Date());
  const tag = Date.now().toString().slice(-5);

  console.log("\n== Antes: lo que ya hay este mes ==");
  const G0 = await blvd.text("/inicio");
  const C0 = await coord.text("/inicio");
  check("Inicio avisa que solo muestra el mes en curso", G0.text.includes("Solo se muestran los leads de " + mesNombre), mesNombre);
  const antes = { asig: num(G0.text, RE_ASIG_G), aten: num(G0.text, RE_ATEN_G), asigC: num(C0.text, RE_ASIG_C), avisos: (await blvd.json("/api/avisos")).body.total, avisosC: (await coord.json("/api/avisos")).body.total };
  check("hay números base que comparar", Object.values(antes).every((v) => typeof v === "number"), JSON.stringify(antes));

  console.log("\n== Se crean leads del MES PASADO ==");
  const viejo = await coord.json("/api/leads", "POST", { nombre: `Viejo mes pasado ${tag}`, telefono: `492 800 ${tag.slice(0, 4)}`, fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS", fecha: mesPasado });
  const ventaVieja = await coord.json("/api/leads", "POST", { nombre: `Venta mes pasado ${tag}`, telefono: `492 801 ${tag.slice(0, 4)}`, fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS", fecha: mesPasado, estado: "VENTA", montoVenta: 999, fechaCierre: mesPasado });
  check("se crearon (201)", viejo.status === 201 && ventaVieja.status === 201, JSON.stringify([viejo.body, ventaVieja.body]).slice(0, 150));
  const created = [viejo, ventaVieja].map((x) => x.body?.lead?.id).filter(Boolean);

  const G1 = await blvd.text("/inicio");
  const C1 = await coord.text("/inicio");
  check("gerente: «sin asignar» no cambia", num(G1.text, RE_ASIG_G) === antes.asig, `${num(G1.text, RE_ASIG_G)} vs ${antes.asig}`);
  check("gerente: «sin atender» no cambia", num(G1.text, RE_ATEN_G) === antes.aten);
  check("el Inicio no menciona esos leads", !G1.text.includes("mes pasado") && !C1.text.includes("mes pasado"));
  check("Coordinación: «sin asignar» no cambia", num(C1.text, RE_ASIG_C) === antes.asigC);
  const avG = (await blvd.json("/api/avisos")).body;
  const avC = (await coord.json("/api/avisos")).body;
  check("campana del gerente: no los cuenta ni los lista", avG.total === antes.avisos && !avG.items.some((i) => i.nombre.includes("mes pasado")));
  check("campana de Coordinación: no los cuenta", avC.total === antes.avisosC);
  check("campana de Coordinación: la venta del mes pasado no sale en ventas", !avC.ventas.some((v) => v.nombre.includes("mes pasado")));
  const lista = (await blvd.json(`/api/leads?sinAsesor=1&desde=${mesIni}&hasta=${hoy}`)).body.leads;
  check("Leads «Por asignar» (rango del mes) no los incluye", !lista.some((l) => l.nombre.includes("mes pasado")) && lista.length === antes.asig, `${lista.length} vs ${antes.asig}`);

  console.log("\n== Un lead de ESTE mes sí cuenta ==");
  const nuevo = await coord.json("/api/leads", "POST", { nombre: `Nuevo este mes ${tag}`, telefono: `492 802 ${tag.slice(0, 4)}`, fuente: "WHATSAPP", sucursal: "BLVD_ZACATECAS" });
  if (nuevo.body?.lead) created.push(nuevo.body.lead.id);
  const G2 = await blvd.text("/inicio");
  check("gerente: «sin asignar» sube en 1", num(G2.text, RE_ASIG_G) === antes.asig + 1);
  check("gerente: «sin atender» sube en 1", num(G2.text, RE_ATEN_G) === antes.aten + 1);
  check("la campana sube en 1", (await blvd.json("/api/avisos")).body.total === antes.avisos + 1);
  const ventaNueva = await coord.json("/api/leads", "POST", { nombre: `Venta este mes ${tag}`, telefono: `492 803 ${tag.slice(0, 4)}`, fuente: "WHATSAPP", sucursal: "BLVD_ZACATECAS", estado: "VENTA", montoVenta: 1500 });
  if (ventaNueva.body?.lead) created.push(ventaNueva.body.lead.id);
  check("una venta de este mes sí sale en la campana de Coordinación", (await coord.json("/api/avisos")).body.ventas.some((v) => v.nombre.includes("Venta este mes")));
  check("y en «Ventas cerradas este mes» del Inicio", (await blvd.text("/inicio")).text.includes("Venta este mes " + tag));

  for (const id of created) await coord.json(`/api/leads/${id}`, "DELETE");
  console.log(`\nResultado: ${pass} bien, ${fail} mal`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
