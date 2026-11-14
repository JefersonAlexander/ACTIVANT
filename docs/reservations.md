# Reservas del gimnasio

La extensión actual incorpora [lista de espera y notificaciones](waitlist-notifications.md): la disponibilidad descuenta ofertas temporales y conserva por separado la ocupación confirmada. Las validaciones principales de reserva de esta guía permanecen vigentes.

## Alcance y uso

El módulo permite reservar y cancelar desde `/gimnasio`, consultar cupos por fecha y revisar todas las reservas en `/historial?pagina=1`. `/admin/horarios` permite publicar franjas, cambiar capacidad/estado y configurar las reservas con una cuenta `admin` activa. Se reutilizan Supabase Auth, las guardas de servidor, los tokens visuales y las primitivas de shadcn/ui.

No incorpora puntos, lectura QR ni un sistema de sanciones. `gym_access_restrictions` representa únicamente intervalos administrativos de bloqueo de acceso, necesarios para respetar una suspensión o restricción al reservar. No calcula sanciones, no guarda motivos clínicos y no altera automáticamente reservas anteriores.

## Configuración y migración

Aplicar **en un entorno de prueba elegido explícitamente** las migraciones pendientes, incluida `supabase/migrations/20261113140000_gym_booking.sql`, antes de habilitar las pantallas. Se conserva el contenido de las tres migraciones anteriores y no se eliminan tablas ni filas. Esta entrega solo aplicó el esquema en clústeres nuevos de prueba; no modificó un proyecto alojado ni producción.

Completar `.env.local` desde `.env.example` con URL, clave publicable y `APP_URL`; no usar claves privilegiadas. Iniciar con `npm.cmd run dev`. Las cuentas deben haber sido creadas/invitadas y habilitadas según [autenticación](authentication.md).

| Configuración | Valor inicial | Administración |
| --- | --- | --- |
| `app_settings.default_slot_capacity` | 20 | Capacidad predeterminada para nuevas franjas; no reescribe las existentes. |
| `gym_slots.capacity` | 20 o el valor al crear | Capacidad propia de cada franja; siempre positiva y nunca inferior a reservas confirmadas. |
| `app_settings.booking_window_hours` | 24 | Anticipación de apertura; admite entre 1 y 168 horas. |
| `app_settings.reservations_enabled` | `true` | Pausa nuevas reservas; mantiene consulta y cancelación de las existentes. |

Las fechas del formulario administrativo son hora de Colombia. Zod valida fechas, orden inicio/fin, UUID, operaciones y enteros; el servidor convierte a UTC antes de llamar las funciones. La base de datos vuelve a aplicar permisos, capacidad, integridad y horarios. Una franja con historia no cambia de horas. Los horarios no se solapan; antes de cancelar una franja se gestionan las reservas/lista de espera existentes.

## Autoridad transaccional

`reserve_gym_slot(p_slot_id uuid)` obtiene la identidad de `auth.uid()`, sin aceptar un identificador de usuario. Su trigger bloquea en orden perfil/categoría/habilitación, configuración y franja. Después del bloqueo exclusivo de la franja vuelve a comprobar condiciones, duplicado y conteo confirmado. La inserción y cualquier actualización asociada se confirman en una sola transacción. Las escrituras exigen READ COMMITTED; con un aislamiento no admitido fallan antes de alterar cupos.

El índice único parcial impide dos reservas confirmadas para la misma persona/franja. Los demás escritores de capacidad y cancelación comparten el bloqueo de la franja. Dos solicitudes que esperan por el último cupo no pueden confirmar ambas: la segunda evaluación ve la primera transacción ya confirmada.

`activant_private.booking_denial` concentra las condiciones compartidas por reserva y disponibilidad: perfil/categoría activos, habilitación actual que cubra toda la franja, ausencia de restricciones, reservas habilitadas, franja abierta/no iniciada, ventana de apertura y capacidad. La apertura incluye el instante `inicio - horas_configuradas` y excluye `inicio`.

Una restricción no revocada impide reservar si está vigente ahora **o** si se cruza con la franja completa. Los intervalos son `[inicio, fin)`: al llegar a su fin deja de bloquear. Las restricciones expiradas o revocadas no bloquean. Los escritores administrativos de restricciones bloquean el perfil en modo exclusivo, coordinándose con la reserva para evitar inserciones concurrentes que pasen inadvertidas.

`cancel_gym_reservation(p_reservation_id uuid)` comprueba titularidad o rol `admin` activo, bloquea franja y reserva y cambia únicamente una reserva confirmada. Repetir una cancelación autorizada devuelve éxito sin cambiar su fecha ni generar un segundo cambio de auditoría. Para el titular, debe ser antes del inicio y sin asistencia registrada. La habilitación de gimnasio puede haber vencido: no se exige para liberar un cupo propio. Se conserva la invalidación preexistente de desafíos, sin agregar interfaz o flujo QR.

## RLS y disponibilidad

Las tablas conservan SELECT sujeto a RLS y ningún permiso de escritura directa para `authenticated`. La nueva tabla de restricciones habilita RLS, permite lectura propia o administrativa, y solo se escribe mediante funciones administrativas que registran auditoría. Un usuario no puede editar roles, habilitarse, levantar sus restricciones ni cancelar una reserva ajena.

