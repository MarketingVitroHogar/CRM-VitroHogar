-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sucursal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fecha" DATETIME NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "sucursal" TEXT NOT NULL,
    "interes" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'NUEVO',
    "responsable" TEXT NOT NULL,
    "proximoSeguimiento" DATETIME,
    "notas" TEXT NOT NULL DEFAULT '',
    "folioCotizacion" TEXT,
    "folioFactura" TEXT,
    "montoVenta" DECIMAL,
    "fechaCierre" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
