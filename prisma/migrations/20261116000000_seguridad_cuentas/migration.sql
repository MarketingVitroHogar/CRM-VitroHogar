-- Seguridad de cuentas (CRM 1.0): desactivar cuentas, fecha del último cambio de
-- contraseña y bloqueo temporal por intentos fallidos.
-- ADITIVA: solo agrega 4 columnas a "User" con valores por omisión; no borra ni
-- modifica datos existentes (todas las cuentas actuales quedan activas, sin bloqueo
-- y con "passwordChangedAt" vacío).
ALTER TABLE "User" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);
