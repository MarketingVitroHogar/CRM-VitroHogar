// Prueba del perfil "asesor" contra el CRM local (http://localhost:3001) con la base de PRUEBA.
// Requiere las cuentas de prueba: coord, gerente.tli, gerente.colon y asesor.tli.{cristian,karen,paola} (contraseña ChangeMe123!).
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
const paola = await login("asesor.tli.paola");
const karen = await login("asesor.tli.karen");

// ---- Datos de prueba propios: 5 leads nuevos en TLI, repartidos entre las asesoras (se borran al final) ----
const creados = [];
const tag = Date.now().toString().slice(-6);
for (let i = 1; i <= 5; i++) {
  const r = await coord.send("/api/leads", "POST", { nombre: `PRUEBA asesor ${i}`, telefono: `49299${tag.slice(-3)}0${i}0`.slice(0, 10), sucursal: "TLI", fuente: "FACEBOOK", interes: "prueba" });
  if (r.status !== 201 && r.status !== 200) { console.log("No se pudo crear el lead de prueba", r.status, JSON.stringify(r.body)); process.exit(1); }
  creados.push(r.body.lead.id);
}
const reparto = ["Paola", "Paola", "Karen", "Cristian", "Cristian"];
for (let i = 0; i < creados.length; i++) {
  const r = await gTli.send(`/api/leads/${creados[i]}`, "PATCH", { asesor: reparto[i] });
  if (r.status !== 200) { console.log("El gerente no pudo asignar", r.status, JSON.stringify(r.body)); process.exit(1); }
}

// ---- Lista de leads ----
const todosTli = (await gTli.json("/api/leads")).body.leads;
const deCuenta = (n) => todosTli.filter((l) => l.asesor === n);
const listaPaola = (await paola.json("/api/leads")).body.leads;
ok(listaPaola.length === deCuenta("Paola").length && listaPaola.length > 0, `Paola ve solo los suyos: ${listaPaola.length} (el gerente de TLI ve ${todosTli.length} en total)`);
ok(listaPaola.every((l) => l.asesor === "Paola" && l.sucursal === "TLI"), "todos los leads de Paola son de TLI y de Paola");
const listaKaren = (await karen.json("/api/leads")).body.leads;
ok(listaKaren.every((l) => l.asesor === "Karen") && listaKaren.length === deCuenta("Karen").length, `Karen ve solo los suyos: ${listaKaren.length}`);
// Un parámetro de sucursal no amplía el alcance
const intento = (await paola.json("/api/leads?sucursal=COLON")).body.leads;
ok(intento.every((l) => l.asesor === "Paola" && l.sucursal === "TLI"), "?sucursal=COLON no le abre otras sucursales");
// Buscar tampoco
const busq = (await paola.json("/api/leads?q=a")).body.leads;
ok(busq.every((l) => l.asesor === "Paola"), "la búsqueda solo recorre sus leads");

// ---- Acceso a un lead ajeno ----
const deKaren = deCuenta("Karen").find((l) => creados.includes(l.id));
const deColon = (await gColon.json("/api/leads")).body.leads[0];
ok((await paola.json(`/api/leads/${deKaren.id}`)).status === 403, "ver un lead de otra asesora de TLI: 403");
ok((await paola.json(`/api/leads/${deColon.id}`)).status === 403, "ver un lead de otra sucursal: 403");
ok((await paola.send(`/api/leads/${deKaren.id}`, "PATCH", { notas: "intruso" })).status === 403, "editar un lead ajeno: 403");
const pagina = await paola.raw(`/leads/${deKaren.id}`);
ok(pagina.status === 404 || pagina.status === 307 || pagina.status === 308, `la ficha de un lead ajeno no abre (HTTP ${pagina.status})`);

// ---- Editar un lead propio ----
const propio = listaPaola.find((l) => creados.includes(l.id));
if (!propio) { console.log("No hay lead de prueba de Paola"); fails++; }
else {
  let r = await paola.send(`/api/leads/${propio.id}`, "PATCH", { notas: "[prueba asesor]" });
  ok(r.status === 200 && r.body.lead.notas === "[prueba asesor]", "edita las notas de su lead");
  r = await paola.send(`/api/leads/${propio.id}`, "PATCH", { estado: "COTIZACION", folioCotizacion: "T-1" });
  ok(r.status === 200 && r.body.lead.estado === "COTIZACION", "cambia el estado de su lead");
  r = await paola.send(`/api/leads/${propio.id}`, "PATCH", { asesor: "Karen" });
  ok(r.status === 400, `no puede pasarle el lead a otra asesora (HTTP ${r.status})`);
  r = await paola.send(`/api/leads/${propio.id}`, "PATCH", { responsable: "Coordinador" });
  ok(r.status === 400, `no puede cambiar el responsable (HTTP ${r.status})`);
  r = await paola.send(`/api/leads/${propio.id}`, "PATCH", { nombre: "Otro nombre" });
  ok(r.status === 400, `no puede cambiar el nombre (HTTP ${r.status})`);
  r = await paola.send(`/api/leads/${propio.id}`, "PATCH", { estado: "NUEVO" });
  ok(r.status === 400, `no puede regresarlo a Nuevo (HTTP ${r.status})`);
  const despues = (await gTli.json(`/api/leads/${propio.id}`)).body.lead;
  ok(despues.asesor === "Paola" && despues.nombre === propio.nombre, "el lead conserva su asesor y su nombre");
}

