// Pruebas de seguridad del CRM 1.0 contra un servidor LOCAL con base de PRUEBA.
//   node scripts/verify-security.mjs            (servidor en http://localhost:3001)
// Cuentas usadas: coord, gerente.colon, gerente.tli, gerente.haciendas (contraseña inicial ChangeMe123!).
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
      if (val === "" || /Max-Age=0/i.test(c) || /expires=Thu, 01 Jan 1970/i.test(c)) this.jar.delete(name);
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
  /** Devuelve { ok, error } como la pantalla de login (código del error de NextAuth). */
  async login(username, password) {
    const c = await this.raw("/api/auth/csrf"); const { csrfToken } = await c.json();
    const res = await this.raw("/api/auth/callback/credentials", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, username, password, json: "true" }),
    });
    const data = await res.json().catch(() => ({}));
    const err = data.url ? new URL(data.url, BASE).searchParams.get("error") : null;
    const hasSession = [...this.jar.keys()].some((k) => /session-token/.test(k));
    return { ok: hasSession && !err, error: err };
  }
  async session() { return (await this.json("/api/auth/session")).body; }
}

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, extra); } };
// Sin sesión, el middleware de NextAuth redirige al login (307) o la ruta responde 401: ambos niegan el acceso.
const denied = (st) => st === 401 || st === 307;
const as = async (u, p = PW) => { const c = new Client(); const r = await c.login(u, p); if (!r.ok) throw new Error(`No se pudo entrar como ${u}: ${r.error}`); return c; };

