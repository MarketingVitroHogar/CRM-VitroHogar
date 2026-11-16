// Deja las cuentas de la base de PRUEBA como recién sembradas (contraseña inicial, activas, sin bloqueo).
// Solo corre contra una base local.
require("dotenv").config({ path: ".env.local" });
const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error("ABORTADO: DATABASE_URL no es una base local.");
  process.exit(1);
}
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash("ChangeMe123!", 10);
  const r = await prisma.user.updateMany({
    data: { passwordHash: hash, passwordChangedAt: null, activo: true, failedLoginCount: 0, lockedUntil: null },
  });
  console.log(`Cuentas de prueba restablecidas: ${r.count}`);
  await prisma.$disconnect();
})();
