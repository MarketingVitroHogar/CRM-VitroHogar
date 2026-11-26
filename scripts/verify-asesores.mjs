// Prueba del perfil "asesor" contra el CRM local (http://localhost:3001) con la base de PRUEBA.
// Requiere las cuentas de prueba: coord, gerente.tli, gerente.colon y los asesores 3294 (Cristian), 3330 (Karen) y 3548 (Paola); contraseña ChangeMe123!.
const BASE = "http://localhost:3001";
class C {
  jar = new Map();
  absorb(res) { for (const c of res.headers.getSetCookie?.() ?? []) { const [p] = c.split(";"); const i = p.indexOf("="); const n = p.slice(0, i), v = p.slice(i + 1); if (!v || /Max-Age=0/i.test(c)) this.jar.delete(n); else this.jar.set(n, v); } }
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  async raw(path, o = {}) { const r = await fetch(BASE + path, { redirect: "manual", ...o, headers: { ...(o.headers ?? {}), cookie: this.cookie() } }); this.absorb(r); return r; }
  async json(path, o) { const r = await this.raw(path, o); let b = null; try { b = await r.json(); } catch {} return { status: r.status, body: b }; }
  send(path, method, data) { return this.json(path, { method, headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) }); }
  async login(u) { const c = await this.raw("/api/auth/csrf"); const { csrfToken } = await c.json(); await this.raw("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, username: u, password: "ChangeMe123!", json: "true" }) }); return [...this.jar.keys()].some((k) => /session-token/.test(k)); }
}
let fails = 0;
const ok = (c, m) => { console.log(c ? "OK   " : "FALLA", m); if (!c) fails++; };
const login = async (u) => { const c = new C(); if (!(await c.login(u))) throw new Error("sin acceso: " + u); return c; };

const coord = await login("coord");
const gTli = await login("gerente.tli");
const gColon = await login("gerente.colon");
const cristian = await login("3294");
const karen = await login("3330");

// ---- Datos de prueba propios: 5 leads nuevos en TLI, repartidos entre las asesoras (se borran al final) ----
const creados = [];
const tag = Date.now().toString().slice(-6);
for (let i = 1; i <= 5; i++) {
  const r = await coord.send("/api/leads", "POST", { nombre: `PRUEBA asesor ${i}`, telefono: `49299${tag.slice(-3)}0${i}0`.slice(0, 10), sucursal: "TLI", fuente: "FACEBOOK", interes: "prueba" });
  if (r.status !== 201 && r.status !== 200) { console.log("No se pudo crear el lead de prueba", r.status, JSON.stringify(r.body)); process.exit(1); }
  creados.push(r.body.lead.id);
}
const reparto = ["Cristian", "Cristian", "Karen", "Paola", "Paola"];
for (let i = 0; i < creados.length; i++) {
  const r = await gTli.send(`/api/leads/${creados[i]}`, "PATCH", { asesor: reparto[i] });
  if (r.status !== 200) { console.log("El gerente no pudo asignar", r.status, JSON.stringify(r.body)); process.exit(1); }
}

// ---- Lista de leads ----
const todosTli = (await gTli.json("/api/leads")).body.leads;
const deCuenta = (n) => todosTli.filter((l) => l.asesor === n);
const listaCristian = (await cristian.json("/api/leads")).body.leads;
ok(listaCristian.length === deCuenta("Cristian").length && listaCristian.length > 0, `Cristian ve solo los suyos: ${listaCristian.length} (el gerente de TLI ve ${todosTli.length} en total)`);
ok(listaCristian.every((l) => l.asesor === "Cristian" && l.sucursal === "TLI"), "todos los leads de Cristian son de TLI y de Cristian");
const listaKaren = (await karen.json("/api/leads")).body.leads;
ok(listaKaren.every((l) => l.asesor === "Karen") && listaKaren.length === deCuenta("Karen").length, `Karen ve solo los suyos: ${listaKaren.length}`);
// Un parámetro de sucursal no amplía el alcance
const intento = (await cristian.json("/api/leads?sucursal=COLON")).body.leads;
ok(intento.every((l) => l.asesor === "Cristian" && l.sucursal === "TLI"), "?sucursal=COLON no le abre otras sucursales");
// Buscar tampoco
const busq = (await cristian.json("/api/leads?q=a")).body.leads;
ok(busq.every((l) => l.asesor === "Cristian"), "la búsqueda solo recorre sus leads");

// ---- Acceso a un lead ajeno ----
const deKaren = deCuenta("Karen").find((l) => creados.includes(l.id));
const deColon = (await gColon.json("/api/leads")).body.leads[0];
ok((await cristian.json(`/api/leads/${deKaren.id}`)).status === 403, "ver un lead de otra asesora de TLI: 403");
ok((await cristian.json(`/api/leads/${deColon.id}`)).status === 403, "ver un lead de otra sucursal: 403");
ok((await cristian.send(`/api/leads/${deKaren.id}`, "PATCH", { notas: "intruso" })).status === 403, "editar un lead ajeno: 403");
const pagina = await cristian.raw(`/leads/${deKaren.id}`);
ok(pagina.status === 404 || pagina.status === 307 || pagina.status === 308, `la ficha de un lead ajeno no abre (HTTP ${pagina.status})`);

// ---- Editar un lead propio ----
const propio = listaCristian.find((l) => creados.includes(l.id));
if (!propio) { console.log("No hay lead de prueba de Cristian"); fails++; }
else {
  let r = await cristian.send(`/api/leads/${propio.id}`, "PATCH", { notas: "[prueba asesor]" });
  ok(r.status === 200 && r.body.lead.notas === "[prueba asesor]", "edita las notas de su lead");
  r = await cristian.send(`/api/leads/${propio.id}`, "PATCH", { estado: "COTIZACION", folioCotizacion: "T-1" });
  ok(r.status === 200 && r.body.lead.estado === "COTIZACION", "cambia el estado de su lead");
  r = await cristian.send(`/api/leads/${propio.id}`, "PATCH", { asesor: "Karen" });
  ok(r.status === 400, `no puede pasarle el lead a otra asesora (HTTP ${r.status})`);
  r = await cristian.send(`/api/leads/${propio.id}`, "PATCH", { responsable: "Coordinador" });
  ok(r.status === 400, `no puede cambiar el responsable (HTTP ${r.status})`);
  r = await cristian.send(`/api/leads/${propio.id}`, "PATCH", { nombre: "Otro nombre" });
  ok(r.status === 400, `no puede cambiar el nombre (HTTP ${r.status})`);
  r = await cristian.send(`/api/leads/${propio.id}`, "PATCH", { estado: "NUEVO" });
  ok(r.status === 400, `no puede regresarlo a Nuevo (HTTP ${r.status})`);
  const despues = (await gTli.json(`/api/leads/${propio.id}`)).body.lead;
  ok(despues.asesor === "Cristian" && despues.nombre === propio.nombre, "el lead conserva su asesor y su nombre");
}

// ---- Lo que NO puede hacer ----
ok((await cristian.send("/api/leads", "POST", { nombre: "X", telefono: "4920000000", sucursal: "TLI", fuente: "FACEBOOK" })).status === 403, "no puede crear leads");
ok((await cristian.send(`/api/leads/${(listaCristian[0]).id}`, "DELETE")).status === 403, "no puede borrar leads");
ok((await cristian.json("/api/users")).status === 403, "no puede ver la lista de usuarios");
ok((await cristian.send(`/api/users/${"x"}`, "PATCH", { activo: false })).status === 403, "no puede activar/desactivar cuentas");
for (const ruta of ["/users", "/import", "/leads/new"]) {
  const r = await cristian.raw(ruta);
  ok(r.status >= 300 && r.status < 400, `${ruta} la redirige (HTTP ${r.status})`);
}

// ---- Avisos (campana) ----
const av = (await cristian.json("/api/avisos")).body;
ok((av.items ?? []).every((i) => i.asesor === "Cristian" && i.sucursal === "TLI"), `la campana solo muestra sus leads (${(av.items ?? []).length})`);
ok((av.seguimientos?.items ?? []).every((i) => i.asesor === "Cristian"), "los seguimientos de la campana son solo suyos");
const avG = (await gTli.json("/api/avisos")).body;
ok(avG.total >= av.total, `el gerente ve igual o más avisos (${avG.total} ≥ ${av.total})`);

// ---- Duplicados ----
const tel = deKaren.telefono;
const dup = (await cristian.json(`/api/leads/duplicados?telefono=${encodeURIComponent(tel)}`)).body.duplicados;
ok(!dup.some((d) => d.id === deKaren.id), "la búsqueda de duplicados no le revela leads de otra asesora");

// ---- Reportes: toda la sucursal (como el gerente) ----
const rP = (await cristian.json("/api/reports")).body;
const rG = (await gTli.json("/api/reports")).body;
ok(rP.metrics.totalLeads === rG.metrics.totalLeads && rP.metrics.totalLeads === todosTli.length, `Reportes: ve los de toda TLI (${rP.metrics.totalLeads})`);
ok(rP.porSucursal.length === 0, "Reportes: sin tabla de otras sucursales");

// ---- Inicio ----
const inicio = await (await cristian.raw("/inicio")).text();
const txt = inicio.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
ok(txt.includes("Tu desempeño este mes"), "Inicio: muestra «Tu desempeño este mes»");
ok(!txt.includes("Leads sin asignar"), "Inicio: sin la tarjeta «Leads sin asignar»");
ok(txt.includes("Leads sin atender"), "Inicio: con «Leads sin atender»");

// ---- El gerente sigue asignando (el lead sale de la vista de la asesora) ----
const libre = deCuenta("Paola").find((l) => creados.includes(l.id));
if (libre) {
  let r = await gTli.send(`/api/leads/${libre.id}`, "PATCH", { asesor: "Cristian" });
  ok(r.status === 200, "el gerente reasigna un lead de Paola a Cristian");
  ok((await cristian.json(`/api/leads/${libre.id}`)).status === 200, "Cristian ya lo ve");
  r = await gTli.send(`/api/leads/${libre.id}`, "PATCH", { asesor: "Paola" });
  ok((await cristian.json(`/api/leads/${libre.id}`)).status === 403, "al devolverlo a Paola, Cristian ya no lo ve");
}

// ---- Cuentas: desactivar corta la sesión; el listado muestra al asesor ----
const usuarios = (await coord.json("/api/users")).body.users;
const cuentaCristian = usuarios.find((u) => u.username === "3294");
ok(cuentaCristian?.role === "asesor" && cuentaCristian.asesor === "Cristian" && cuentaCristian.sucursal === "TLI", "Usuarios: Cristian aparece como asesor de TLI");
let r = await coord.send(`/api/users/${cuentaCristian.id}`, "PATCH", { activo: false });
ok(r.status === 200, "Coordinación desactiva la cuenta de Cristian");
ok((await cristian.json("/api/leads")).status === 401, "la sesión abierta de Cristian se corta al instante");
await coord.send(`/api/users/${cuentaCristian.id}`, "PATCH", { activo: true });
ok((await login("3294")) !== null, "al reactivarla, puede volver a entrar");

// ---- Coordinación asigna asesor SOLO en Tienda en línea ----
const leadTli = creados[4];
let rc = await coord.send(`/api/leads/${leadTli}`, "PATCH", { asesor: "Karen" });
ok(rc.status === 200 && rc.body.lead.asesor === "Karen", "Coordinación asigna asesor en un lead de TLI");
ok((await karen.json(`/api/leads/${leadTli}`)).status === 200, "Karen ya lo ve");
rc = await coord.send(`/api/leads/${leadTli}`, "PATCH", { asesor: "Alejandra" });
ok(rc.status === 400, `Coordinación no puede poner en TLI un asesor de otra sucursal (HTTP ${rc.status})`);
rc = await coord.send(`/api/leads/${leadTli}`, "PATCH", { asesor: null });
ok(rc.status === 200 && rc.body.lead.asesor === null, "Coordinación puede quitar el asesor en TLI");
const leadColon = (await gColon.json("/api/leads")).body.leads[0];
rc = await coord.send(`/api/leads/${leadColon.id}`, "PATCH", { asesor: leadColon.asesor ? null : "Alejandra" });
ok(rc.status === 403, `Coordinación NO asigna asesor en otras sucursales (HTTP ${rc.status})`);
rc = await gColon.send(`/api/leads/${leadTli}`, "PATCH", { asesor: "Karen" });
ok(rc.status === 403, "el gerente de otra sucursal no toca leads de TLI");
rc = await coord.send(`/api/leads/${leadTli}`, "PATCH", { notas: "coord edita otros campos" });
ok(rc.status === 200, "Coordinación sigue pudiendo editar el resto de los campos");

// Limpieza: borra los leads de prueba de esta corrida.
for (const id of creados) await coord.send(`/api/leads/${id}`, "DELETE");
console.log(`(leads de prueba borrados: ${creados.length})`);
console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