// ---- Lo que NO puede hacer ----
ok((await paola.send("/api/leads", "POST", { nombre: "X", telefono: "4920000000", sucursal: "TLI", fuente: "FACEBOOK" })).status === 403, "no puede crear leads");
ok((await paola.send(`/api/leads/${(listaPaola[0]).id}`, "DELETE")).status === 403, "no puede borrar leads");
ok((await paola.json("/api/users")).status === 403, "no puede ver la lista de usuarios");
ok((await paola.send(`/api/users/${"x"}`, "PATCH", { activo: false })).status === 403, "no puede activar/desactivar cuentas");
for (const ruta of ["/users", "/import", "/leads/new"]) {
  const r = await paola.raw(ruta);
  ok(r.status >= 300 && r.status < 400, `${ruta} la redirige (HTTP ${r.status})`);
}

// ---- Avisos (campana) ----
const av = (await paola.json("/api/avisos")).body;
ok((av.items ?? []).every((i) => i.asesor === "Paola" && i.sucursal === "TLI"), `la campana solo muestra sus leads (${(av.items ?? []).length})`);
ok((av.seguimientos?.items ?? []).every((i) => i.asesor === "Paola"), "los seguimientos de la campana son solo suyos");
const avG = (await gTli.json("/api/avisos")).body;
ok(avG.total >= av.total, `el gerente ve igual o más avisos (${avG.total} ≥ ${av.total})`);

// ---- Duplicados ----
const tel = deKaren.telefono;
const dup = (await paola.json(`/api/leads/duplicados?telefono=${encodeURIComponent(tel)}`)).body.duplicados;
ok(!dup.some((d) => d.id === deKaren.id), "la búsqueda de duplicados no le revela leads de otra asesora");

// ---- Reportes: toda la sucursal (como el gerente) ----
const rP = (await paola.json("/api/reports")).body;
const rG = (await gTli.json("/api/reports")).body;
ok(rP.metrics.totalLeads === rG.metrics.totalLeads && rP.metrics.totalLeads === todosTli.length, `Reportes: ve los de toda TLI (${rP.metrics.totalLeads})`);
ok(rP.porSucursal.length === 0, "Reportes: sin tabla de otras sucursales");

// ---- Inicio ----
const inicio = await (await paola.raw("/inicio")).text();
const txt = inicio.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
ok(txt.includes("Tu desempeño este mes"), "Inicio: muestra «Tu desempeño este mes»");
ok(!txt.includes("Leads sin asignar"), "Inicio: sin la tarjeta «Leads sin asignar»");
ok(txt.includes("Leads sin atender"), "Inicio: con «Leads sin atender»");

// ---- El gerente sigue asignando (el lead sale de la vista de la asesora) ----
const libre = deCuenta("Cristian").find((l) => creados.includes(l.id));
if (libre) {
  let r = await gTli.send(`/api/leads/${libre.id}`, "PATCH", { asesor: "Paola" });
  ok(r.status === 200, "el gerente reasigna un lead de Cristian a Paola");
  ok((await paola.json(`/api/leads/${libre.id}`)).status === 200, "Paola ya lo ve");
  r = await gTli.send(`/api/leads/${libre.id}`, "PATCH", { asesor: "Cristian" });
  ok((await paola.json(`/api/leads/${libre.id}`)).status === 403, "al devolverlo a Cristian, Paola ya no lo ve");
}

// ---- Cuentas: desactivar corta la sesión; el listado muestra al asesor ----
const usuarios = (await coord.json("/api/users")).body.users;
const cuentaPaola = usuarios.find((u) => u.username === "asesor.tli.paola");
ok(cuentaPaola?.role === "asesor" && cuentaPaola.asesor === "Paola" && cuentaPaola.sucursal === "TLI", "Usuarios: Paola aparece como asesor de TLI");
let r = await coord.send(`/api/users/${cuentaPaola.id}`, "PATCH", { activo: false });
ok(r.status === 200, "Coordinación desactiva la cuenta de Paola");
ok((await paola.json("/api/leads")).status === 401, "la sesión abierta de Paola se corta al instante");
await coord.send(`/api/users/${cuentaPaola.id}`, "PATCH", { activo: true });
ok((await login("asesor.tli.paola")) !== null, "al reactivarla, puede volver a entrar");

// Limpieza: borra los leads de prueba de esta corrida.
for (const id of creados) await coord.send(`/api/leads/${id}`, "DELETE");
console.log(`(leads de prueba borrados: ${creados.length})`);
console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
