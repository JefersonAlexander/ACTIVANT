# Asistencia del gimnasio mediante QR

El personal con perfil activo y rol `gym_staff` o `admin` abre **Control de asistencia → Mostrar QR del gimnasio**. Un usuario con su cuenta activa entra a **Registrar asistencia**, activa la cámara y escanea la pantalla. La confirmación muestra la hora del servidor y actualiza su historial. Los puntos se incorporan por el módulo posterior de [constancia](consistency.md), mediante un trigger de asistencia validada.

## Archivos y rutas

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `supabase/migrations/20261113150000_shared_attendance_qr.sql` | Desafíos compartidos, límites persistentes, validación transaccional y retiro de la API preliminar |
| `src/modules/attendance/contracts.ts` | Protocolo del QR, Zod, motivos manuales y mensajes públicos |
| `src/modules/attendance/actions.ts` | Server Actions, autorización, RPC y generación de imagen PNG |
| `src/modules/attendance/services/queries.ts` | Historial propio, asistencias del día y reservas de la franja actual |
| `src/modules/attendance/components/` | Cámara/foto, pantalla dinámica, historial e ingreso manual |
| `/asistencia` | Escáner e historial del usuario autenticado y activo |
| `/control-asistencia` | Panel operativo, historial diario y registro excepcional; solo personal autorizado |
| `/control-asistencia/qr` | Pantalla del QR; solo personal autorizado |
| `src/config/navigation.ts`, `src/proxy.ts` | Navegación central y renovación de sesión para las nuevas rutas |
| `src/modules/reservations/components/my-reservations.tsx` | Referencia de la reserva para una verificación manual |
| `src/lib/supabase/database.types.ts` | Tipos regenerados por Supabase desde PostgreSQL migrado |

## Controles aplicados

- **Identidad:** `getUser()` y perfil activo en servidor, permisos centralizados y verificación independiente en SQL con `auth.uid()`. El cliente no envía identidad ni fecha de ingreso. No hay claves administrativas en este módulo.
- **Token:** PostgreSQL genera dos UUID v4 independientes, con 244 bits aleatorios. El contenido es `ACTIVANT:GYM:1:<64 caracteres hexadecimales>`, sin URL, identificadores ni información personal. Solo se guarda SHA-256. La imagen se entrega en la respuesta privada de una Server Action; nunca en parámetros de URL, almacenamiento local o cookies del QR. El token no se devuelve en consultas de historial.
- **Caducidad:** máximo **15 segundos**, limitado además al final de la franja. La emisión y la aceptación usan `clock_timestamp()` de PostgreSQL. Un QR cuyo emisor pierde el rol o se desactiva deja de ser válido. Las pantallas pueden emitir desafíos independientes; un desafío sirve a varias personas con reserva, una vez por reserva.
- **Renovación:** la pantalla oculta el código al vencer y pide el siguiente. Usa tiempo monotónico y descuenta conservadoramente el tiempo de solicitud para no prolongar su visualización por latencia. Si la conexión falla, muestra un estado informativo y reintenta; nunca acepta un código por la cuenta regresiva del dispositivo.
- **Reglas:** reserva propia confirmada, franja no cancelada, perfil/vinculación/habilitación vigentes y sin restricción activa. Se exige cobertura de habilitación para la franja completa. La ventana es **inicio inclusivo y final exclusivo** de la franja, sin tolerancia antes o después; no se añadió una ventana no autorizada.
- **Transacción:** bloqueos de perfil, habilitación, franja y reserva coordinados con el módulo de reservas. Tras esperar bloqueos se vuelven a comprobar estado y tiempo. La clave primaria `attendance.reservation_id` impide duplicados, incluso con solicitudes simultáneas. La hora almacenada se establece en un trigger y se comprueba otra vez frente al horario y caducidad.
- **Privilegios mínimos:** no hay INSERT/UPDATE/DELETE de asistencia desde el navegador, ni siquiera para administradores. Las nuevas tablas de hashes y contadores están en `activant_private`, con RLS y sin acceso de clientes. Las funciones privilegiadas fijan `search_path=''` y califican objetos; helpers sin EXECUTE para clientes, RPC nuevas solo para `authenticated` con autorización interna. El historial conserva las políticas propias/personal existentes.
- **Frecuencia:** contadores SQL por identidad y operación, con bloqueo de fila: escaneo **10/minuto y 60/hora**, emisión **8/minuto y 480/hora**, manual **30/minuto y 300/hora**. Son ventanas fijas del reloj SQL. Los rechazos de token, reserva o negocio devuelven resultados y **no deshacen el contador**. El límite se aplica también al llamar directamente las RPC, sin depender de memoria del proceso Next.js. No se guardan tokens fallidos ni direcciones IP.
- **Ingreso manual:** solo `gym_staff`/`admin` activo; requiere UUID de reserva y uno de cuatro motivos: cámara, dispositivo, conectividad o apoyo de accesibilidad. Omite únicamente la lectura QR. Mantiene validaciones de reserva, habilitación, restricciones, horario y duplicados. La auditoría inmutable guarda actor, reserva, motivo y hora. No hay campo libre para diagnósticos.
- **Cámara:** permiso solicitado tras pulsar el botón, preferencia por cámara trasera, procesamiento de imagen local. Las pistas se detienen al confirmar, detener, cambiar de pestaña o desmontar la pantalla. Como alternativa se admite una foto de hasta 8 MB, procesada localmente; el servidor recibe únicamente el token. El código decodificado nunca se navega ni se ejecuta.
- **Sesión y origen:** se reutilizan Supabase SSR, cookies y guardas de sesión existentes. Server Actions mantienen las comprobaciones de origen de Next.js, sin ampliar `allowedOrigins`. Rutas privadas con respuestas sin caché compartida.

