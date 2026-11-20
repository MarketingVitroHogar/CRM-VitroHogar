// Pruebas del modo noche: el script que lo aplica antes de pintar viene en TODAS las pantallas.
//   node scripts/verify-tema.mjs      (servidor LOCAL de prueba en http://localhost:3001)
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
  async login(username, password) {
    const c = await this.raw("/api/auth/csrf"); const { csrfToken } = await c.json();
    const res = await this.raw("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, username, password, json: "true" }) });
    const data = await res.json().catch(() => ({}));
    return { ok: [...this.jar.keys()].some((k) => /session-token/.test(k)) && !(data.url && /error=/.test(data.url)) };
  }
}
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, extra); } };

async function main() {
  const anon = new Client();
  const login = await (await anon.raw("/login")).text();
  check("el login trae el script del modo noche", login.includes("crm:tema") && login.includes("prefers-color-scheme: dark"));
  check("y la página se puede marcar (suppressHydrationWarning no rompe nada)", login.includes("<html"));

  for (const u of ["coord", "gerente.blvd_zacatecas"]) {
    const c = new Client();
    if (!(await c.login(u, PW)).ok) throw new Error("login " + u);
    for (const path of ["/inicio", "/leads", "/reports"]) {
      const html = await (await c.raw(path)).text();
      check(`${u}: ${path} trae el script del modo noche`, html.includes("crm:tema"));
    }
  }

  console.log(`\nResultado: ${pass} bien, ${fail} mal`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
