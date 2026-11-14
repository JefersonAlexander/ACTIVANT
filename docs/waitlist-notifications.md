# Lista de espera y notificaciones

## Uso

En `/gimnasio`, una persona activa y habilitada puede unirse cuando los cupos de una franja están ocupados o retenidos por ofertas vigentes. Se conservan la ventana de apertura, las restricciones, el estado de la franja y las demás validaciones del módulo de reservas. No se puede ingresar antes de la apertura ni después del inicio.

La cola sigue `(created_at, id)`, determinado por PostgreSQL. No permite dos solicitudes activas de la misma persona para una franja. La posición incluye las solicitudes anteriores que tienen una oferta pendiente. El usuario solo recibe su posición, sin las identidades de las demás personas.

Al cancelar una reserva se notifica al titular y se ofrece el cupo a la primera persona válida, dentro de la misma transacción. La oferta retiene temporalmente el cupo. No crea una reserva hasta que la persona acepte y se verifique nuevamente su habilitación. `/notificaciones` muestra las solicitudes, el plazo, las opciones Aceptar/Rechazar, la confirmación y el historial de resultados. También se puede salir de la cola.

Rechazar o salir reasigna inmediatamente el cupo. Vencer una oferta finaliza esa solicitud y permite ofrecer al siguiente. Volver a ingresar requiere una nueva solicitud y una nueva posición. Si no hay nadie en espera, el cupo queda disponible para reservar directamente.

Los avisos son **internos y persistentes en ACTIVANT**: confirmación, cancelación, oferta, vencimiento, solicitud no disponible y recordatorio. No se envían correos, SMS ni notificaciones push. Si la persona no abre ACTIVANT, puede perder el plazo; este canal no garantiza que haya visto un aviso. Marcarlo como leído es independiente de aceptar un cupo.

## Configuración

Un administrador activo puede cambiar estos campos desde `/admin/horarios`, panel «Lista de espera y notificaciones»:

| Campo de `app_settings` | Inicial | Rango/efecto |
| --- | --- | --- |
| `waitlist_offer_minutes` | 5 | 1–30 minutos; solo nuevas ofertas. El plazo nunca supera el inicio de la franja. |
| `reservation_reminders_enabled` | `false` | Activa recordatorios internos; no cambia las condiciones de reserva. |
| `reservation_reminder_minutes` | 60 | 5–1440 minutos antes del inicio. Un aviso por reserva, incluso si cambia la anticipación. |

Un recordatorio se genera para reservas confirmadas de cuentas activas, dentro de la anticipación configurada y antes del inicio. Si se activa después de entrar en esa ventana, se genera en la siguiente ejecución. No se envía retrospectivamente para franjas iniciadas. Si una reserva se cancela después de generar un recordatorio, su aviso anterior permanece como historia y aparece el nuevo aviso de cancelación.

## Modelo y controles

- Se reutiliza `waitlist`; no se borra ni sustituye la tabla existente.
- `waitlist_offers` vincula una solicitud, usuario y franja mediante FK compuesta. Cada solicitud recibe como máximo una oferta; almacena creación/vencimiento, estado, respuesta, actor, motivo y reserva resultante. Las ofertas terminadas no pueden reescribirse; los cambios dejan versiones en `audit_logs`.
- `notifications` es una bandeja propia, con clave única de evento. Los reintentos de reserva, cancelación, expiración, recordatorio o respuesta no duplican avisos.
- `gym_availability_signals` solo publica identificador de franja, revisión y hora de cambio. No contiene identidades, reservas ni información personal.
- `activant_private.waitlist_jobs` mantiene las próximas revisiones de las colas. No se expone mediante PostgREST ni se concede acceso al navegador.
- Las tablas públicas nuevas tienen RLS y solo SELECT para `authenticated`. Incluso admin/staff leen únicamente sus propias ofertas y notificaciones; la auditoría administrativa conserva la trazabilidad autorizada. No hay DML arbitrario ni acceso anónimo.
- La identidad procede de `auth.uid()`. Las Server Actions verifican sesión/perfil y validan UUID/operación con Zod; PostgreSQL vuelve a comprobar permisos. No se aceptan usuario, posición, plazo ni hora del cliente como autoridad.

