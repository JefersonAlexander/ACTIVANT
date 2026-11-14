# Puntos, constancia e inasistencias

El módulo incorpora un libro inmutable de puntos, bonos mensuales, cancelaciones oportunas y revisión de inasistencias. No activa recompensas ni canjes. Reutiliza Supabase Auth, perfiles, roles, reservas, asistencia y restricciones existentes.

## Reglas iniciales acordadas

| Evento | Resultado |
| --- | --- |
| Asistencia validada | +10 puntos |
| 8 asistencias computables en el mes | Bono total +20 |
| 12 asistencias computables en el mes | Bono total +30; sustituye al de 8 |
| Cancelación por su titular con **al menos 60 minutos** | +3; máximo dos cancelaciones premiadas en el mes |
| Primera inasistencia injustificada confirmada | Advertencia |
| Segunda | Suspensión de 3 días hábiles, con calendario verificado |
| Tercera | Suspensión de 5 días hábiles, con calendario verificado |
| Posteriores | Revisión administrativa; no suspensión automática adicional |

Los periodos iniciales de inasistencias son **meses calendario en America/Bogota**, como indicó el usuario. También se puede configurar un periodo móvil en días. Los puntos no se descuentan por inasistencia: no se autorizó una regla de descuento.

Ejemplo del bono: 7 ingresos = 70 puntos; 8 = 100; 11 = 130; 12 = 150. El paso 11 → 12 agrega +10 de asistencia y +10 para completar el bono de 30. No agrega otro bono de 30 encima del de 20.

## Modelo y migraciones

Aplicar en orden todas las migraciones anteriores y estas tres:

- `20261113160000_points_and_absences.sql`: entidades, claves, restricciones, índices, RLS y auditoría.
- `20261113161000_points_transactions.sql`: libro, triggers transaccionales, compensaciones, versiones de reglas y resumen propio.
- `20261113162000_absence_review.sql`: conciliación de cierre, justificaciones, revisión y suspensiones según calendario.

| Entidad | Relación y finalidad |
| --- | --- |
| `point_program_rules` | Versiones inmutables, vigentes desde el primer día de un mes |
| `point_periods` | PK usuario/mes, FK de versión; serializa eventos y conserva las reglas del periodo |
| `point_transactions` | Cada abono, bono, reversión o compensación; FK usuario/mes y referencias opcionales al evento original |
| `attendance_invalidations` | Una invalidación por reserva/asistencia; conserva la evidencia original |
| `gym_slot_closeouts` | Cierre conciliado del personal autorizado con hora y actor |
| `absence_cases` | Una reserva confirmada sin asistencia efectiva después del cierre; usuario, franja, versión, decisión y solicitud de revisión |
| `absence_justifications` | Una solicitud estructurada por caso, solo por su titular |
| `working_calendar` | Fechas futuras verificadas y excepciones institucionales |
| `absence_sanctions` | Historial de advertencias/decisiones y FK a una restricción real cuando corresponde |

Todas las tablas expuestas tienen RLS y SELECT limitado. Usuario: solo sus movimientos, periodos, casos y solicitudes. Admin activo: revisión global. Staff no administra puntos ni decisiones; puede conciliar franjas y consultar invalidaciones operativas. No hay DML directo para clientes, incluidos administradores. Las funciones `security definer` fijan `search_path=''`, califican objetos y verifican permisos internos. Helpers sin EXECUTE de clientes. Claves administrativas y secretos no son necesarios.

## Consistencia transaccional

La asistencia validada dispara el abono en la misma transacción SQL. No se otorgan puntos desde un botón del navegador ni mediante un trabajo que acepte una declaración del usuario. Un fallo revierte tanto la asistencia como sus movimientos, sin estados parcialmente confirmados.

`event_key` es único para asistencia y cancelación. Una reversión referencia un movimiento original mediante `reverses_id` único. Ajustes administrativos requieren UUID de solicitud para idempotencia; reutilizarlo con valores diferentes se rechaza. No se permite ajustar el propio saldo. El importe es entero y puede ser negativo para compensar; no se sobrescribe ningún saldo ni se ocultan saldos negativos.

Los eventos de un usuario/mes bloquean `point_periods` antes de comprobar límites o recalcular bonos. El saldo es siempre `SUM(point_transactions.amount)`. La conciliación compara el bono objetivo con la suma de sus movimientos previos y escribe solo la diferencia. Un contador de revisión produce claves únicas para esos cambios. Dos asistencias simultáneas al alcanzar la meta no duplican el bono.

