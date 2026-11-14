# Validación previa al despliegue — 13 de noviembre de 2026

La evidencia vigente de esta auditoría se encuentra en el [informe con severidades](audit-2026-11-13.md) y el [checklist de despliegue](deployment.md). Validación del proyecto: 30 unitarias, ESLint, tipos y build aprobados. PostgreSQL aislado: 220 checks y tipos generados coincidentes; trece migraciones, con las doce originales intactas. Standalone productivo: siete comprobaciones aprobadas. Navegador: 102 casos privados y ocho públicos aprobados en escritorio/móvil emulado.

Ahora existe `.env.local` y se comprobó Supabase Cloud en modo de solo lectura: Auth respondió, el registro público sigue habilitado y los contratos de tabla/RPC requeridos no están disponibles. No se hicieron pruebas autenticadas alojadas ni cambios remotos. Las menciones de ausencia de entorno/nube en secciones anteriores describen su momento histórico.

---

# Validación anterior: biblioteca y administración — 13 de noviembre de 2026

- `npm.cmd run validate`: ESLint sin advertencias, TypeScript estricto, **27 pruebas unitarias y build de producción aprobados** sobre el código final.
- `npm.cmd run test:e2e`: **seis regresiones públicas aprobadas**, escritorio y móvil, en `test-results/public-administration/`.
- SQL: **217 comprobaciones aprobadas** en PostgreSQL 17.11 aislado: 112 de políticas/regresión, 19 de reservas, 19 de QR, 26 de constancia, 23 de espera y 18 de biblioteca/administración. Doce migraciones, tipos generados por Supabase coincidentes y hashes registrados en `database-validation.json`. Las diez migraciones anteriores permanecen intactas.
- Biblioteca/administración SQL: publicación con autorización, archivos pendientes/listos, tamaño/MIME, cuenta/vinculación, independencia de habilitación de gimnasio, aislamiento frente a políticas ajenas, otros buckets, lectura autenticada exclusiva sin listado/firma, archivo, concurrencia de revisión, indicadores, invitaciones idempotentes, perfiles nuevos inactivos y exportaciones auditadas.
- Navegador: **12 casos nuevos aprobados**, en escritorio y móvil, con SDK real contra doble HTTP aislado. Catálogo/filtros, detalle, rangos privados, errores/vacíos, autorización, carga/publicación/archivo, usuarios/roles/habilitación, invitación sintética, indicadores filtrados, CSV, auditoría, cancelación administrativa y configuración. Capturas y axe, incluidos recorridos a 320 px, sin desbordamiento de página ni infracciones automáticas en los estados examinados.
- La regresión completa de 100 recorridos aprobó 99 y detectó un POST nativo de login con `Origin: null` antes de la hidratación. Se corrigió `Referrer-Policy` de las páginas a `same-origin`, sin ampliar orígenes permitidos. El callback conserva `no-referrer`. Los dos recorridos de espera afectados pasaron tras el cambio.
- Dos pruebas de navegador adicionales aprobadas en `test-results/native-origin/`: POST nativo del formulario SSR, origen interno conservado, login/logout y rechazo explícito de `Origin: null` y de origen externo. La aplicación completa conserva el streaming e interactividad de Next.js; este ensayo aísla únicamente el formulario nativo.
- Se añadió una comprobación de edición concurrente durante refresh: la revisión del borrador abierto permanece estable y la base rechaza la sobrescritura. Los dos recorridos de publicación/archivo pasaron con esta comprobación añadida. Evidencia final focalizada en `test-results/final-security/` (cuatro recorridos aprobados; la primera prueba sin JavaScript completo no podía mostrar el formulario por el streaming de React y se reemplazó por una prueba aislada del formulario SSR).