Todas las escrituras de ocupación comparten el bloqueo exclusivo de `gym_slots` en READ COMMITTED. Se conservó `guard_reservation` y se añadió un control de retención: reservas confirmadas más ofertas vigentes nunca superan la capacidad. Una reserva directa no puede tomar un cupo ofrecido ni adelantarse a solicitudes pendientes de asignación. La edición administrativa tampoco puede reducir capacidad por debajo de reservas más ofertas.

Aceptar bloquea perfil/configuración/franja/oferta, verifica nuevamente condiciones y vencimiento con el reloj SQL y crea una reserva ordinaria en la misma transacción. Una FK diferida permite vincular la oferta a su único UUID de reserva antes del INSERT validado. Durante esa transición también se contabiliza el cupo retenido. Una aceptación repetida devuelve la misma reserva; aceptar y rechazar simultáneamente conservan un único desenlace. Los puntos y la asistencia siguen sus propios mecanismos existentes.

El asignador no bloquea perfiles de otras personas mientras retiene la franja: revisa su elegibilidad para ofrecer y la aceptación vuelve a validarla con los bloqueos habituales. Así conserva el orden de bloqueo del módulo de reservas, asistencia y constancia. Una suspensión o baja posterior puede retirar una oferta; nunca garantiza acceso por el solo hecho de haberla recibido.

## Tareas programadas y despliegue

Migraciones nuevas, en orden:

1. `20261113170000_waitlist_notifications.sql`.
2. `20261113171000_waitlist_booking_runtime.sql`.

No reescriben migraciones anteriores ni crean notificaciones retrospectivas. Solo se aplicaron a clústeres descartables locales durante esta entrega. Aplicar las pendientes mediante el procedimiento habitual de migraciones del entorno elegido antes de usar estas pantallas.

El job `activant-waitlist-maintenance` llama directamente `activant_private.run_waitlist_maintenance()` cada minuto mediante `pg_cron`. **No hay endpoint HTTP de mantenimiento ni secretos en el frontend o en el comando del job.** No se concede ejecución a PUBLIC, anon, authenticated ni service_role. El propietario SQL instala y ejecuta el mantenimiento.

Si `pg_cron` ya está habilitado, la migración registra el job. Si falta, emite un aviso y conserva la instalación del modelo. Para completar la activación en Supabase:

1. Habilitar **pg_cron** en el proyecto seleccionado, con permisos de operador.
2. Ejecutar como propietario SQL el contenido de [enable_waitlist_jobs.sql](../supabase/operations/enable_waitlist_jobs.sql). Es idempotente, exige Cron y la publicación Realtime y registra solo este job y estas tablas.
3. Verificar que el job está activo y que aparece una ejecución `succeeded` en `cron.job_run_details`; el script incluye las consultas. Supervisar errores, retrasos y crecimiento de la cola. No basta con comprobar que el job existe.
4. Comprobar en ese entorno una cancelación, entrega del aviso a otra sesión, vencimiento y aceptación antes de habilitar el flujo a usuarios reales.

El trabajo usa un advisory lock para evitar ejecuciones simultáneas, procesa hasta 100 franjas vencidas por pasada y usa `SKIP LOCKED`. Las revisiones quedan pendientes si otra operación retiene una franja. La cola privada ordenada por vencimiento evita que franjas llenas sin trabajo inmediato bloqueen a las demás. Cada asignación revisa hasta 500 solicitudes y vuelve a programarse inmediatamente si queda trabajo asignable; los recordatorios omiten los ya generados.

