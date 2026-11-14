# Biblioteca y administración

## Rutas y alcance

`/biblioteca` consulta contenidos publicados, permite filtrar por categoría/título y pagina de doce en doce. `/biblioteca/[id]` presenta descripción, duración, portada y video privado o enlace HTTPS autorizado. Una cuenta activa con vinculación activa puede leer; no necesita habilitación para el gimnasio. Las tres vinculaciones iniciales están incluidas y el diccionario admite otras categorías autorizadas. Los administradores pueden previsualizar borradores y archivos.

`/admin/usuarios` permite buscar cuentas de Supabase Auth, activar/desactivar perfiles, asignar vinculación, otorgar/retirar `admin` o `gym_staff` y configurar la vigencia de habilitación. Se reutilizan las RPC existentes: ningún formulario escribe tablas directamente. El rol base `user` se conserva y los cambios al propio acceso requieren otro administrador. Las cuentas y los correos no se publican a otros usuarios.

`/admin/horarios` mantiene franjas y capacidades. `/admin/reservas` añade consulta filtrada y cancelación mediante la RPC existente, con los mismos bloqueos y restricciones. `/control-asistencia` conserva QR, ingreso manual y conciliación para personal autorizado. `/admin/constancia` conserva revisión de evidencia, compensaciones y calendario. `/admin/configuracion` reúne los formularios existentes de reservas, espera, recordatorios y versiones mensuales de constancia.

`/admin/contenidos` crea borradores, carga portada/video, publica y archiva. Publicar exige autorización expresa, portada lista y exactamente un video o enlace. Las ediciones usan revisión optimista; dos editores no sobrescriben silenciosamente el mismo cambio. El formulario conserva su revisión al recibir actualizaciones automáticas y solo la avanza después de su propio guardado; una edición ajena exige actualizar antes de reintentar. Archivar conserva auditoría y archivos, pero revoca nuevas lecturas de usuarios cuando el archivo ya no pertenece a otro contenido publicado. No se crean contenidos institucionales de ejemplo ni se habilitan recompensas.

## Esquema y migraciones

Aplicar en orden las migraciones existentes y las nuevas `20261113180000_wellness_library.sql` y `20261113181000_administrative_queries.sql` mediante el procedimiento de despliegue del proyecto. No se ejecutaron contra una base remota y las diez migraciones anteriores se conservaron. Los tipos de `src/lib/supabase/database.types.ts` proceden del generador oficial de Supabase sobre PostgreSQL migrado.

- `wellness_categories`: cinco categorías editoriales, sin contenido operativo.
- `wellness_contents`: datos editoriales, referencias de archivos, publicación, autorización con actor/hora, revisión y claves foráneas restrictivas.
- `wellness_assets`: manifiestos de archivo pendientes/listos, tipo, MIME, tamaño, ruta UUID y creador. Un contenido no puede vincular un manifiesto pendiente ni confundir portada/video.
- `admin_invitation_requests`: solicitudes idempotentes con actor, correo y resultado de Auth. Su lectura está limitada a administradores.
- `audit_logs`: registra mutaciones administrativas y solicitudes de exportación. La vista/exportación de auditoría selecciona únicamente metadatos; no devuelve los JSON antiguos/nuevos que pueden contener motivos privados.

Las tablas nuevas tienen RLS y solo SELECT para `authenticated`; las mutaciones ocurren en funciones con `search_path` vacío y comprobación de rol real y perfil activo. Los clientes usan la clave publicable y la sesión del usuario para SQL y Storage.

## Storage privado

Se crea el bucket **privado** `activant-wellness`. La migración se detiene si ya existe, para evitar alterar un bucket desconocido, o si falta `storage.allow_only_operation(text)`. Verificar/actualizar la versión de Storage antes de aplicar; no reemplazar funciones internas para eludir esta comprobación.

La carga sigue: preparar manifiesto en servidor → subir con SDK y sesión de administrador (`upsert: false`) → comprobar tamaño/MIME en metadatos reales de Storage → marcar listo → vincular/publicar. Portadas JPG/PNG/WebP hasta 5 MB; videos MP4/WebM hasta 100 MB y el límite del plan/proyecto. No se transmiten archivos grandes por Server Actions. No se permiten SVG, sobreescrituras o borrados desde el navegador. Los manifiestos/cargas interrumpidos permanecen sin publicar para revisión del operador; no hay borrado automático.

La lectura usa `/biblioteca/archivos/[id]`, que verifica identidad con `getUser()`, acceso al manifiesto mediante RLS y reenvía la sesión a **GET autenticado de Storage**. El acceso se comprueba de nuevo en Storage. No genera URLs firmadas, públicas o tokens propios. Soporta rangos para video y responde con caché privada desactivada, `nosniff` y política de origen. `getSession()` solo obtiene el token que se reenvía después de verificar identidad; no autoriza por sí mismo.

