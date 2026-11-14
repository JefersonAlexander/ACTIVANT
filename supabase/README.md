# Modelo y seguridad de Supabase

Migraciones, en orden:

1. `20261113120000_create_profiles.sql`: base original conservada.
2. `20261113130000_gym_data_model.sql`: entidades, roles/vinculaciones, claves, índices, RLS y auditoría.
3. `20261113131000_gym_secure_functions.sql`: API SQL privilegiada y guardas de integridad.
4. `20261113140000_gym_booking.sql`: reservas concurrentes, disponibilidad y restricciones.
5. `20261113150000_shared_attendance_qr.sql`: QR compartido de 15 segundos, límites SQL e ingreso manual auditado.

Las migraciones nuevas no cambian valores de perfiles preexistentes ni eliminan tablas. No se ha aplicado nada a producción. El detalle del modelo, relaciones, permisos, bootstrap administrativo y API está en `../docs/database-model.md`.

- `fixtures/local.sql`: datos sintéticos con guardas; solo runner local, nunca seed automático o producción.
- `tests/profiles.test.sql`: prueba pgTAP original, utilizable en Supabase local con pgTAP.
- `../tests/database/policies.mjs`: suite ejecutable de RLS, permisos, integridad, QR y concurrencia en PostgreSQL real aislado.
- `config.toml`: registro público/anónimo deshabilitado, sin seed automático.
- `templates/`: correos de recuperación e invitación de la etapa Auth.

Los tipos se generan con la herramienta oficial de Supabase, después de migrar el motor de prueba. Preparación y comandos: `../tools/database/README.md`. Configuración de autenticación real: `../docs/authentication.md`.


La migración `20261113140000_gym_booking.sql` activa las reglas del módulo de reservas: apertura predeterminada a 24 horas, cancelación idempotente, agregado seguro de ocupación y bloqueos de acceso. Aplicarla en el entorno elegido antes de desplegar la interfaz correspondiente. La suite local actual ejecuta 217 comprobaciones y compara tipos generados. Ver [módulo de reservas](../docs/reservations.md).

El nuevo flujo de QR sustituye la API preliminar personal sin borrar su historia. Ver [asistencia: controles, cambios de compatibilidad y despliegue](../docs/attendance.md). Las tablas de desafíos compartidos y límites están en esquema privado, sin acceso de clientes.

Migraciones de constancia: `20261113160000_points_and_absences.sql`, `20261113161000_points_transactions.sql` y `20261113162000_absence_review.sql`. Se aplican después de las cinco previas. Añaden libro inmutable, bonos, reversiones, casos, justificaciones y calendario verificado, sin backfill ni recompensas. Ver [reglas y operación](../docs/consistency.md).


Lista de espera y notificaciones: `20261113170000_waitlist_notifications.sql` y `20261113171000_waitlist_booking_runtime.sql`. Añaden ofertas transaccionales, retenciones de cupo, bandeja propia y mantenimiento privado. Habilitar pg_cron y ejecutar `operations/enable_waitlist_jobs.sql` según [despliegue y límites](../docs/waitlist-notifications.md). No hay secretos ni endpoint HTTP de mantenimiento. Las migraciones conservan las reglas de reserva.

Biblioteca/administración: `20261113180000_wellness_library.sql` y `20261113181000_administrative_queries.sql`. Crean categorías, contenidos, manifiestos, bucket privado, consultas de indicadores y auditoría e invitaciones idempotentes. Ver [requisitos de Storage, seguridad y activación](../docs/library-administration.md). No se crean contenidos de prueba ni se modifica un bucket preexistente.
