-- CreateEnum
CREATE TYPE "Role" AS ENUM ('coord', 'gerente');

-- CreateEnum
CREATE TYPE "Sucursal" AS ENUM ('BLVD_ZACATECAS', 'UNIVERSIDAD', 'HACIENDAS', 'LOPEZ_MATEOS', 'AYUNTAMIENTO', 'PASEO_DE_LA_CRUZ', 'RINCON_DE_ROMOS', 'JESUS_MARIA', 'GONZALEZ_GALLO', 'JUAN_PABLO', 'GUADALUPE', 'TLI');

-- CreateEnum
CREATE TYPE "Fuente" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP', 'SITIO_WEB', 'REFERIDO', 'OTRO');

-- CreateEnum
CREATE TYPE "Estado" AS ENUM ('NUEVO', 'CONTACTADO', 'COTIZACION', 'SEGUIMIENTO', 'NO_RESPONDIO', 'VENTA', 'PERDIDO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "sucursal" "Sucursal",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "sucursal" "Sucursal" NOT NULL,
    "interes" TEXT NOT NULL,
    "fuente" "Fuente" NOT NULL,
    "estado" "Estado" NOT NULL DEFAULT 'NUEVO',
    "responsable" TEXT NOT NULL,
    "proximoSeguimiento" TIMESTAMP(3),
    "notas" TEXT NOT NULL DEFAULT '',
    "folioCotizacion" TEXT,
    "folioFactura" TEXT,
    "montoVenta" DECIMAL(12,2),
    "fechaCierre" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Lead_sucursal_idx" ON "Lead"("sucursal");

-- CreateIndex
CREATE INDEX "Lead_estado_idx" ON "Lead"("estado");

-- CreateIndex
CREATE INDEX "Lead_fecha_idx" ON "Lead"("fecha");

-- CreateIndex
CREATE INDEX "Lead_fechaCierre_idx" ON "Lead"("fechaCierre");
