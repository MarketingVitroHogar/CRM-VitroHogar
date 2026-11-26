-- Usuarios para asesores: nuevo perfil "asesor" y, en cada cuenta, el nombre del asesor al que corresponde.
-- Solo AGREGA: no modifica ni borra datos existentes.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'asesor';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "asesor" TEXT;

-- CreateIndex (una sola cuenta por asesor de cada sucursal; varias cuentas con asesor vacío, como Coordinación y gerentes, sí se permiten)
CREATE UNIQUE INDEX "User_sucursal_asesor_key" ON "User"("sucursal", "asesor");
