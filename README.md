# Vitro Hogar — CRM de seguimiento de leads

CRM interno para registrar, dar seguimiento y reportar leads de las 11 sucursales físicas y la tienda en línea (TLI) de Vitro Hogar.

Stack: Next.js (App Router) + TypeScript + Prisma + NextAuth (Credentials/JWT) + Tailwind CSS. Base de datos SQLite en desarrollo, lista para migrar a Postgres en producción.

## Requisitos

- Node.js 20+ y npm.

## Puesta en marcha (desarrollo local)

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar el archivo de variables de entorno de ejemplo:

   ```bash
   cp .env.example .env
   ```

   Genera un `NEXTAUTH_SECRET` real (por ejemplo con `openssl rand -base64 32`) y ajusta `SEED_DEFAULT_PASSWORD` si quieres una contraseña inicial distinta a la de ejemplo.

3. Crear la base de datos y aplicar el esquema:

   ```bash
   npx prisma migrate dev --name init
   ```

4. Sembrar los usuarios iniciales (1 Coordinador/CM + 1 Gerente por sucursal, 13 cuentas en total):

   ```bash
   npx prisma db seed
   ```

   Todas las cuentas comparten la misma contraseña inicial (`SEED_DEFAULT_PASSWORD` en `.env`, por defecto `ChangeMe123!`). Los usuarios generados son:

   - `coord` — Coordinador / Community Manager (acceso completo a todas las sucursales)
   - `gerente.blvd_zacatecas`, `gerente.universidad`, `gerente.haciendas`, `gerente.lopez_mateos`, `gerente.ayuntamiento`, `gerente.paseo_de_la_cruz`, `gerente.rincon_de_romos`, `gerente.jesus_maria`, `gerente.gonzalez_gallo`, `gerente.juan_pablo`, `gerente.guadalupe`, `gerente.tli` — un Gerente por sucursal, limitado a los leads de su propia sucursal

   No hay pantalla de gestión de usuarios en esta versión: para cambiar contraseñas o agregar cuentas se vuelve a correr el seed (es idempotente) o se edita directamente la base de datos.

5. Levantar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000) e iniciar sesión con cualquiera de los usuarios anteriores.

## Roles y permisos

- **Coordinador / Community Manager (`coord`)**: alta, edición completa y eliminación de leads en todas las sucursales; panel de reportes completo; importación de Excel.
- **Gerente de sucursal (`gerente`)**: solo ve y edita los leads de su propia sucursal; no puede crear ni eliminar leads; solo puede editar estado (sin poder asignar "Nuevo"), responsable, próximo seguimiento, notas, folio de cotización, folio de factura, monto de venta y fecha de cierre. El resto de los campos quedan bloqueados tanto en la interfaz como en el backend.

## Importación mensual desde Excel

Disponible solo para Coordinador/CM en **Importar Excel**. Sube un `.xlsx`/`.xls`, elige la hoja si el archivo tiene varias, revisa la vista previa (conteo por sucursal y filas con problemas) y confirma. Las filas con sucursal no reconocida permiten asignar manualmente la sucursal correcta o excluir la fila antes de confirmar.

El mapeo de columnas es flexible (por texto de encabezado, tolerante a acentos/mayúsculas/abreviaciones) pero fue calibrado sobre archivos de ejemplo. Si el archivo real de la empresa usa encabezados muy distintos a los previstos ("fecha", "nombre/cliente", "teléfono/número", "qué busca/interés/producto", "sucursal", "fuente/canal/plataforma" o columnas separadas WA/FB/IG/TT), puede requerir un ajuste en `src/lib/excelImport/columnMapping.ts`.

**No hay deduplicación automática**: si el mismo archivo se importa dos veces, los leads se duplican. Mejora futura sugerida: comparar nombre + teléfono + fecha antes de insertar.

## Despliegue a producción

Este proyecto está listo para desplegarse en **Vercel** (frontend) + **Neon** o **Supabase** (Postgres), ambos con capa gratuita:

1. Crear una base de datos Postgres en Neon o Supabase y copiar su cadena de conexión.
2. En `prisma/schema.prisma`, cambiar `provider = "sqlite"` por `provider = "postgresql"` en el bloque `datasource`.
3. Definir las variables de entorno en Vercel: `DATABASE_URL` (la cadena de Postgres), `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (la URL pública del deploy).
4. Aplicar las migraciones contra la base de datos de producción: `npx prisma migrate deploy`.
5. Correr el seed de usuarios una vez contra producción: `npx prisma db seed`.
6. Conectar el repositorio a Vercel y desplegar.

## Comandos útiles

```bash
npm run dev        # servidor de desarrollo
npm run build      # build de producción
npm run lint       # eslint
npx prisma studio  # explorador visual de la base de datos
```
