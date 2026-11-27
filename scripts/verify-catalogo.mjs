// Prueba del catálogo de asesores administrado por Coordinación (agregar / dar de baja con traspaso) contra el CRM local
// (http://localhost:3001) con la base de PRUEBA. Requiere las cuentas de prueba (coord, gerente.haciendas, gerente.tli y 3294); contraseña ChangeMe123!.
// Crea sus propios datos con nombres únicos (ZZ…); los leads se borran al final.
const BASE = "http://localhost:3001";
class C {
  jar = new Map();
  absorb(res) { for (const c of res.headers.getSetCookie?.() ?? []) { const [p] = c.split(";"); const i = p.indexOf("="); const n = p.slice(0, i), v = p.slice(i + 1); if (!v || /Max-Age=0/i.test(c)) this.jar.delete(n); else this.jar.set(n, v); } }
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  async raw(path, o = {}) { const r = await fetch(BASE + path, { redirect: "manual", ...o, headers: { ...(o.headers ?? {}), cookie: this.cookie() } }); this.absorb(r); return r; }
  async json(path, o) { const r = await this.raw(path, o); let b = null; try { b = await r.json(); } catch {} return { status: r.status, body: b }; }
  send(path, method, data) { return this.json(path, { method, headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) }); }
  async login(u, pw = "ChangeMe123!") { const c = await this.raw("/api/auth/csrf"); const { csrfToken } = await c.json(); await this.raw("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, username: u, password: pw, json: "true" }) }); return [...this.jar.keys()].some((k) => /session-token/.test(k)); }
}
let fails = 0;
const ok = (c, m) => { console.log(c ? "OK   " : "FALLA", m); if (!c) fails++; };
const login = async (u) => { const c = new C(); if (!(await c.login(u))) throw new Error("sin acceso: " + u); return c; };

const coord = await login("coord");
const gHac = await login("gerente.haciendas");
const gTli = await login("gerente.tli");
const asesorTli = await login("3294");

const tag = Date.now().toString().slice(-6);
const UNO = `ZZ Prueba Uno ${tag}`;
const DOS = `ZZ Prueba Dos ${tag}`;
const CUENTA = `ZZ Con Cuenta ${tag}`;
const creados = [];
let tel = 4000000000 + Number(tag) * 10;
const nuevoLead = async (extra) => {
  const r = await coord.send("/api/leads", "POST", { nombre: `PRUEBA catalogo ${tel}`, telefono: String(tel++), sucursal: "HACIENDAS", fuente: "FACEBOOK", interes: "prueba", ...extra });
  if (r.status !== 201 && r.status !== 200) { console.log("No se pudo crear el lead de prueba", r.status, JSON.stringify(r.body)); process.exit(1); }
  creados.push(r.body.lead.id);
  return r.body.lead;
};
const asesorDe = async (id) => (await coord.json(`/api/leads/${id}`)).body.lead;
const catalogo = async () => (await coord.json("/api/asesores")).body.asesores;

// ---- Permisos: solo Coordinación ----
ok((await gHac.json("/api/asesores")).status === 403, "gerente no puede ver el catálogo (403)");
ok((await gHac.send("/api/asesores", "POST", { sucursal: "HACIENDAS", nombre: "Intruso Gerente" })).status === 403, "gerente no puede agregar asesores (403)");
ok((await asesorTli.send("/api/asesores", "POST", { sucursal: "TLI", nombre: "Intruso Asesor" })).status === 403, "asesor no puede agregar asesores (403)");
const inicial = await catalogo();
const jessica = inicial.find((a) => a.sucursal === "HACIENDAS" && a.nombre === "Jessica Ruvalcaba");
ok(inicial.length >= 45 && !!jessica && jessica.activo, `catálogo inicial cargado: ${inicial.length} asesores, Jessica Ruvalcaba activa en Haciendas`);
ok((await gHac.send(`/api/asesores/${jessica.id}/baja`, "POST", { traspasar: false })).status === 403, "gerente no puede dar de baja (403)");
ok((await gHac.send(`/api/asesores/${jessica.id}`, "PATCH", { activo: true })).status === 403, "gerente no puede reactivar (403)");

// ---- Agregar ----
let r = await coord.send("/api/asesores", "POST", { sucursal: "HACIENDAS", nombre: `  ${UNO}  ` });
ok(r.status === 201, `agrega "${UNO}" (HTTP ${r.status})`);
const unoId = r.body?.id;
ok((await coord.send("/api/asesores", "POST", { sucursal: "HACIENDAS", nombre: UNO.toUpperCase() })).status === 409, "mismo nombre (aunque cambien las mayúsculas): 409");
ok((await coord.send("/api/asesores", "POST", { sucursal: "HACIENDAS", nombre: "A" })).status === 400, "nombre demasiado corto: 400");
ok((await coord.send("/api/asesores", "POST", { sucursal: "NO_EXISTE", nombre: "Alguien Raro" })).status === 400, "sucursal inexistente: 400");
// Mismo nombre en otra sucursal sí se permite
r = await coord.send("/api/asesores", "POST", { sucursal: "COLON", nombre: UNO });
ok(r.status === 201, "el mismo nombre en otra sucursal sí se puede");

// ---- El gerente ya puede asignarle leads; a uno inexistente no ----
const L = {};
L.A = await nuevoLead({ fecha: "2026-11-10", estado: "CONTACTADO" });
L.B = await nuevoLead({ fecha: "2026-11-12", estado: "VENTA", montoVenta: 500, folioFactura: "F-1" });
L.C = await nuevoLead({ fecha: "2026-09-05", estado: "CONTACTADO" });
L.D = await nuevoLead({ fecha: "2026-09-20", estado: "PERDIDO" });
L.E = await nuevoLead({ fecha: "2026-08-03", estado: "NUEVO" });
ok((await gHac.send(`/api/leads/${L.A.id}`, "PATCH", { asesor: "Nadie Inventado" })).status === 400, "asignar a un asesor que no existe: 400");
for (const k of Object.keys(L)) {
  const rr = await gHac.send(`/api/leads/${L[k].id}`, "PATCH", { asesor: UNO });
  if (rr.status !== 200) ok(false, `el gerente asigna el lead ${k} al nuevo asesor (HTTP ${rr.status} ${JSON.stringify(rr.body)})`);
}
ok((await asesorDe(L.A.id)).asesor === UNO, "el gerente asignó leads al asesor nuevo");
const updatedAntes = (await asesorDe(L.A.id)).updatedAt;

// ---- Vista previa (no cambia nada) ----
const base = { traspasar: true, reemplazoNuevo: DOS, desde: "2026-11-01", hasta: "2026-11-30", soloAbiertos: false, confirmar: false };
r = await coord.send(`/api/asesores/${unoId}/baja`, "POST", base);
ok(r.status === 200 && r.body.preview && r.body.total === 5 && r.body.aMover === 2 && r.body.seQuedan === 3, `vista previa solo noviembre: pasan ${r.body?.aMover}, se quedan ${r.body?.seQuedan} de ${r.body?.total}`);
ok(r.body?.reemplazoEsNuevo === true, "la vista previa indica que el reemplazo es nuevo");
ok((await asesorDe(L.A.id)).asesor === UNO && (await catalogo()).find((a) => a.id === unoId)?.activo === true && !(await catalogo()).some((a) => a.nombre === DOS), "la vista previa no cambió nada (ni leads, ni baja, ni alta del reemplazo)");
r = await coord.send(`/api/asesores/${unoId}/baja`, "POST", { ...base, desde: undefined, hasta: undefined, soloAbiertos: true });
ok(r.status === 200 && r.body.aMover === 3 && r.body.seQuedan === 2, `vista previa solo abiertos: pasan ${r.body?.aMover} (nuevo/contactado), se quedan ${r.body?.seQuedan} (venta y perdido)`);
r = await coord.send(`/api/asesores/${unoId}/baja`, "POST", { ...base, desde: undefined, hasta: undefined });
ok(r.status === 200 && r.body.aMover === 5, "vista previa sin periodo: pasan todos");
r = await coord.send(`/api/asesores/${unoId}/baja`, "POST", { ...base, traspasar: false });
ok(r.status === 200 && r.body.aMover === 0 && r.body.seQuedan === 5, "sin traspaso: todo queda como histórico");

// ---- Validaciones ----
ok((await coord.send(`/api/asesores/${unoId}/baja`, "POST", { traspasar: true, confirmar: true })).status === 400, "traspasar sin reemplazo: 400");
ok((await coord.send(`/api/asesores/${unoId}/baja`, "POST", { ...base, desde: "2026-12-01", hasta: "2026-11-01" })).status === 400, "periodo al revés: 400");
ok((await coord.send(`/api/asesores/${unoId}/baja`, "POST", { ...base, reemplazoId: jessica.id })).status === 400, "reemplazo existente y nuevo a la vez: 400");
ok((await coord.send(`/api/asesores/${unoId}/baja`, "POST", { traspasar: true, reemplazoId: jessica.id })).status === 200, "reemplazo de la misma sucursal: vista previa 200");
const deTli = inicial.find((a) => a.sucursal === "TLI");
ok((await coord.send(`/api/asesores/${unoId}/baja`, "POST", { traspasar: true, reemplazoId: deTli.id })).status === 400, "reemplazo de otra sucursal: 400");
ok((await coord.send(`/api/asesores/${unoId}/baja`, "POST", { traspasar: true, reemplazoId: unoId })).status === 400, "reemplazo = el mismo asesor: 400");
ok((await coord.send(`/api/asesores/${unoId}/baja`, "POST", { traspasar: true, reemplazoNuevo: UNO.toLowerCase() })).status === 400, "reemplazo nuevo con el mismo nombre: 400");
ok((await coord.send(`/api/asesores/${unoId}/baja`, "POST", { traspasar: false, extra: 1 })).status === 400, "campos desconocidos: 400");

// ---- Confirmar: solo noviembre -> a DOS (nuevo) ----
r = await coord.send(`/api/asesores/${unoId}/baja`, "POST", { ...base, confirmar: true });
ok(r.status === 200 && r.body.traspasados === 2 && r.body.seQuedan === 3 && r.body.reemplazo === DOS, `baja confirmada: ${r.body?.traspasados} leads pasan a ${r.body?.reemplazo}, ${r.body?.seQuedan} se quedan`);
const cat = await catalogo();
const uno = cat.find((a) => a.id === unoId), dos = cat.find((a) => a.nombre === DOS && a.sucursal === "HACIENDAS");
ok(uno && !uno.activo && uno.leads === 3, "el asesor que sale queda inactivo con 3 leads históricos");
ok(dos && dos.activo && dos.leads === 2, "el reemplazo quedó creado, activo y con 2 leads");
const despues = {};
for (const k of Object.keys(L)) despues[k] = await asesorDe(L[k].id);
ok(despues.A.asesor === DOS && despues.B.asesor === DOS, "los leads de noviembre (contactado y venta) pasaron al reemplazo");
ok(despues.C.asesor === UNO && despues.D.asesor === UNO && despues.E.asesor === UNO, "los de agosto y septiembre se quedaron a nombre del asesor que salió");
ok(despues.A.updatedAt === updatedAntes && despues.A.estado === "CONTACTADO" && despues.B.estado === "VENTA", "el traspaso no cambió la fecha de actualización ni el estado");
ok((await gHac.send(`/api/leads/${L.A.id}`, "PATCH", { asesor: UNO })).status === 400, "ya no se puede asignar un lead de otro asesor al asesor dado de baja");
ok((await gHac.send(`/api/leads/${L.C.id}`, "PATCH", { asesor: UNO, notas: "se conserva el histórico" })).status === 200, "editar un lead histórico conservando su asesor sigue funcionando");
ok((await gHac.send(`/api/leads/${L.C.id}`, "PATCH", { asesor: DOS })).status === 200, "y el gerente puede reasignarlo al asesor activo");
ok((await coord.send(`/api/asesores/${unoId}/baja`, "POST", { traspasar: false, confirmar: true })).status === 409, "dar de baja a quien ya está de baja: 409");

// ---- Reactivar ----
ok((await coord.send(`/api/asesores/${unoId}`, "PATCH", { activo: true })).status === 200 && (await catalogo()).find((a) => a.id === unoId)?.activo === true, "reactivar un asesor dado de baja");
ok((await coord.send("/api/asesores", "POST", { sucursal: "HACIENDAS", nombre: DOS })).status === 409, "agregar a alguien que ya está activo: 409");

// ---- Baja con reemplazo existente, solo abiertos ----
const fresco = await nuevoLead({ fecha: "2026-11-20", estado: "CONTACTADO" });
await gHac.send(`/api/leads/${fresco.id}`, "PATCH", { asesor: UNO });
r = await coord.send(`/api/asesores/${unoId}/baja`, "POST", { traspasar: true, reemplazoId: dos.id, soloAbiertos: true, confirmar: true });
ok(r.status === 200 && r.body.traspasados >= 1 && (await asesorDe(fresco.id)).asesor === DOS, `baja con reemplazo existente y solo abiertos: pasaron ${r.body?.traspasados}`);
ok((await asesorDe(L.D.id)).asesor === UNO || (await asesorDe(L.D.id)).asesor === DOS, "(los perdidos/vendidos no se movieron por el filtro de abiertos)");
ok((await asesorDe(L.D.id)).estado === "PERDIDO" && (await asesorDe(L.D.id)).asesor === UNO, "el lead perdido se quedó a nombre del asesor que salió");

// ---- Baja de un asesor con usuario: la cuenta se desactiva y su sesión deja de valer ----
ok((await coord.send("/api/asesores", "POST", { sucursal: "HACIENDAS", nombre: CUENTA })).status === 201, "agrega un asesor para probar la baja con usuario");
const nomina = `9${tag}`;
r = await coord.send("/api/users", "POST", { sucursal: "HACIENDAS", asesor: CUENTA, username: nomina });
ok(r.status === 201, `Coordinación le crea usuario (nómina ${nomina})`);
const conCuenta = new C();
ok(await conCuenta.login(nomina, r.body.temporal), "el asesor entra con su contraseña temporal");
ok((await conCuenta.json("/api/leads")).status === 200, "y consulta sus leads");
const idCuenta = (await catalogo()).find((a) => a.nombre === CUENTA).id;
r = await coord.send(`/api/asesores/${idCuenta}/baja`, "POST", { traspasar: false, confirmar: false });
ok(r.status === 200 && r.body.cuenta?.username === nomina && r.body.cuenta.activo === true, "la vista previa avisa que su usuario se desactivará");
r = await coord.send(`/api/asesores/${idCuenta}/baja`, "POST", { traspasar: false, confirmar: true });
ok(r.status === 200 && r.body.cuentaDesactivada === true, "la baja desactiva su usuario");
ok((await conCuenta.json("/api/leads")).status !== 200, "su sesión abierta deja de funcionar");
ok(!(await new C().login(nomina, "ChangeMe123!")), "y ya no puede iniciar sesión");
ok((await coord.send("/api/users", "POST", { sucursal: "HACIENDAS", asesor: CUENTA, username: `8${tag}` })).status === 400, "no se puede crear usuario a un asesor dado de baja");

// ---- Pantallas ----
const pag = await coord.raw("/users");
ok(pag.status === 200, `la pestaña Usuarios (/users) abre (HTTP ${pag.status})`);
ok((await gHac.raw("/leads")).status === 200 && (await coord.raw("/inicio")).status === 200, "Leads e Inicio siguen abriendo con el catálogo en base de datos");

// ---- Limpieza de los leads de prueba ----
for (const id of creados) await coord.send(`/api/leads/${id}`, "DELETE");
const quedan = (await coord.json("/api/leads?q=PRUEBA catalogo")).body.leads.filter((l) => l.nombre.startsWith("PRUEBA catalogo"));
ok(quedan.length === 0, "leads de prueba borrados");

console.log(fails === 0 ? "\nTODO BIEN" : `\n${fails} FALLA(S)`);
process.exit(fails === 0 ? 0 : 1);
