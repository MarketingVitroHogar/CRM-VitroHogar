// Traspasa los leads de un asesor a otro dentro de la misma sucursal (por salida/entrada de asesores).
// Se cambian sin importar su estado (nuevo, contactado, cotización, venta, perdido). Con --mes AAAA-MM solo se traspasan los leads
// ingresados en ese mes; los de otros meses se quedan a nombre del asesor anterior como histórico. No se toca updatedAt, para que
// el traspaso no los haga parecer "recién actualizados" en Inicio ni en los avisos.
//
//   node scripts/reasignar-asesor.cjs --sucursal HACIENDAS --de "Armando Gonzalez" --a "Jessica Ruvalcaba"           -> VISTA PREVIA
//   node scripts/reasignar-asesor.cjs --sucursal HACIENDAS --de "Armando Gonzalez" --a "Jessica Ruvalcaba" --aplicar -> aplica
//   Agrega --mes 2026-11 para limitarlo a los leads de ese mes.
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
const mes = arg("mes"); // AAAA-MM, opcional
if (!sucursal || !de || !a || de === a || (mes !== undefined && !/^[0-9]{4}-[0-9]{2}$/.test(mes))) {
  console.error('Uso: node scripts/reasignar-asesor.cjs --sucursal HACIENDAS --de "Nombre saliente" --a "Nombre entrante" [--mes AAAA-MM] [--aplicar]');
  process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const url = process.env.DATABASE_URL ?? "";
  const host = (url.match(/@([^/:?]+)/) ?? [])[1] ?? "(sin base)";
  console.log(`Base de datos: ${host}${/127\.0\.0\.1|localhost/.test(host) ? " (LOCAL, de prueba)" : " (NO es local)"}`);
  console.log(aplicar ? "Modo: APLICAR\n" : "Modo: VISTA PREVIA (agrega --aplicar para cambiar)\n");

  const filtroMes = mes ? ` (solo leads de ${mes})` : "";
  const filas = mes
    ? await prisma.$queryRaw`SELECT "estado"::text AS estado, count(*)::int AS n FROM "Lead" WHERE "sucursal"::text = ${sucursal} AND "asesor" = ${de} AND to_char("fecha", 'YYYY-MM') = ${mes} GROUP BY 1 ORDER BY 1`
    : await prisma.$queryRaw`SELECT "estado"::text AS estado, count(*)::int AS n FROM "Lead" WHERE "sucursal"::text = ${sucursal} AND "asesor" = ${de} GROUP BY 1 ORDER BY 1`;
  const total = filas.reduce((n, g) => n + g.n, 0);
  console.log(`Leads de ${de} en ${sucursal}${filtroMes}: ${total}`);
  for (const g of filas) console.log(`  ${g.estado}: ${g.n}`);
  if (mes) {
    const todos = await prisma.lead.count({ where: { sucursal, asesor: de } });
    console.log(`Se quedan a nombre de ${de} (otros meses): ${todos - total}`);
  }
  const yaTiene = await prisma.lead.count({ where: { sucursal, asesor: a } });
  console.log(`Leads que ya tiene ${a}: ${yaTiene}`);

  const cuentas = await prisma.user.findMany({ where: { sucursal, asesor: { in: [de, a] } }, select: { username: true, asesor: true } });
  for (const c of cuentas) console.log(`! Hay una cuenta de usuario para ${c.asesor} (${c.username}); este script no la modifica`);

  if (!aplicar) return;
  // SQL directo: Prisma actualizaría updatedAt en cada lead.
  const n = mes
    ? await prisma.$executeRaw`UPDATE "Lead" SET "asesor" = ${a} WHERE "sucursal"::text = ${sucursal} AND "asesor" = ${de} AND to_char("fecha", 'YYYY-MM') = ${mes}`
    : await prisma.$executeRaw`UPDATE "Lead" SET "asesor" = ${a} WHERE "sucursal"::text = ${sucursal} AND "asesor" = ${de}`;
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