Los datos de pruebas no se importan en la aplicación. Los contratos mínimos de Auth/Storage del clúster SQL y el doble HTTP de navegador no son los servicios gestionados. No hay `.env.local` ni Supabase alojado configurado; no se aplicaron migraciones remotas, no se modificaron datos de producción y no se enviaron invitaciones reales. Ver [activación, métricas, seguridad y límites](library-administration.md). Las secciones siguientes conservan evidencia histórica.

---

# Validación anterior: lista de espera y notificaciones — 13 de noviembre de 2026

- `npm.cmd run validate`: ESLint sin advertencias, TypeScript estricto, **22 pruebas unitarias y build de producción aprobados**.
- `npm.cmd run test:db`: **199 comprobaciones** en PostgreSQL 17.11 aislado: 112 de políticas/regresión, 19 de reservas, 19 de QR, 26 de constancia y **23 de lista de espera/notificaciones**. Diez migraciones y tipos generados por Supabase coincidentes. Las ocho migraciones anteriores permanecen intactas; hashes en `database-validation.json`.
- Espera: FIFO/posición, duplicados, ventana, habilitación, retención, respuesta ajena, rechazo/salida, vencimiento con y sin job, reasignación, aceptación simultánea, aceptación frente a reserva directa y aceptación frente a rechazo. También se probaron pausa, reducción de capacidad frente a ofertas, trazabilidad, RLS, lectura propia e idempotencia de avisos/recordatorios.
- Navegador: se ejecutó la suite privada de **88 casos**. La primera regresión aprobó 84 y detectó la pérdida del mensaje de cupo agotado y dos esperas prematuras de navegación/foco; se corrigieron. La ejecución final de **18 recorridos afectados/nuevos** en Chrome de escritorio y móvil aprobó, incluida la disponibilidad administrativa con cupos ofrecidos. Los otros recorridos conservaron su resultado de la regresión completa.
- El cliente Realtime se verifica con SDK real y protocolo Phoenix local, esperando la conexión de la nueva página antes de enviar el evento. El aviso y el cupo aparecen sin recarga manual. Se conserva recuperación por consulta periódica.
- `npm.cmd run test:e2e`: **seis regresiones públicas aprobadas**.
- Capturas revisadas de ofertas, bandeja, estados vacíos y configuración en escritorio/móvil; sin desbordamiento en 320, 768, 1024 y el tamaño original. axe-core sin infracciones automáticas en los estados examinados. No equivale a certificación de accesibilidad ni a pruebas en teléfonos físicos.

Evidencia final de navegador: `test-results/verified/`; resultados SQL en `.database-tests/*-results.json`. `test-results/integration/` conserva la primera regresión, con fallos ya corregidos; `final/` y `realtime/` contienen ejecuciones intermedias. Las ejecuciones focalizadas reemplazan los artefactos de su propia carpeta.

Las reglas se probaron con PostgreSQL real y Auth mínimo; la interfaz usa SDKs reales contra dobles HTTP/WebSocket aislados. No hay `.env.local`, proyecto Supabase alojado ni proceso pg_cron en este entorno. Se ejecutó el mantenimiento SQL y se verificaron sus permisos y la publicación; **la ejecución temporizada de Cron y la entrega Realtime alojada se deben verificar al activar el entorno**. No se aplicó SQL a producción ni se enviaron mensajes externos. Los avisos son internos y los recordatorios están inicialmente desactivados.

Ver [seguridad, configuración, archivos y activación](waitlist-notifications.md). Las secciones siguientes conservan resultados históricos y no describen los conteos actuales.

---

# Validación actual: QR, puntos y constancia — 13 de noviembre de 2026