## Migración e instalación

Aplicar las migraciones versionadas correspondientes, incluidas las tres de constancia cuando se use ese módulo,, en orden, al entorno Supabase elegido y revisar allí los permisos. Esta entrega solo aplicó SQL a clústeres locales nuevos; no modificó producción ni un proyecto alojado. No cambia datos existentes ni elimina tablas.

La migración conserva `qr_challenges` y las asistencias históricas del flujo preliminar **usuario muestra QR → personal escanea**. Retira EXECUTE de `issue_gym_qr_challenge`, `consume_gym_qr_challenge` y `record_gym_attendance`, para que no permitan rutas alternativas sin los nuevos controles. Nuevos registros QR usan `attendance.display_challenge_id`; los históricos mantienen `qr_challenge_id`. Nuevos registros manuales exigen `manual_reason`. El valor legado `app_settings.qr_ttl_seconds` no configura el nuevo QR compartido: su vigencia es fija de 15 segundos.

Se agregan únicamente `qrcode` (generación PNG en servidor), `qr-scanner` (cámara y decodificación con fallback a worker) y `@types/qrcode` en desarrollo. No hace falta un secreto nuevo en `.env.example`: la entropía y el hash se generan en PostgreSQL. Se conservan las variables existentes de Supabase/Auth.

```powershell
npm.cmd ci
npm.cmd run dev
```

Configurar primero `.env.local` según `.env.example`, aplicar migraciones e invitar/activar cuentas y asignar roles desde el entorno administrativo autorizado. Para probar desde un teléfono real, usar un origen **HTTPS** con certificado válido y permitido para ACTIVANT; `http://<IP-del-PC>:3000` no permite cámara en navegadores habituales. No ampliar orígenes de Server Actions indiscriminadamente.

## Pruebas

```powershell
npm.cmd ci --prefix tools/database
npm.cmd run test:db
npm.cmd run validate
$env:PLAYWRIGHT_CHROME='1'
npm.cmd run test:auth
```

`tests/database/attendance.mjs` verifica QR válido, expirado/manipulado, usuario sin reserva, reserva cancelada, duplicado, ausencia de autorización, cuenta inactiva, habilitación y suspensión, baja del emisor, dos solicitudes concurrentes, auditoría, privacidad y límites durables. Ejecuta PostgreSQL real con un contrato mínimo de Auth, sin proyectos remotos. La regresión sustituye las pruebas positivas de la API retirada por pruebas de denegación; no mantiene ese acceso antiguo para satisfacer pruebas obsoletas.

`tests/e2e/attendance.spec.ts` comprueba rotación, confirmación/historial, errores, permisos, ingreso manual y accesibilidad/responsive en Chrome de escritorio y móvil emulado. Lee imágenes QR reales con el decodificador y un flujo de video sintético; también comprueba denegación de cámara y cierre de pistas. Los SDK de Supabase usan un doble HTTP de pruebas aislado: esas pruebas no certifican Auth/PostgREST alojados. Las pruebas unitarias cubren el protocolo y rechazo de motivos libres.

## Limitaciones operativas

1. **Un QR no prueba presencia física por sí solo.** Durante su breve vigencia una foto o retransmisión podría llegar a otra persona con reserva válida. El rol del personal, el control visual y la supervisión del acceso siguen siendo necesarios. No se implementan geolocalización, reconocimiento facial ni vinculación a dispositivos.
2. **Un token es compartido por diseño**, por lo que no se consume globalmente al primer ingreso. La exclusividad se aplica a cada reserva. Varias pantallas pueden mostrar códigos diferentes, válidos cada uno durante su propio intervalo.
3. Los contadores son por cuenta y ventanas fijas; no sustituyen límites de red/WAF/API gateway frente a tráfico anónimo, ataques distribuidos o denegación de servicio. El límite horario puede requerir esperar al cambio de hora aunque haya pasado un minuto. Un rollback deliberado desde una conexión SQL privilegiada queda fuera del contrato de PostgREST.
4. Configurar observabilidad para **no registrar cuerpos ni argumentos** de las acciones/RPC de QR, contraseñas o imágenes. SHA-256 protege el almacenamiento de la aplicación, pero no elimina copias de logs que un operador configure externamente. La imagen/token son visibles transitoriamente a quien puede ver la pantalla.
5. Planificar una tarea operativa privilegiada de retención: eliminar desafíos expirados **sin referencias de asistencia** y definir conservación de los referenciados/auditorías según la política institucional. No se activa un borrado automático de evidencia ni se programan tareas sobre producción en esta entrega.
6. Se necesita conexión al servidor y reloj de PostgreSQL sincronizado. Una respuesta perdida puede haber registrado el ingreso: consultar el historial antes de reintentar. Los errores desconocidos no exponen SQL, detalles del proveedor ni datos ajenos.
7. Falta validar el recorrido completo contra el Supabase alojado del despliegue y cámaras físicas Android/iOS, especialmente permisos y Safari bajo HTTPS. Las capturas y la emulación móvil no sustituyen esa comprobación ni una certificación integral de accesibilidad.

Documentación consultada: [funciones y privilegios de Supabase](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [generador QR](https://github.com/soldair/node-qrcode), [lector QR y API de cámara](https://github.com/nimiq/qr-scanner), más las guías de Server Actions/data security incluidas con Next.js 16.4.6 instalado.