Las políticas de Storage limitan SELECT a la operación `storage.object.get_authenticated`; listar y firmar no conceden acceso. Políticas restrictivas aíslan el nuevo bucket frente a políticas permisivas ajenas, sin cambiar el comportamiento de otros buckets. No se altera el esquema administrado de Storage. Referencias oficiales consultadas: [control de acceso](https://supabase.com/docs/guides/storage/security/access-control), [buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals) y [operaciones de Storage](https://supabase.com/docs/guides/storage/schema/helper-functions).

Límites: un usuario autorizado puede copiar material ya descargado; archivar no retira copias ni detiene bytes ya transmitidos. La autorización editorial, derechos, calidad y subtítulos de videos deben verificarse antes de publicar. MIME/tamaño no equivalen a análisis antivirus ni inspección del contenido binario. Los enlaces externos requieren revisión expresa; la privacidad y disponibilidad del proveedor externo no pueden ser impuestas por RLS de ACTIVANT. Para material privado institucional usar Storage privado o un proveedor con su propio acceso autenticado.

## Invitaciones administrativas opcionales

Para completar el alta administrativa se añadió invitación exclusiva de administradores, mediante [Supabase Auth Admin](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), manteniendo Supabase como única identidad y sin registro público. Es opcional: `SUPABASE_SECRET_KEY=sb_secret_…` **solo en el servidor**, del mismo proyecto. Nunca usar `NEXT_PUBLIC_` ni enviar esa clave a React. El cliente privilegiado está aislado en `services/invitations.ts` y solo invoca Auth; no se usa para SQL o archivos. Sin esta variable el formulario queda deshabilitado y las cuentas pueden invitarse desde Supabase.

Configurar `APP_URL`, redirect permitido, plantilla de invitación y SMTP según `authentication.md`. La invitación inicia con UUID idempotente y bloqueo por correo/actor: máximo veinte solicitudes por hora por administrador y diez minutos entre solicitudes del mismo correo. Un reintento de la misma solicitud no reenvía. Resultado pendiente/incierto bloquea nuevas solicitudes para ese correo; el operador debe conciliarlo con los registros de Auth/SMTP antes de cualquier recuperación manual auditada. No se interpreta una respuesta como prueba de entrega del correo. Las identidades nuevas nacen con perfil inactivo y rol `user`; activar, verificar vinculación y conceder permisos son operaciones separadas. Los controles de Auth/SMTP del proyecto siguen aplicando.

## Indicadores y CSV

`/admin/reportes`: fechas inclusivas en `America/Bogota`, de uno a 93 días; franja opcional. El rango se refiere al **inicio de la franja**, no a la fecha de creación de la reserva. No se incluyen correos, diagnósticos ni justificaciones en indicadores o CSV generales.

| Indicador | Definición |
| --- | --- |
| Ocupación por franja | Reservas confirmadas / capacidad × 100; ofertas pendientes se muestran aparte |
| Aprovechamiento | Asistencias efectivas / capacidad de franjas finalizadas y no canceladas × 100; sin denominador se muestra no disponible |
| Asistencia efectiva | Existe asistencia y no existe invalidación |
| Inasistencias | Casos revisados con estado injustificado; no se infieren de la ausencia de una marcación |
| Por revisar | Caso pendiente o con solicitud de revisión registrada |
| Cancelaciones | Reservas canceladas de las franjas seleccionadas |
| Demanda por horario | Usuarios distintos por franja entre reservas y espera; no duplica al pasar de espera a reserva; incluye interés posteriormente cancelado |
| Recurrentes | Usuarios con al menos dos asistencias efectivas en el rango |
| Evolución | Asistencias y personas distintas por día con franjas registradas |

La vista devuelve hasta 2.000 franjas y muestra el total. Los agregados cubren todo el rango. La exportación de franjas rechaza resultados truncados y solicita reducir el rango. La participación diaria conserva todos los días registrados del rango; no inventa actividad donde no hay franjas.

`/admin/auditoria` filtra por **fecha de operación**, con franja opcional que relaciona franjas, reservas y asistencias. Pagina treinta operaciones. CSV admite hasta 5.000, sin truncar silenciosamente. Exportar comprueba permiso en servidor, valida filtros, consulta datos y registra solicitud con actor/filtros antes de responder. El registro prueba la solicitud autorizada, no que el archivo se haya guardado en el equipo. GET no permite elegir tablas/columnas arbitrarias.

CSV UTF-8 con BOM y CRLF; todas las celdas entre comillas, comillas internas escapadas y fórmulas neutralizadas incluso tras espacios/caracteres de control. Las descargas y respuestas privadas no usan caché compartida. Un CSV descargado queda bajo custodia del administrador.

## Validación y activación

`npm.cmd run validate`, `npm.cmd run test:db` y `npm.cmd run test:auth`. La suite SQL crea un PostgreSQL nuevo en loopback, aplica doce migraciones y verifica también permisos de Storage, aislamiento, archivo/publicación, conflicto de revisión, indicadores, invitaciones, exportación y auditoría. El contrato mínimo de Auth/Storage en `tests/database/bootstrap.sql` existe exclusivamente en ese clúster y no sustituye los servicios gestionados.

Playwright utiliza SDK real y un doble HTTP local con datos sintéticos para comprobar páginas, cargas, autorizaciones, CSV y estados. Incluye escritorio, celular y 320 px, axe y capturas. No envía correos reales. No hay proyecto Supabase remoto configurado en este entorno: antes de producción verificar subida/lectura/rangos/listado/firma y revocación de archivos contra Storage real, entrega de invitación/SMTP, límites de subida del plan y migraciones en staging. No se modificaron datos de producción.