- `npm.cmd run validate`: ESLint sin advertencias, TypeScript estricto, 20 pruebas unitarias y build de producción aprobados.
- `npm.cmd run test:db`: **176 comprobaciones** en PostgreSQL 17.11 aislado: 112 de políticas/regresión, 19 de reservas, 19 de QR y 26 de puntos/inasistencias. Tipos generados oficialmente y comparados con las ocho migraciones. Hashes actuales en `database-validation.json`.
- `npm.cmd run test:auth`: **80 casos aprobados** en Chrome de escritorio y móvil emulado: 32 Auth, 20 dashboards, 8 reservas, 12 QR y 8 constancia. La repetición de los ocho casos de constancia también pasó tras ajustar su indicador visual y comprobar 320, 768, 1024 y 1440 px.
- QR: válido/expirado/manipulado, reserva ausente/cancelada, duplicados, permisos, límites, baja del emisor, ingreso manual auditado y lectura de imágenes/video sintéticos con cierre de pistas.
- Puntos: +10, bonos 8/12 sin sumarse, reversión, compensación idempotente, máximo dos cancelaciones, meses de Colombia, concurrencia del bono y revisión simultánea con cancelación.
- Inasistencias: evidencia previa, casos pendientes, justificaciones, advertencia/3/5/revisión, calendario explícito, revocación y recálculo, periodo mensual y móvil, RLS e inmutabilidad.
- Verificación final de integración: doce recorridos de constancia, dashboard y reserva/cancelación, después de propagar la etiqueta de asistencia invalidada y probar el formulario de invalidación. Evidencia separada en `test-results/integration/`.
- `npm.cmd run test:e2e`: seis regresiones públicas aprobadas.
- Capturas de escritorio y móvil revisadas; axe-core sin infracciones automáticas en los estados examinados. Las pruebas no equivalen a una certificación integral de accesibilidad ni a cámaras físicas Android/iOS.

El aplicativo no importa datos sintéticos. Las pruebas web usan SDKs reales con un doble HTTP aislado; las reglas se prueban con PostgreSQL real y un contrato mínimo de Auth. No hay `.env.local` ni proyecto Supabase alojado configurado. No se aplicó SQL a producción ni se enviaron correos. El recorrido contra Supabase alojado y cámaras físicas bajo HTTPS queda para la validación del entorno de despliegue. No hay recompensas/canjes.

Evidencia local: `test-results/auth/`, `test-results/integration/`, `test-results/home/` y `.database-tests/*-results.json`/`results.json`. Cada ejecución focalizada reemplaza los artefactos de su carpeta. Las secciones siguientes conservan resultados históricos de etapas anteriores; su alcance y conteos no describen el estado actual.

Ver [seguridad de QR](attendance.md) y [reglas, archivos y límites de constancia](consistency.md).

---

# Validación del módulo de reservas — 13 de noviembre de 2026

- `npm.cmd run validate`: ESLint sin advertencias, TypeScript estricto, 16 pruebas unitarias y build de producción aprobados.
- `npm.cmd run test:db`: 141 comprobaciones SQL aprobadas en PostgreSQL 17.11 real: 122 de regresión y 19 de reservas. Los tipos generados por Supabase coinciden con las cuatro migraciones versionadas. Hashes actualizados en `database-validation.json`.
- Se verificaron las ocho reglas de prueba solicitadas: reservar, falta de habilitación, duplicado, franja llena, dos personas disputando el último cupo, cancelación/liberación, fuera de ventana y suspensión activa. Además, se comprobaron dos cancelaciones simultáneas, idempotencia sin doble auditoría, borde de apertura a 24 horas, pausa, restricciones futuras/expiradas y ACL/RLS.
- Casos privados verificados en Chrome: 32 de Auth, 20 de dashboards y ocho de reservas/horarios. La repetición final del módulo, `npm.cmd run test:auth -- reservations.spec.ts`, aprobó los ocho casos en escritorio y móvil emulado.
- Verificación final de integración: doce recorridos de constancia, dashboard y reserva/cancelación, después de propagar la etiqueta de asistencia invalidada y probar el formulario de invalidación. Evidencia separada en `test-results/integration/`.
- `npm.cmd run test:e2e`: seis regresiones públicas aprobadas.
- Capturas de confirmación, reserva activa y administración revisadas en escritorio y móvil. Sin desbordamiento entre 320 y 1440 px en los tamaños comprobados. axe-core no detectó infracciones automáticas en el diálogo y los formularios administrativos examinados.
- La escritura se realiza exclusivamente mediante RPC autorizadas y sesión propia; no se añadieron dependencias ni claves privilegiadas.