La nueva función `get_gym_slot_availability(p_start,p_end)` devuelve únicamente horarios, capacidad, ocupados, disponibles, apertura, elegibilidad de la operación, fecha de observación y el UUID de la reserva **del propio actor**, si existe. No devuelve usuarios, lista de asistentes ni reservas ajenas. Exige perfil activo, limita el rango a 32 días y devuelve hasta 500 franjas con total del rango para advertir truncación.

Se usa SECURITY DEFINER para contar reservas privadas sin abrir su lectura directa. El actor se determina dentro de la función; `search_path` es vacío, los objetos están calificados y se revoca ejecución de PUBLIC/anon/service_role. Las funciones internas no son ejecutables por el navegador. Las condiciones se vuelven a evaluar al confirmar; una consulta de ocupación no garantiza un cupo.

Los bloqueos administrativos pueden incorporarse desde una integración de confianza usando una sesión administrativa y las RPC `admin_add_gym_access_restriction(p_user_id,p_starts_at,p_ends_at,p_kind)` y `admin_revoke_gym_access_restriction(p_restriction_id)`. `p_kind` admite `restriction` o `suspension`; un administrador no gestiona su propio bloqueo. No se desarrolla una consola disciplinaria.

## Interfaz y actualizaciones

El calendario muestra cupos ocupados/disponibles y un indicador de ocupación. Cada operación requiere confirmación en un diálogo nativo con título y descripción; la operación indica carga y devuelve mensajes españoles. Una franja completa, futura fuera de ventana, iniciada, pausada o no habilitada muestra su causa y deshabilita Reservar. El servidor sigue siendo la autoridad aunque se manipule el HTML.

Las Server Actions revalidan gimnasio, reservas, dashboard y gestión al terminar una operación, incluidas respuestas de error que requieren recuperar el estado real. No se incrementan ni decrementan contadores optimistamente. Realtime solicita una nueva consulta al recibir señales de franja u ofertas/avisos propios. Se mantiene actualización cada 30 segundos con la página visible y actualización manual. La cancelación libera la reserva inmediatamente y, si hay espera válida, retiene ese cupo mediante una oferta al siguiente usuario.

Ante una respuesta de red incierta se pide actualizar Mis reservas antes de reintentar. Una reserva repetida se rechaza por el índice/validación, y la cancelación repetida es segura. El historial conserva registros cancelados: se muestran diez movimientos por página y hasta 50 activos en el resumen. Los registros activos también se pueden cancelar desde las páginas del historial.

## Archivos principales

- `supabase/migrations/20261113140000_gym_booking.sql`: configuración, restricción temporal, validación compartida, reserva/cancelación y disponibilidad segura.
- `src/lib/supabase/database.types.ts`: generado por la herramienta oficial de Supabase desde PostgreSQL migrado.
- `src/modules/reservations/actions.ts`, `schemas.ts`, `messages.ts`: operaciones de servidor, validación y mensajes públicos.
- `src/modules/reservations/services/queries.ts`: calendario agregado, configuración y reservas propias.
- `src/modules/reservations/components/`: confirmación, ocupación, listado paginado, actualización y formularios administrativos.
- `src/app/(private)/gimnasio/page.tsx`, `historial/page.tsx`, `admin/[section]/page.tsx`: composición de las rutas.
- `src/modules/dashboard/components/gym-calendar.tsx`: calendario reutilizado con datos de ocupación opcionales.
- `src/lib/supabase/read.ts`: contrato pequeño de lectura recuperable compartido.
- `tests/database/bookings.mjs`, `tests/e2e/reservations.spec.ts`, `tests/unit/reservations.test.ts`: reglas y concurrencia, UI y entradas.

## Pruebas y límites

`npm.cmd run test:db` ejecuta PostgreSQL 17.11 real en un clúster nuevo e integra la suite anterior y la suite de reservas. La prueba del último cupo retiene la fila de franja hasta observar las dos solicitudes bloqueadas a la vez y luego las libera; exige exactamente un éxito y un rechazo por lleno. Los fixtures sintéticos están protegidos contra su carga accidental en otra base. El contrato de Auth del runner permite probar roles SQL, pero no verifica firmas JWT.

`npm.cmd run validate` ejecuta ESLint, TypeScript, unitarias y build. `npm.cmd run test:auth` incluye Auth, dashboards y reservas en Chrome escritorio/móvil; la interfaz usa SDK real contra un doble HTTP de prueba, sin importar fixtures desde producción. `npm.cmd run test:e2e` mantiene la regresión pública independiente. Ejecutar las suites de navegador secuencialmente y con el servidor habitual detenido. Capturas/trazas en `test-results/auth/`; resultados SQL en `.database-tests/`.

El entorno no tiene `.env.local` ni proyecto Supabase alojado configurado. La entrega valida las reglas y los bloqueos con PostgreSQL real y la interfaz con fixtures aislados; falta comprobar el recorrido completo contra un proyecto de prueba alojado después de aplicar migraciones y configurar sus variables. No se enviaron correos ni se modificaron datos remotos.

Referencias: guías locales de Next.js 16.4.6 sobre Server Actions/revalidatePath, [bloqueos PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html) y [funciones seguras Supabase](https://supabase.com/docs/guides/database/functions).
