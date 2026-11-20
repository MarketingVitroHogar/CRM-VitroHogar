// Pruebas de "uso diario" del CRM 1.0 (Kanban, avisos y entrada automática) contra un servidor LOCAL de prueba.
//   node scripts/verify-uso-diario.mjs      (servidor en http://localhost:3001, INTAKE_API_KEY de .env.local)
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
const intake = (body, headers = { "x-api-key": KEY }) => new Client().json("/api/intake/leads", "POST", body, headers);

async function main() {
  const coord = await as("coord");
  const colon = await as("gerente.colon");
  const blvd = await as("gerente.blvd_zacatecas");

  console.log("\n== Avisos (campana) ==");
  check("sin sesión se niega", denied((await new Client().json("/api/avisos")).status));
  const aC = (await coord.json("/api/avisos")).body;
  const aG = (await colon.json("/api/avisos")).body;
  check("Coordinación recibe resumen por sucursal (no la lista de leads)", aC.total > 0 && Array.isArray(aC.porSucursal) && aC.porSucursal.length > 0 && aC.items.length === 0, JSON.stringify(aC).slice(0, 80));
  check("cada sucursal trae total y atrasados; los totales suman el total", aC.porSucursal.every((x) => typeof x.sucursal === "string" && x.total > 0 && x.atrasados <= x.total) && aC.porSucursal.reduce((n, x) => n + x.total, 0) === aC.total);
  check("el resumen incluye varias sucursales (Colón entre ellas)", aC.porSucursal.length >= 3 && aC.porSucursal.some((x) => x.sucursal === "COLON"));
  check("el gerente NO recibe resumen por sucursal ni ventas de otros", aG.porSucursal === undefined && aG.ventas === undefined);
  check("el gerente de Colón solo ve avisos de SU sucursal", aG.items.length > 0 && aG.items.every((i) => i.sucursal === "COLON"));
  check("el gerente ve menos o igual que Coordinación", aG.total <= aC.total);
  check("marca como atrasados los de más de 24 h", aG.atrasados >= 1 && aG.items.some((i) => i.atrasado));

  console.log("\n== Kanban: mover leads (servidor) ==");
  const leadsG = (await colon.json("/api/leads")).body.leads;
  check("gerente solo recibe leads de su sucursal", leadsG.length > 0 && leadsG.every((l) => l.sucursal === "COLON"));
  const l1 = leadsG[0];
  await coord.json(`/api/leads/${l1.id}`, "PATCH", { estado: "CONTACTADO" }); // punto de partida conocido
  const mv = await colon.json(`/api/leads/${l1.id}`, "PATCH", { estado: "COTIZACION" });
  check("gerente mueve a Cotización → 200", mv.status === 200 && mv.body.lead.estado === "COTIZACION");
  check("al mover se asigna seguimiento automático", !!mv.body.lead.proximoSeguimiento);
  check("gerente NO puede regresar a Nuevo → 400", (await colon.json(`/api/leads/${l1.id}`, "PATCH", { estado: "NUEVO" })).status === 400);
  const vt = await colon.json(`/api/leads/${l1.id}`, "PATCH", { estado: "VENTA", montoVenta: 12345, folioFactura: "FAC-TEST" });
  check("mover a Venta con monto y folio → 200", vt.status === 200 && Number(vt.body.lead.montoVenta) === 12345 && !!vt.body.lead.fechaCierre);
  check("mover a Venta SIN monto también es válido → 200", (await colon.json(`/api/leads/${l1.id}`, "PATCH", { estado: "COTIZACION" })).status === 200 && (await colon.json(`/api/leads/${l1.id}`, "PATCH", { estado: "VENTA" })).status === 200);
  check("mover a Perdido → 200", (await colon.json(`/api/leads/${l1.id}`, "PATCH", { estado: "PERDIDO" })).status === 200);
  const other = (await blvd.json("/api/leads")).body.leads[0];
  check("gerente NO puede mover un lead de otra sucursal → 403", (await colon.json(`/api/leads/${other.id}`, "PATCH", { estado: "CONTACTADO" })).status === 403);
  check("Coordinación sí puede regresar a Nuevo → 200", (await coord.json(`/api/leads/${l1.id}`, "PATCH", { estado: "NUEVO" })).status === 200);

  console.log("\n== Kanban: el gerente asigna asesor al mover (servidor) ==");
  for (const n of [1, 2]) await coord.json("/api/leads", "POST", { nombre: `Kanban asignar ${n}`, telefono: `492 65${n} ${Date.now().toString().slice(-4)}`, fuente: "FACEBOOK", sucursal: "BLVD_ZACATECAS" });
  const sinAsesor = (await blvd.json("/api/leads")).body.leads.find((l) => l.estado === "NUEVO" && !l.asesor);
  check("hay un lead sin asesor en Blvd. Zacatecas para probar", !!sinAsesor);
  check("asesor de OTRA sucursal → 400", (await blvd.json(`/api/leads/${sinAsesor.id}`, "PATCH", { estado: "CONTACTADO", asesor: "Saray Salgado" })).status === 400);
  check("asesor inventado → 400", (await blvd.json(`/api/leads/${sinAsesor.id}`, "PATCH", { estado: "CONTACTADO", asesor: "Persona Inexistente" })).status === 400);
  const asg = await blvd.json(`/api/leads/${sinAsesor.id}`, "PATCH", { estado: "CONTACTADO", asesor: "Genaro Samuel Alvarado Melesio" });
  check("mover + asignar asesor de su sucursal → 200", asg.status === 200 && asg.body.lead.estado === "CONTACTADO" && asg.body.lead.asesor === "Genaro Samuel Alvarado Melesio");
  const sinAsesor2 = (await blvd.json("/api/leads")).body.leads.find((l) => l.estado === "NUEVO" && !l.asesor);
  const asgV = await blvd.json(`/api/leads/${sinAsesor2.id}`, "PATCH", { estado: "VENTA", asesor: "Yuridia Marlenne Moreno Cruz", montoVenta: 8800, folioFactura: "FAC-ASESOR" });
  check("Venta + asesor + monto + folio en un solo guardado → 200", asgV.status === 200 && asgV.body.lead.asesor?.startsWith("Yuridia") && Number(asgV.body.lead.montoVenta) === 8800);

  console.log("\n== Alertas de Coordinación: ventas cerradas ==");
  const aV = (await coord.json("/api/avisos")).body;
  const venta = aV.ventas?.find((v) => v.id === sinAsesor2.id);
  check("Coordinación ve la venta recién cerrada con sucursal y monto", !!venta && venta.sucursal === "BLVD_ZACATECAS" && Number(venta.monto) === 8800 && venta.folioFactura === "FAC-ASESOR", JSON.stringify(aV.ventas?.slice(0, 1)));
  check("las ventas vienen de la más reciente a la más antigua y son máximo 10", aV.ventas.length <= 10 && aV.ventas.every((v, i, a) => i === 0 || new Date(a[i - 1].cerradaAt) >= new Date(v.cerradaAt)));
  check("el gerente NO ve alertas de ventas (solo Coordinación)", (await blvd.json("/api/avisos")).body.ventas === undefined);
  check("no aparecen ventas cerradas hace más de 7 días", aV.ventas.every((v) => Date.now() - new Date(v.cerradaAt).getTime() < 7 * 86_400_000 + 60_000));
  check("la página /leads acepta ?sucursal=...&mes=todos", (await coord.raw("/leads?sucursal=COLON&mes=todos")).status === 200);

  console.log("\n== Entrada automática de leads ==");
  const phone = "492 " + String(100 + Math.floor(Math.random() * 899)) + " " + String(1000 + Math.floor(Math.random() * 8999));
  const ok = { nombre: "Lead Automático Prueba", telefono: phone, sucursal: "COLON", fuente: "facebook", interes: "Piso laminado", notas: "Campaña verano" };
  check("sin clave → 401", (await intake(ok, {})).status === 401);
  check("clave incorrecta → 401", (await intake(ok, { "x-api-key": "otra-clave-que-no-es-la-correcta-123" })).status === 401);
  check("una sesión de usuario NO sustituye a la clave", (await coord.json("/api/intake/leads", "POST", ok)).status === 401);
  const r1 = await intake(ok);
  check("con clave válida → 201 y crea el lead", r1.status === 201 && r1.body.duplicate === false && !!r1.body.id, JSON.stringify(r1));
  const created = (await coord.json(`/api/leads/${r1.body.id}`)).body.lead;
  check("el lead entra como Nuevo, de Colón, Facebook, sin asesor", created.estado === "NUEVO" && created.sucursal === "COLON" && created.fuente === "FACEBOOK" && !created.asesor);
  check("queda marcado como captura automática", created.notas.startsWith("Captura automática"));
  check("responsable = gerente de la sucursal", created.responsable.startsWith("Gerente"));
  const aG2 = (await colon.json("/api/avisos")).body;
  check("aparece en la campana del gerente de Colón", aG2.items.some((i) => i.id === r1.body.id));
  const aB = (await blvd.json("/api/avisos")).body;
  check("NO aparece en la campana de otra sucursal", !aB.items.some((i) => i.id === r1.body.id));
  const r2 = await intake({ ...ok, telefono: phone.replace(/ /g, "-") });
  check("mismo teléfono, misma sucursal → duplicado (200, no crea otro)", r2.status === 200 && r2.body.duplicate === true && r2.body.id === r1.body.id);
  const r3 = await intake({ ...ok, telefono: phone, sucursal: "Blvd. Zacatecas", fuente: "WhatsApp" }, { authorization: `Bearer ${KEY}` });
  check("otra sucursal y cabecera Bearer → 201", r3.status === 201 && r3.body.duplicate === false, JSON.stringify(r3));
  check("sucursal por nombre (“Colón”) se reconoce", (await intake({ ...ok, telefono: "492 555 " + String(1000 + Math.floor(Math.random() * 8999)), sucursal: "Colón", fuente: "Instagram" })).status === 201);
  check("fuente desconocida → 400", (await intake({ ...ok, telefono: "492 777 1234", fuente: "radio" })).status === 400);
  check("sucursal desconocida → 400", (await intake({ ...ok, telefono: "492 777 1235", sucursal: "Narnia" })).status === 400);
  check("teléfono incompleto → 400", (await intake({ ...ok, telefono: "123" })).status === 400);
  check("nombre vacío → 400", (await intake({ ...ok, telefono: "492 777 1236", nombre: "" })).status === 400);
  for (const id of [r1.body.id, r3.body.id]) await coord.json(`/api/leads/${id}`, "DELETE");

  console.log(`\nResultado: ${pass} correctas, ${fail} fallidas.`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
