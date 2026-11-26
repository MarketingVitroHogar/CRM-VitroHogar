// Crea (o completa) las cuentas de usuario de los asesores de una sucursal. Es idempotente: si la cuenta ya existe, no la toca.
// El USUARIO de cada asesor es su NÚMERO DE NÓMINA.
//
//   node scripts/crear-asesores.cjs                      -> VISTA PREVIA (no escribe nada)
//   node scripts/crear-asesores.cjs --aplicar            -> crea las cuentas que falten
//   node scripts/crear-asesores.cjs --sucursal TLI --asesores "Cristian=3294,Karen=3330"
//   node scripts/crear-asesores.cjs --aplicar --renombrar -> además, si la cuenta del asesor existe con otro usuario, se lo cambia
//
// Usa la base de DATABASE_URL (si está definida en el entorno) o la de .env.local (base de PRUEBA).
// Cada cuenta: perfil "asesor", la contraseña inicial de siempre (SEED_DEFAULT_PASSWORD o ChangeMe123!) y sin cambio de
// contraseña todavía (se le recomienda cambiarla al entrar).
// El nombre del asesor debe ser EXACTAMENTE el del catálogo de la sucursal (src/lib/catalogs.ts): es el que se guarda en cada lead.
// Un asesor sin número de nómina se omite (falta ese dato).
if (!process.env.DATABASE_URL) require("dotenv").config({ path: ".env.local" });

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const aplicar = process.argv.includes("--aplicar");
const renombrar = process.argv.includes("--renombrar");
const sucursal = (arg("sucursal") ?? "TLI").toUpperCase();
// Por omisión, los asesores de Tienda en línea (ASESORES_POR_SUCURSAL.TLI) con su número de nómina. Paola 3548.
const lista = (arg("asesores") ?? "Cristian=3294,Karen=3330,Paola=3548").split(",").map((s) => s.trim()).filter(Boolean);
const asesores = lista.map((p) => {
  const [nombre, nomina] = p.split("=").map((x) => (x ?? "").trim());
  return { nombre, nomina };
});

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

  for (const { nombre, nomina } of asesores) {
    if (!/^[0-9]{3,}$/.test(nomina)) {
      console.log(`! ${nombre}: falta su número de nómina (o no es numérico); se omite`);
      continue;
    }
    const username = nomina;
    const existe = await prisma.user.findFirst({ where: { OR: [{ username }, { sucursal, asesor: nombre }] } });
    if (existe) {
      if (existe.username !== username && existe.sucursal === sucursal && existe.asesor === nombre) {
        if (renombrar && aplicar) {
          await prisma.user.update({ where: { id: existe.id }, data: { username } });
          console.log(`~ ${nombre}: usuario cambiado de ${existe.username} a ${username}`);
        } else {
          console.log(`~ ${nombre}: existe como "${existe.username}"; con --renombrar --aplicar pasaría a "${username}"`);
        }
      } else if (existe.username === username && (existe.sucursal !== sucursal || existe.asesor !== nombre)) {
        console.log(`! ${nombre}: el usuario ${username} ya lo usa otra cuenta (${existe.role}); no se toca`);
      } else {
        console.log(`= ${nombre}: ya existe con el usuario ${existe.username}; no se toca`);
      }
      continue;
    }
    if (!aplicar) {
      console.log(`+ ${username}: se crearía (asesor "${nombre}" de ${sucursal})`);
      continue;
    }
    await prisma.user.create({ data: { username, passwordHash, role: "asesor", sucursal, asesor: nombre } });
    console.log(`+ ${username}: creada (asesor "${nombre}" de ${sucursal})`);
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
