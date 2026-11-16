// Pruebas de la pantalla de Inicio (CRM 1.0) contra un servidor LOCAL de prueba.
//   node scripts/verify-inicio.mjs      (servidor en http://localhost:3001)
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
  async json(path) { const r = await this.raw(path); let b = null; try { b = await r.json(); } catch {} return { status: r.status, body: b }; }
  async text(path) {
    const r = await this.raw(path);
    const html = await r.text();
    const text = html.replace(/<!--.*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ");
    return { status: r.status, location: r.headers.get("location"), text };
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

async function main() {
  console.log("\n== Acceso ==");
  const anon = await new Client().text("/inicio");
  check("sin sesión, /inicio manda al login", anon.status >= 300 && anon.status < 400 && /login|signin/.test(anon.location ?? ""), `${anon.status} ${anon.location}`);

  const coord = await as("coord");
  const blvd = await as("gerente.blvd_zacatecas");
  const colon = await as("gerente.colon");
  const root = await coord.raw("/");
  check("la raíz (/) lleva a Inicio al entrar", /\/inicio$/.test(root.headers.get("location") ?? ""), root.headers.get("location"));

  console.log("\n== Coordinación ==");
  const C = await coord.text("/inicio");
  check("carga (200)", C.status === 200);
  for (const t of ["Por revisar hoy", "Leads sin asignar", "Leads sin atender", "Leads cargados", "Hoy", "Esta semana", "Este mes", "Desempeño de la red este mes", "Leads del mes", "Ventas del mes", "Total vendido", "Conversión", "Sucursales este mes", "Leads por canal este mes", "Ventas cerradas este mes", "+ Nuevo lead"])
    check(`muestra «${t}»`, C.text.includes(t));
  check("NO muestra la sección propia del gerente", !C.text.includes("Tus pendientes") && !C.text.includes("Desempeño por asesor") && !C.text.includes("Seguimientos de hoy"));
  check("Coordinación ve varias sucursales", ["Blvd. Zacatecas", "Colón", "Haciendas"].filter((s) => C.text.includes(s)).length >= 2);
    const _hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const _mes = `&desde=${_hoy.slice(0, 8)}01&hasta=${_hoy}`;
const sinAsigC = (await coord.json("/api/leads?sinAsesor=1" + _mes)).body.leads.length;
  check("el total de «sin asignar» coincide con Leads", num(C.text, /Leads sin asignar Aún no tienen asesor (\d+)/) === sinAsigC, `${num(C.text, /Leads sin asignar Aún no tienen asesor (\d+)/)} vs ${sinAsigC}`);
  const avC = (await coord.json("/api/avisos")).body;
  check("el total de «sin atender» coincide con la campana", num(C.text, /Leads sin atender (?:\d+ con más de 24 h|Leads nuevos sin primer contacto) (\d+)/) === avC.total, `${avC.total}`);
  check("avisa de sucursales sin asesores registrados (Colón)", C.text.includes("Sin asesores registrados") && /Sin asesores registrados: [^.]*Colón/.test(C.text));

  console.log("\n== Gerente (Blvd. Zacatecas) ==");
  const G = await blvd.text("/inicio");
  check("carga (200)", G.status === 200);
  for (const t of ["Tus pendientes", "Leads sin asignar", "Leads sin atender", "Seguimientos de hoy", "Desempeño de tu sucursal este mes", "Leads del mes", "Ventas del mes", "Desempeño por asesor", "Ventas cerradas este mes", "Sucursal Blvd. Zacatecas"])
    check(`muestra «${t}»`, G.text.includes(t));
  check("NO muestra lo de Coordinación", !G.text.includes("Por revisar hoy") && !G.text.includes("Sucursales este mes") && !G.text.includes("Leads por canal") && !G.text.includes("+ Nuevo lead") && !G.text.includes("Leads cargados"));
  check("NO aparecen otras sucursales", !["Haciendas", "Universidad", "Colón", "Guadalupe", "Jesús María"].some((s) => G.text.includes(s)));
  const sinAsigG = (await blvd.json("/api/leads?sinAsesor=1" + _mes)).body.leads.length;
  check("«sin asignar» = los de SU sucursal sin asesor", num(G.text, /Leads sin asignar Elige qué asesor los atiende (\d+)/) === sinAsigG, `${sinAsigG}`);
  check("muestra el botón Asignar en cada lead", sinAsigG === 0 || (G.text.match(/Asignar/g) ?? []).length >= 1);
  const avG = (await blvd.json("/api/avisos")).body;
  check("«sin atender» coincide con la campana del gerente", num(G.text, /Leads sin atender (?:\d+ con más de 24 h|Leads nuevos sin primer contacto) (\d+)/) === avG.total);
  check("el gerente es menor o igual que la red", sinAsigG <= sinAsigC && avG.total <= avC.total);

  console.log("\n== Gerente de Colón (sin asesores registrados) ==");
  const K = await colon.text("/inicio");
  check("carga (200)", K.status === 200);
  check("explica que la sucursal no tiene asesores registrados", K.text.includes("aún no tiene asesores registrados") || /Leads sin asignar[^]*✅ Todo al día/.test(K.text));
  check("no muestra otras sucursales", !["Haciendas", "Universidad", "Guadalupe", "Blvd. Zacatecas"].some((s) => K.text.includes(s)));

  console.log("\n== Leads: filtro desde Inicio ==");
  const L = await coord.raw("/leads?sinAsesor=1");
  check("/leads?sinAsesor=1 carga", L.status === 200);

  console.log(`\nResultado: ${pass} bien, ${fail} mal`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
