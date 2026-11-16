# Vitro Hogar — CRM de seguimiento de leads

CRM interno para registrar, dar seguimiento y reportar leads de las 12 sucursales físicas (incluida Colón) y la tienda en línea (TLI) de Vitro Hogar.

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

4. Sembrar los usuarios iniciales (1 Coordinador/CM + 1 Gerente por sucursal, 14 cuentas en total):

   ```bash
   npx prisma db seed
   ```

   Todas las cuentas comparten la misma contraseña inicial (`SEED_DEFAULT_PASSWORD` en `.env`, por defecto `ChangeMe123!`). Los usuarios generados son:

   - `coord` — Coordinador / Community Manager (acceso completo a todas las sucursales)
   - `gerente.blvd_zacatecas`, `gerente.universidad`, `gerente.haciendas`, `gerente.lopez_mateos`, `gerente.ayuntamiento`, `gerente.paseo_de_la_cruz`, `gerente.rincon_de_romos`, `gerente.jesus_maria`, `gerente.gonzalez_gallo`, `gerente.juan_pablo`, `gerente.guadalupe`, `gerente.colon`, `gerente.tli` — un Gerente por sucursal, limitado a los leads de su propia sucursal

   **Seguridad de cuentas:** cada persona puede cambiar su contraseña desde su nombre de usuario (arriba a la derecha → Cambiar contraseña; mínimo 8 caracteres, siempre cifrada). Al entrar, mientras no la haya cambiado, ve un aviso recomendándolo (no es obligatorio). Tras 5 contraseñas incorrectas seguidas la cuenta se bloquea 15 minutos. Coordinación tiene la pestaña **Usuarios** para desactivar/reactivar cuentas (no se borra nada y la sesión abierta se cierra al instante), restablecer una contraseña (temporal que se muestra una sola vez) y quitar bloqueos. Agregar cuentas nuevas sigue siendo con el seed (idempotente) o directo en la base.

   Pruebas: con un servidor local y una base de prueba, `node scripts/verify-security.mjs`.

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

## Uso diario: Kanban, avisos y captura automática de leads

- **Leads** se puede ver como **Kanban** (por defecto), **Lista** o **Tarjetas**; cada persona conserva la vista que eligió. El Kanban agrupa los estados en 5 columnas (Nuevo, Contactado [incluye No respondió], Cotización [incluye Seguimiento], Venta y Perdido); las tarjetas se arrastran entre columnas (en celular hay un selector "Mover a"). El gerente no puede regresar un lead a "Nuevo" (solo Coordinación).
- **Campana de avisos** (arriba): para el **gerente**, sus leads en estado "Nuevo" por atender (últimos 30 días). Para **Coordinación**, un resumen por sucursal ("Blvd. Zacatecas — 8 sin atender", con cuántos llevan más de 24 h; al tocar una sucursal abre sus leads) y las **ventas cerradas** de los últimos 7 días (monto, sucursal y folio).
- **Kanban, gerente:** al mover un lead que aún no tiene asesor se pide elegir uno de la sucursal (si la sucursal no tiene asesores registrados, no se pide); al pasar a Venta también se pide monto y folio.
- **Captura automática**: un servicio externo (Zapier, Make, formulario de Meta, etc.) puede crear leads con `POST /api/intake/leads`, enviando la clave en la cabecera `x-api-key` (o `Authorization: Bearer`). Cuerpo: `{ "nombre", "telefono", "sucursal", "fuente", "interes"?, "notas"? }`. El lead entra como "Nuevo" y sin asesor, aparece en la campana y evita duplicados (mismo teléfono y sucursal en 14 días). Requiere definir `INTAKE_API_KEY` (24+ caracteres) en Vercel; sin ella la ruta responde 503.

Pruebas: con servidor y base locales de prueba, `node scripts/verify-uso-diario.mjs`.