Invalidar una asistencia conserva el registro original y añade `attendance_invalidations`. Si tenía un abono, añade su reversión exacta y concilia el bono del mismo periodo de forma atómica. Por ejemplo, invalidar el ingreso 12 produce −10 de asistencia y −10 de bono; bajar de 8 a 7 revierte además el bono de 20. Repetir la invalidación no repite movimientos. No se genera automáticamente un caso disciplinario a partir de una invalidación.

Las cancelaciones se premian solo cuando las hace el titular, cumplen el umbral inclusivo de una hora y quedan entre las dos primeras cancelaciones premiadas del mes de **cancelación**. Cancelaciones de terceros por administración, tardías o repetidas no generan puntos. El bloqueo del periodo serializa cancelaciones simultáneas de distintas reservas.

## Configuración y periodos

`point_program_rules` permite configurar importes, metas, límite/anticipación de cancelación, habilitación del programa, periodo de inasistencias, días de suspensión y plazo de conciliación. Las versiones nuevas comienzan en meses futuros y no editan versiones previas. Cada usuario/mes conserva su versión; cambios futuros no recalculan retroactivamente movimientos o decisiones.

El mes se obtiene en PostgreSQL convirtiendo el instante del evento a `America/Bogota` antes de truncar. Asistencia: `checked_in_at`. Cancelación: `cancelled_at`. Inasistencia: inicio de la franja. Un evento cercano a medianoche UTC no se atribuye por error al mes siguiente en Colombia.

El programa comienza al aplicar la nueva migración. No se abonan automáticamente puntos por asistencias ni se generan casos de franjas anteriores a esa puesta en marcha. El resumen distingue **asistencias validadas del mes** de **asistencias computables para el programa**. Las primeras pueden incluir evidencia anterior a la activación; las metas de puntos usan solo las segundas. No se ejecuta backfill ni se alteran datos existentes. Un ajuste administrativo explícito permite una compensación excepcional si corresponde.

## Evidencia, justificación y revisión

1. Termina la franja y pasa el plazo de conciliación configurado, inicialmente **15 minutos**.
2. Staff/admin revisa QR, ingresos manuales e incidencias y declara el cierre conciliado. Si no puede sostener esa declaración, no debe cerrarlo.
3. Se crean únicamente casos pendientes para reservas confirmadas sin asistencia efectiva. Repetir el cierre no duplica casos. No se aplica una sanción al detectar una ausencia técnica.
4. El titular puede presentar una solicitud por imprevisto, desacuerdo con la reserva o problema de acceso. No se solicitan texto libre, diagnósticos ni adjuntos médicos. La solicitud marca el caso para revisión, pero no revoca por sí sola una decisión vigente.
5. Un admin activo, distinto del titular, decide: aceptar justificación presentada, cerrar por evidencia insuficiente o confirmar inasistencia injustificada con declaración explícita de evidencia. SQL vuelve a comprobar reserva, cierre y ausencia de asistencia efectiva. El panel prioriza solicitudes pendientes.
6. Solo las inasistencias confirmadas cuentan para el ordinal. El cálculo ordena por instante de la franja y UUID para resolver empates. Se aplica el periodo configurado al evento.
7. Aceptar una justificación revoca la decisión/restricción correspondiente y recalcula los ordinales posteriores afectados. Se anexan nuevos estados de sanción y se conserva lo revocado. Repetir una decisión no extiende una suspensión ni crea filas duplicadas.

Un caso pendiente o injustificado impide cancelar administrativamente su reserva hasta revisar el caso. Cancelación, cierre y revisión coordinan el bloqueo de perfiles/franja/reserva; una decisión simultánea no puede sancionar una reserva cancelada. Los cierres de varias personas bloquean perfiles y periodos en orden estable.

La restricción de una sanción no se puede revocar por un atajo de la API genérica: debe revisarse el caso para mantener trazabilidad. Las restricciones resultantes usan `gym_access_restrictions`, por lo que reservas y escaneo QR respetan la suspensión mediante sus validaciones existentes.

## Días hábiles

No se infieren festivos nacionales o institucionales. El administrador carga un rango de hasta 93 fechas futuras, revisa las excepciones y confirma la verificación contra el calendario institucional. El formulario propone lunes a viernes y excluye sábados, domingos y todas las fechas adicionales declaradas. Se guardan verificador y hora, con auditoría. Esta versión no incorpora jornadas extraordinarias en sábado/domingo.

La suspensión comienza al confirmar la decisión. Se cuentan **3 o 5 días hábiles completos posteriores a la fecha de decisión en Colombia**; termina a medianoche siguiente al último día contado. Incluye el resto del día de decisión sin contarlo como día completo. No se utiliza el reloj del teléfono.

