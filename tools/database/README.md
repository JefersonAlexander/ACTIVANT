# Herramientas aisladas de base de datos

Desde la raíz de ACTIVANT:

```powershell
npm.cmd ci --prefix tools/database
npm.cmd run test:db
npm.cmd run db:types
```

PostgreSQL 17 portátil, cliente `pg` y generador oficial `@supabase/typegen`, fijados con lockfile separado. No son dependencias del aplicativo. No requieren instalar un servicio ni crear usuarios del sistema. Node.js 24 y las dependencias raíz (TypeScript) deben estar disponibles.

Cada ejecución crea un clúster nuevo en `.database-tests/run-*`, escucha exclusivamente en `127.0.0.1` y un puerto libre, aplica las migraciones en orden y detiene su propio proceso en `finally`. No acepta conexiones remotas ni variables de credenciales. Los archivos locales de prueba se conservan y están excluidos de Git.

`--check-types` compara el archivo generado con el versionado. `--types` lo actualiza después de pasar la suite. La introspección usa el generador de Supabase y el esquema real de PostgreSQL; no se construyen interfaces manuales a partir de texto SQL.

En entornos restringidos de Windows puede requerirse permiso para ejecutar los binarios locales. Linux debe ejecutarlo como usuario sin privilegios; `createPostgresUser` está desactivado para no modificar cuentas del sistema.

Modelo, límites de verificación y preparación de un proyecto Supabase alojado: `../../docs/database-model.md`.


La suite incluye `tests/database/policies.mjs` (112 comprobaciones de regresión; API preliminar retirada) , `tests/database/bookings.mjs` (19 de reservas) y `tests/database/attendance.mjs` (19 de asistencia). La disputa del último cupo usa una barrera con bloqueo de fila y observa ambas solicitudes esperando antes de liberarlas. También prueba cancelación simultánea, idempotencia, restricciones y el límite de 24 horas. Los resultados separados se conservan en `.database-tests/results.json` y `.database-tests/booking-results.json`.

Las pruebas de asistencia usan una barrera de contador SQL para dos solicitudes simultáneas, QR expirados/manipulados y límites que persisten tras rechazos. Resultados en `.database-tests/attendance-results.json`.

`tests/database/program.mjs` añade 26 comprobaciones de puntos/constancia y guarda `.database-tests/program-results.json`. Con biblioteca/administración, el conjunto actual suma 217 comprobaciones y migra doce archivos SQL.

`tests/database/waitlist.mjs` añade 23 comprobaciones: FIFO, ofertas y retención, concurrencia de aceptación/reserva/rechazo, vencimiento y reasignación, cambios de capacidad, pausa, notificaciones idempotentes, RLS y publicación Realtime. Resultados en `.database-tests/waitlist-results.json`. El mantenimiento se ejecuta realmente como propietario SQL; pg_cron y el servicio Realtime alojado no están presentes en este motor nativo.

`tests/database/library-admin.mjs` añade 18 comprobaciones de catálogo, autorización, Storage privado, archivos inmutables, archivo/publicación, revisión concurrente, indicadores, invitaciones y auditoría. Resultados en `.database-tests/library-admin-results.json`. `bootstrap.sql` incluye un contrato mínimo de Storage solo para SQL; no ejecuta el servicio Storage ni verifica sus endpoints reales.
