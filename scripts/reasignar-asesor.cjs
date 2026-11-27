// Traspasa TODOS los leads de un asesor a otro dentro de la misma sucursal (por salida/entrada de asesores).
// Se cambian todos sin importar su estado (nuevo, contactado, cotización, venta, perdido). No se toca updatedAt, para que
// el traspaso no los haga parecer "recién actualizados" en Inicio ni en los avisos.
//
//   node scripts/reasignar-asesor.cjs --sucursal HACIENDAS --de "Armando Gonzalez" --a "Jessica Ruvalcaba"           -> VISTA PREVIA
//   node scripts/reasignar-asesor.cjs --sucursal HACIENDAS --de "Armando Gonzalez" --a "Jessica Ruvalcaba" --aplicar -> aplica
//
// Usa la base de DATABASE_URL (si está definida en el entorno) o la de .env.local (base de PRUEBA).
// Si el asesor saliente tenía cuenta de usuario, avisa (la cuenta no se toca aquí).
if (!process.env.DATABASE_URL) require("dotenv").config({ path: ".env.local" });

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const aplicar = process.argv.includes("--aplicar");
const sucursal = (arg("sucursal") ?? "").toUpperCase();
const de = (arg("de") ?? "").trim();
const a = (arg("a") ?? "").trim();
if (!sucursal || !de || !a || de === a) {
  console.error('Uso: node scripts/reasignar-asesor.cjs --sucursal HACIENDAS --de "Nombre saliente" --a "Nombre entrante" [--aplicar]');
  process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const url = process.env.DATABASE_URL ?? "";
  const host = (url.match(/@([^/:?]+)/) ?? [])[1] ?? "(sin base)";
  console.log(`Base de datos: ${host}${/127\.0\.0\.1|localhost/.test(host) ? " (LOCAL, de prueba)" : " (NO es local)"}`);
  console.log(aplicar ? "Modo: APLICAR\n" : "Modo: VISTA PREVIA (agrega --aplicar para cambiar)\n");

  const porEstado = await prisma.lead.groupBy({ by: ["estado"], where: { sucursal, asesor: de }, _count: true });
  const total = porEstado.reduce((n, g) => n + g._count, 0);
  console.log(`Leads de ${de} en ${sucursal}: ${total}`);
  for (const g of porEstado) console.log(`  ${g.estado}: ${g._count}`);
  const yaTiene = await prisma.lead.count({ where: { sucursal, asesor: a } });
  console.log(`Leads que ya tiene ${a}: ${yaTiene}`);

  const cuentas = await prisma.user.findMany({ where: { sucursal, asesor: { in: [de, a] } }, select: { username: true, asesor: true } });
  for (const c of cuentas) console.log(`! Hay una cuenta de usuario para ${c.asesor} (${c.username}); este script no la modifica`);

  if (!aplicar) return;
  // SQL directo: Prisma actualizaría updatedAt en cada lead.
  const n = await prisma.$executeRaw`UPDATE "Lead" SET "asesor" = ${a} WHERE "sucursal"::text = ${sucursal} AND "asesor" = ${de}`;
  console.log(`\nLeads traspasados: ${n}`);
  const quedan = await prisma.lead.count({ where: { sucursal, asesor: de } });
  const ahora = await prisma.lead.count({ where: { sucursal, asesor: a } });
  console.log(`Quedan con ${de}: ${quedan} | Ahora con ${a}: ${ahora}`);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
