import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SUCURSALES, gerenteUsername } from "../src/lib/catalogs";

const prisma = new PrismaClient();

async function main() {
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  await prisma.user.upsert({
    where: { username: "coord" },
    update: {},
    create: { username: "coord", passwordHash, role: Role.coord, sucursal: null },
  });

  for (const sucursal of SUCURSALES) {
    const username = gerenteUsername(sucursal);
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, passwordHash, role: Role.gerente, sucursal },
    });
  }

  console.log(`Seeded 1 coord + ${SUCURSALES.length} gerente users.`);
  console.log(`Default password for all accounts: ${defaultPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