async function main() {
  console.log("\n== Inicio de sesión ==");
  for (const u of ["gerente.colon", "Gerente.Colón ", " GERENTE.COLON"]) check(`usuario "${u}" entra`, (await new Client().login(u, PW)).ok);
  const bad = await new Client().login("gerente.colon", "incorrecta");
  check("contraseña incorrecta → mensaje genérico", !bad.ok && bad.error === "CredentialsSignin");
  const ghost = await new Client().login("no.existe", "x");
  check("usuario inexistente → mismo mensaje genérico", !ghost.ok && ghost.error === "CredentialsSignin");

  console.log("\n== Bloqueo por intentos fallidos ==");
  const lk = new Client();
  const r = [];
  for (let i = 0; i < 5; i++) r.push((await lk.login("gerente.haciendas", "mala" + i)).error);
  check("errores 1 y 2: mensaje genérico", r[0] === "CredentialsSignin" && r[1] === "CredentialsSignin", JSON.stringify(r));
  check("error 3: avisa que quedan 2 intentos", r[2] === "REMAINING:2", r[2]);
  check("error 4: avisa que queda 1 intento", r[3] === "REMAINING:1", r[3]);
  check("error 5: cuenta bloqueada", r[4] === "LOCKED", r[4]);
  check("bloqueada: ni la contraseña correcta entra", (await new Client().login("gerente.haciendas", PW)).error === "LOCKED");
  const coord = await as("coord");
  const list = (await coord.json("/api/users")).body.users;
  const hac = list.find((u) => u.username === "gerente.haciendas");
  check("Coordinación ve la cuenta como bloqueada", hac.bloqueada === true);
  check("Coordinación quita el bloqueo → 200", (await coord.json(`/api/users/${hac.id}/unlock`, "POST")).status === 200);
  check("tras quitar el bloqueo la contraseña correcta entra", (await new Client().login("gerente.haciendas", PW)).ok);
  const okReset = new Client(); await okReset.login("gerente.haciendas", "mala"); await okReset.login("gerente.haciendas", "mala");
  await new Client().login("gerente.haciendas", PW);
  const again = []; const c2 = new Client();
  for (let i = 0; i < 2; i++) again.push((await c2.login("gerente.haciendas", "mala")).error);
  check("un acceso correcto reinicia el conteo (vuelve a empezar de cero)", again[0] === "CredentialsSignin" && again[1] === "CredentialsSignin", JSON.stringify(again));

  console.log("\n== Aviso y cambio de contraseña ==");
  const col = await as("gerente.colon");
  const s0 = await col.session();
  check("sesión inicial: contraseña aún sin cambiar (se muestra el aviso)", s0?.user?.passwordChanged === false);
  const P = (a, n, c) => col.json("/api/account/password", "POST", { actual: a, nueva: n, confirmar: c });
  check("actual incorrecta → 400", (await P("incorrecta", "NuevaClave123", "NuevaClave123")).status === 400);
  check("nueva de menos de 8 caracteres → 400", (await P(PW, "corta", "corta")).status === 400);
  check("nueva igual a la actual → 400", (await P(PW, PW, PW)).status === 400);
  check("confirmación distinta → 400", (await P(PW, "NuevaClave123", "otra")).status === 400);
  check("sin sesión: se niega el acceso", denied((await new Client().json("/api/account/password", "POST", { actual: PW, nueva: "NuevaClave123", confirmar: "NuevaClave123" })).status));
  check("cambio válido → 200", (await P(PW, "NuevaClave123", "NuevaClave123")).status === 200);
  check("después del cambio el aviso deja de mostrarse", (await col.session())?.user?.passwordChanged === true);
  check("la contraseña vieja ya no sirve", !(await new Client().login("gerente.colon", PW)).ok);
  check("la nueva sí", (await new Client().login("gerente.colon", "NuevaClave123")).ok);

  console.log("\n== Permisos de la pantalla Usuarios (servidor) ==");
  const ger = await as("gerente.tli");
  check("sin sesión: /api/users se niega", denied((await new Client().json("/api/users")).status));
  check("gerente: GET /api/users → 403", (await ger.json("/api/users")).status === 403);
  check("gerente: PATCH /api/users/:id → 403", (await ger.json(`/api/users/${hac.id}`, "PATCH", { activo: false })).status === 403);
  check("gerente: restablecer contraseña → 403", (await ger.json(`/api/users/${hac.id}/reset-password`, "POST")).status === 403);
  const pg = await ger.raw("/users");
  check("gerente: la página /users lo manda a /leads", pg.status >= 300 && pg.status < 400 && (pg.headers.get("location") ?? "").includes("/leads"));
  check("coordinación: la página /users abre", (await coord.raw("/users")).status === 200);
  check("la lista de usuarios NO expone hashes", !JSON.stringify(list).includes("passwordHash") && !/\$2[aby]\$/.test(JSON.stringify(list)));

  console.log("\n== Activar / desactivar ==");
  const tli = list.find((u) => u.username === "gerente.tli");
  const me = list.find((u) => u.isMe);
  check("sesión abierta de gerente.tli funciona antes de desactivar", (await ger.json("/api/leads")).status === 200);
  check("no puedes desactivar tu propia cuenta → 400", (await coord.json(`/api/users/${me.id}`, "PATCH", { activo: false })).status === 400);
  check("desactivar a gerente.tli → 200", (await coord.json(`/api/users/${tli.id}`, "PATCH", { activo: false })).status === 200);
  check("su sesión ABIERTA se corta de inmediato (401)", (await ger.json("/api/leads")).status === 401);
  check("la pantalla de su sesión abierta lo manda al login", ((await ger.raw("/leads")).headers.get("location") ?? "").includes("/login") || (await ger.raw("/leads")).status === 307);
  const off = await new Client().login("gerente.tli", PW);
  check("con contraseña correcta ve 'cuenta desactivada'", off.error === "INACTIVE", off.error);
  const offBad = await new Client().login("gerente.tli", "mala");
  check("con contraseña incorrecta NO se revela que está desactivada", offBad.error === "CredentialsSignin", offBad.error);
  check("restablecer contraseña de cuenta desactivada → 400", (await coord.json(`/api/users/${tli.id}/reset-password`, "POST")).status === 400);
  check("reactivar → 200", (await coord.json(`/api/users/${tli.id}`, "PATCH", { activo: true })).status === 200);
  check("reactivada vuelve a entrar", (await new Client().login("gerente.tli", PW)).ok);
  const list2 = (await coord.json("/api/users")).body.users;
  check("desactivar no borra nada (14 cuentas siguen)", list2.length === 14);

  console.log("\n== Restablecer contraseña ==");
  const rs = await coord.json(`/api/users/${hac.id}/reset-password`, "POST");
  check("coordinación restablece → 200 con contraseña temporal de 12 caracteres", rs.status === 200 && rs.body.temporal?.length === 12);
  check("la contraseña anterior ya no sirve", !(await new Client().login("gerente.haciendas", PW)).ok);
  const tmp = new Client();
  check("la temporal entra", (await tmp.login("gerente.haciendas", rs.body.temporal)).ok);
  check("tras restablecer vuelve a mostrarse el aviso para elegir la suya", (await tmp.session())?.user?.passwordChanged === false);

  console.log(`\nResultado: ${pass} correctas, ${fail} fallidas.`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
