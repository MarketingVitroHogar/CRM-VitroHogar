// Crea (o completa) las cuentas de usuario de los asesores de una sucursal. Es idempotente: si la cuenta ya existe, no la toca.
//
//   node scripts/crear-asesores.cjs                      -> VISTA PREVIA (no escribe nada)
//   node scripts/crear-asesores.cjs --aplicar            -> crea las cuentas que falten
//   node scripts/crear-asesores.cjs --sucursal TLI --asesores "Cristian,Karen,Paola"
//
// Usa la base de DATABASE_URL (si está definida en el entorno) o la de .env.local (base de PRUEBA).
// Cada cuenta: usuario asesor.<sucursal>.<nombre> (p. ej. asesor.tli.cristian), perfil "asesor", la contraseña inicial
// de siempre (SEED_DEFAULT_PASSWORD o ChangeMe123!) y sin cambio de contraseña todavía (se le recomienda cambiarla al entrar).
// El nombre del asesor debe ser EXACTAMENTE el del catálogo de la sucursal (src/lib/catalogs.ts): es el que se guarda en cada lead.
if (!process.env.DATABASE_URL) require("dotenv").config({ path: ".env.local" });

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const aplicar = process.argv.includes("--aplicar");
const sucursal = (arg("sucursal") ?? "TLI").toUpperCase();
// Por omisión, los asesores de Tienda en línea (los mismos de ASESORES_POR_SUCURSAL.TLI).
const asesores = (arg("asesores") ?? "Cristian,Karen,Paola").split(",").map((s) => s.trim()).filter(Boolean);

const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

(async () => {
  const url = process.env.DATABASE_URL ?? "";
  const host = (url.match(/@([^/:?]+)/) ?? [])[1] ?? "(sin base)";
  console.log(`Base de datos: ${host}${/127\.0\.0\.1|localhost/.test(host) ? " (LOCAL, de prueba)" : " (NO es local)"}`);
  console.log(aplicar ? "Modo: APLICAR\n" : "Modo: VISTA PREVIA (agrega --aplicar para crear)\n");

  const password = process.env.SEED_DEFAULT_PASSWORD ?? "ChangeMe123!";
  const passwordHash = aplicar ? await bcrypt.hash(password, 10) : "";

  for (const nombre of asesores) {
    const username = `asesor.${sucursal.toLowerCase()}.${slug(nombre)}`;
    const existe = await prisma.user.findFirst({ where: { OR: [{ username }, { sucursal, asesor: nombre }] } });
    if (existe) {
      console.log(`= ${username}: ya existe (${existe.username}, ${existe.role}); no se toca`);
      continue;
    }
    if (!aplicar) {
      console.log(`+ ${username}: se crearía (asesor "${nombre}" de ${sucursal})`);
      continue;
    }
    await prisma.user.create({ data: { username, passwordHash, role: "asesor", sucursal, asesor: nombre } });
    console.log(`+ ${username}: creada`);
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