La aceptación rechaza una oferta vencida aunque el job esté detenido o retrasado. La liberación/reasignación automática normalmente ocurre en la siguiente pasada, hasta aproximadamente un minuto más el retraso de carga/bloqueos. Las mutaciones de la franja también revisan ofertas vencidas. La supervisión de Cron es necesaria para que el procesamiento continúe cuando nadie usa la aplicación.

## Realtime y recuperación

La instalación agrega `notifications`, `waitlist_offers` y `gym_availability_signals` a `supabase_realtime` cuando la publicación existe. No publica `reservations`, `profiles` ni `user_roles`. El SDK del navegador escucha señales agregadas y las ofertas/avisos filtrados por usuario; las políticas SELECT/RLS siguen siendo la autorización real. Al recibir cambios, vuelve a consultar el servidor, con agrupación de eventos y sin interrumpir diálogos abiertos u operaciones marcadas como pendientes; el mensaje WebSocket no confirma reservas.

Se mantiene consulta cada 30 segundos con la pantalla visible y al recuperar foco/visibilidad, para recuperar mensajes perdidos y operar sin WebSocket. Las mutaciones revalidan las rutas y la bandeja. No hay contadores optimistas de capacidad. Deben validarse publicación, permisos de replicación y entrega con sesiones reales en el proyecto de despliegue.

Documentación consultada: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [Supabase Cron](https://supabase.com/docs/guides/cron) y [programación/monitorización de jobs](https://supabase.com/docs/guides/cron/quickstart), además de las guías locales de Server Actions de la versión Next.js instalada.

## Archivos y pruebas

- `src/modules/waitlist/`: contratos, acciones, consultas, UI de ofertas/configuración, acceso a la bandeja y suscripción Realtime.
- `src/app/(private)/notificaciones/page.tsx`: bandeja paginada, estado e historial de espera.
- Resumen administrativo: usa la misma disponibilidad agregada que el calendario para descontar ofertas, sin leer ofertas privadas ajenas.
- Reservas/calendario: botón de ingreso, posición propia y disponibilidad que descuenta retenciones sin confundirlas con reservas confirmadas.
- Layout/navegación/proxy: acceso compartido, contador de avisos y protección de la nueva ruta.
- `src/lib/supabase/database.types.ts`: generado oficialmente desde PostgreSQL migrado, no editado a mano.
- `tests/database/waitlist.mjs`: FIFO, duplicados, ventana, retención, rechazo/salida, expiración, reasignación, carreras, configuración, recordatorios, RLS, auditoría y publicación.
- `tests/e2e/waitlist.spec.ts`: flujo móvil/escritorio, SDK real con protocolo Realtime local, confirmación, cancelación, lectura, rechazo, vencimiento, vacío/error, permisos y configuración.
- `tests/unit/waitlist.test.ts`: entradas, límites y mensajes sin filtración de errores internos.

```powershell
npm.cmd run validate
npm.cmd run test:db
$env:PLAYWRIGHT_CHROME = "1"
npm.cmd run test:auth
npm.cmd run test:e2e
```

Las reglas se prueban con PostgreSQL 17 real, Auth mínimo y cuentas sintéticas. Las carreras retienen la franja hasta observar ambas operaciones bloqueadas, luego verifican el desenlace. Los vencimientos se cargan como fixtures locales; los triggers de inmutabilidad se restauran antes de probar la API. No se falsea la hora de la función de producción.

El PostgreSQL nativo de pruebas no incluye el proceso pg_cron ni el servicio Realtime de Supabase. Se prueban el mantenimiento real, sus permisos, instalación idempotente de la publicación y el cliente contra un protocolo WebSocket local. La ejecución temporizada y entrega alojada requieren la comprobación del entorno descrita arriba. No se modificó producción ni se instaló una dependencia adicional. No se configura una política de borrado de auditoría/notificaciones; su retención debe definirse institucionalmente.