Evidencia local actual: `test-results/auth/` para reservas/horarios y `test-results/home/` para portada. Cada ejecución focalizada reemplaza los artefactos de su carpeta. Los resultados SQL se conservan en `.database-tests/results.json` y `booking-results.json`; el runner cerró su clúster al finalizar.

No existe `.env.local` ni un proyecto Supabase alojado configurado en este entorno. Las reglas se probaron con PostgreSQL real y el contrato mínimo de `auth.uid()`; los recorridos web usan SDKs reales contra un doble HTTP aislado. Falta verificar el recorrido alojado tras aplicar migraciones y configurar variables/cuentas. No se modificó producción ni se implementaron puntos, QR o sanciones. La auditoría automática no equivale a certificación integral de accesibilidad.

Ver [reglas, archivos e instalación del módulo](reservations.md).

---

# Validación de interfaces — 13 de noviembre de 2026

- `npm.cmd run validate`: ESLint, TypeScript estricto, 13 pruebas unitarias y build de producción aprobados, sin credenciales Supabase.
- Autenticación: los 32 casos existentes aprobaron en escritorio y móvil durante la suite privada.
- `npm.cmd run test:auth -- dashboard.spec.ts`: repetición final de los 20 casos de dashboards aprobada después de corregir esperas y selectores del menú en las pruebas. Incluye usuario con datos, vacío, administrador, restricciones para usuario/staff, acceso sin sesión, fallo de permisos/consultas, calendario, destinos, teclado y navegación móvil.
- `npm.cmd run test:e2e`: seis casos públicos aprobados tras separar los layouts.
- Responsive: 320, 375, 768, 1024 y 1440 px, además de sidebar en 1024 × 768, menú móvil y preferencia de movimiento reducido. No hubo desbordamiento horizontal en los tamaños comprobados.
- axe-core no detectó infracciones automáticas en los dashboards personal/administrativo y estados vacío/error comprobados. Se conservaron y revisaron capturas de escritorio y móvil emulado en Chrome. No constituye certificación integral de accesibilidad ni prueba en dispositivos físicos.
- Evidencia: `test-results/auth/` para dashboards y `test-results/home/` para portada. La última ejecución privada focalizada reemplaza los artefactos anteriores de esa carpeta.
- No se instalaron dependencias ni se alteraron migraciones. No se repitió la suite SQL porque esta etapa solo añade consultas/interfaz y no modifica políticas ni funciones SQL.

Las consultas de producción están conectadas al cliente SSR y al esquema tipado real. Este entorno no tiene `.env.local` ni proyecto Supabase alojado configurado: los datos visibles en las pruebas proceden exclusivamente del doble HTTP aislado; nunca se importan desde la aplicación ni se utilizan como fallback. Queda pendiente comprobar la integración alojada con las variables públicas, migraciones y cuentas autorizadas. No se enviaron correos ni se modificaron datos remotos.

Las mutaciones de reservas, gestión de usuarios/horarios, registro/QR, puntos y biblioteca permanecen pendientes y se indican en la interfaz. Ver [archivos, rutas y significado de los indicadores](dashboards.md).

---

# Validación del modelo de datos

En la etapa PostgreSQL se aplicaron la migración original y las dos nuevas a PostgreSQL 17.11 aislado. Pasaron **122 comprobaciones** de RLS, ACL, integridad, auditoría, ciclo QR y concurrencia. Se verificaron 21 solicitudes para 20 cupos, duplicación simultánea de una reserva y doble consumo simultáneo de QR. Los perfiles preexistentes conservaron su estado.