Todas las fechas recorridas, incluso las no hábiles, deben existir verificadas. Si falta una, el caso queda en `pending_calendar`, sin restricción aplicada. Después de cargar el calendario, el administrador vuelve a revisar el caso para aplicar la decisión; no hay un job oculto de imposición. Cambiar fechas de calendario no modifica silenciosamente restricciones ya emitidas: se conserva el intervalo calculado al decidir. La exactitud del calendario requiere un verificador institucional responsable.

La migración aditiva de auditoría `20261113200000_preserve_sanction_start.sql` conserva una decisión ya aplicada cuando su ordinal, tipo y días no cambian, aunque falte calendario futuro. Si una justificación modifica el ordinal de otra suspensión, el recálculo utiliza el primer inicio efectivo de ese mismo caso: no vuelve a suspender desde hoy a quien ya cumplió. Se mantiene el historial de revocaciones y decisiones; no se corrigen retrospectivamente filas existentes sin revisión.

## Interfaces y archivos

- `/dashboard`: saldo real, asistencias mensuales, progreso y acceso a movimientos/revisiones.
- `/constancia`: libro paginado, bonos, metas, advertencias, restricciones y solicitud de revisión.
- `/admin/constancia`: revisión de evidencia/solicitudes, compensaciones idempotentes, invalidación, calendario y reglas futuras. Solo admin.
- `/control-asistencia`: añade conciliación de franjas finalizadas, sin permitir al staff imponer sanciones.
- Historial de asistencia: distingue registros invalidados y conserva la evidencia original.
- `src/modules/program/`: contratos Zod, Server Actions, consultas y componentes reutilizables.
- `src/config/navigation.ts`, `src/proxy.ts`: rutas privadas y permisos centralizados; se reutilizan las guardas existentes.
- `src/lib/supabase/database.types.ts`: regenerado oficialmente desde el motor migrado, sin edición manual.
- `tests/database/program.mjs`, `tests/e2e/program.spec.ts`, `tests/unit/program.test.ts`: pruebas transaccionales, recorridos y validación de entradas.

Las consultas fallidas se muestran como error; no se convierten en saldo cero, ausencia de movimientos o decisiones inexistentes. Los historiales paginan diez filas. El cierre operativo muestra hasta 30 franjas de los últimos siete días; no es una exportación completa. El panel administrativo no incluye gestión de cuentas ni otros módulos.

## Pruebas y operación

```powershell
npm.cmd ci
npm.cmd ci --prefix tools/database
npm.cmd run test:db
npm.cmd run validate
$env:PLAYWRIGHT_CHROME='1'
npm.cmd run test:auth
npm.cmd run test:e2e
```

Las 26 pruebas nuevas de PostgreSQL incluyen: asistencia real validada → +10, metas 7/8/12, transición +20 → +30, invalidación y descenso de bono, idempotencia, ajustes compensatorios, mes Bogotá/UTC, tres cancelaciones simultáneas con máximo dos premios, cancelaciones tardías/de administrador, evidencia insuficiente, advertencia/3/5/revisión, calendario con excepciones, repetición sin extensión, aceptación y revocación, intento de atajo, dos eventos concurrentes al cruzar ocho con barrera de bloqueo, reglas futuras, revisión y cancelación administrativa simultáneas, reinicio mensual, periodo móvil entre meses, RLS/ACL, inmutabilidad y auditoría.

Los históricos de prueba se cargan únicamente en un clúster nuevo identificado como `activant_dbtest_*`; sus guardas se restauran al terminar. Las comprobaciones de asistencia reales se ejecutan antes, con sus guardas activas. Los datos sintéticos y el doble HTTP están solo en `tests/`, nunca como fallback del aplicativo.

Existe configuración local de Supabase Cloud y se comprobó conectividad Auth de solo lectura. El esquema remoto sigue pendiente: aplicar las migraciones pendientes del conjunto actual de trece en el destino de prueba elegido, verificar sus políticas con cuentas autorizadas y validar el recorrido completo antes de uso institucional. No se alteró producción. La interfaz no sustituye la revisión humana de evidencia ni el procedimiento institucional de notificación/contradicción; este módulo no inventa ese procedimiento ni publica recompensas. No se añadieron dependencias para puntos. Ver el [informe de auditoría](audit-2026-11-13.md).

Referencia técnica consultada: [funciones y privilegios de Supabase](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), y las guías locales de seguridad/Server Actions de Next.js instalado. Ver también [seguridad y límites de asistencia QR](attendance.md).