Los tipos fueron generados con `@supabase/typegen` 0.4.0 desde el esquema migrado y comparados de nuevo con el archivo versionado. Las herramientas viven en `tools/database` con lockfile separado y sin dependencias nuevas de producción. Los hashes de migraciones/tipos y el alcance de esta comprobación se conservan en `database-validation.json`.

El runner ejecuta PostgreSQL real con roles SQL. Usa un contrato mínimo de Auth para `auth.uid()`; no verifica firmas JWT, correo ni un proyecto Supabase alojado. El pgTAP original no se ejecutó, porque ese clúster portátil no incluye su extensión; la suite nativa cubre permisos y políticas del modelo completo. No se aplicaron migraciones a producción. Detalles y comandos en `database-model.md`.

---

# Validación de ACTIVANT — autenticación

Entorno: Windows, Node.js 24.14.0, npm 11.9.0 y Google Chrome local para Playwright.

## Comprobaciones

- `npm.cmd run validate`: ESLint sin advertencias del código, TypeScript estricto, once pruebas unitarias y compilación de producción sin credenciales de Supabase.
- `npm.cmd run test:auth`: 32 ejecuciones (16 escenarios por escritorio/móvil) usando SDKs reales y un doble HTTP de Supabase aislado. Login válido/inválido, cookies y persistencia, logout, perfiles inactivos/ausentes, fallo de datos, acceso sin sesión, refresh, revocación, cookie manipulada, recuperación, contraseña, enlace consumido, invitación inactiva, PKCE y accesibilidad.
- `npm.cmd run test:e2e`: seis comprobaciones de regresión de portada, navegación por teclado, página 404, responsive y axe-core.
- Sin desbordamiento horizontal entre 320 y 1440 px en los tamaños comprobados.
- Capturas de login revisadas en escritorio 1440 px y móvil 390 px. Evidencia local en `test-results/`, excluida de Git. Cada suite conserva sus siguientes resultados en `test-results/auth/` o `test-results/home/`.
- `supabase/config.toml` analizado como TOML; registro público/anónimo deshabilitado en la configuración local.
- Inspección del código de producción: no hay signup, claves secretas, `service_role`, NextAuth/Auth.js o autorización basada en `getSession()`.

## Límites de verificación

En la etapa de autenticación no se disponía de un proyecto Supabase real ni SMTP. No se enviaron correos ni se comprobó login contra Auth real. En la etapa de datos sí se aplicaron todas las migraciones a PostgreSQL portátil aislado y se verificó RLS, como se indica arriba; las aserciones pgTAP anteriores siguen sin ejecutarse como pgTAP. Los tests HTTP verifican la integración de la aplicación, sin certificar la conducta del proveedor o RLS. Los pasos para esa comprobación están en `authentication.md`.

Antes de operar hay que aplicar la migración al destino correcto, deshabilitar signup en el proyecto alojado, configurar URL y plantillas de correo, y crear/invitar y activar la cuenta administrativamente. La configuración local no cambia un proyecto remoto.

La auditoría automática de accesibilidad y la revisión visual no equivalen a una certificación completa. La identidad gráfica continúa siendo provisional.

## Dependencias

No se agregaron dependencias de producción. La etapa Auth no agregó dependencias; las herramientas de esta etapa de datos tienen un paquete y lockfile separados. Se conserva el resultado previo de la auditoría: sin avisos en producción y siete avisos moderados en herramientas de desarrollo, asociados a `minimatch`/`typescript-eslint`. ESLint 9 está fijado por compatibilidad de pares de los plugins actuales, aunque npm lo marca sin soporte. No se forzaron actualizaciones transitivas de versión mayor. Revisar estas herramientas en una actualización independiente.

## Entorno Windows

Se usa `npm.cmd` para evitar modificar las políticas de PowerShell. Playwright se ejecutó fuera del sandbox con autorización para permitir que Windows cerrara el árbol de procesos de los servidores. Las pruebas finalizaron y cerraron sus servidores.
