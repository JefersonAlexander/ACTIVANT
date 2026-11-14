# Despliegue y operación de ACTIVANT

Estado: preparación local; no se publicó el aplicativo ni se aplicaron migraciones remotas. Leer también el [informe de auditoría](audit-2026-11-13.md). La clave publicable permite conectar el cliente, pero no aplicar SQL ni configurar Auth.

## Entornos y variables

Node.js 24; dependencias fijadas en los dos `package-lock.json`. Desarrollo utiliza `.env.local`, ignorado por Git. Existen plantillas `.env.development.example`, `.env.test.example` y `.env.production.example`. No sobrescribir un archivo local ya configurado. Next.js no carga automáticamente un archivo llamado `.env.test.example`: es una plantilla para configurar el entorno del proceso o del proveedor.

| Variable | Uso | Exposición |
| --- | --- | --- |
| `APP_ENV` | `development`, `test` o `production`; definir en build y ejecución | Servidor |
| `APP_URL` | Origen canónico sin ruta; HTTPS en producción | Servidor, enlaces de Auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Origen del proyecto correcto; HTTPS remoto | Pública, fijada al compilar |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave `sb_publishable_` del mismo proyecto | Pública, acceso limitado por RLS |
| `SUPABASE_SECRET_KEY` | Opcional `sb_secret_`, solo para invitaciones mediante Auth Admin | Secreto de servidor; nunca build arg ni `NEXT_PUBLIC_*` |
| `ACTIVANT_ENV_FILE` | Archivo alternativo para el preflight Cloud | Herramienta de pruebas |
| `PLAYWRIGHT_CHROME` | `1` usa Chrome instalado; omitir para Chromium | Herramienta de pruebas |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | Solo sesión del operador/CLI, si se necesitan | Gestor de secretos; fuera del aplicativo |

Separar los proyectos de pruebas y producción. Si solo existe un proyecto Free, utilizarlo primero con cuentas sintéticas y sin datos institucionales; antes del uso real separar la validación que escribe datos. No restaurar copias de funcionarios en el entorno de pruebas.

```powershell
npm.cmd ci
npm.cmd ci --prefix tools/database
npm.cmd run check:env
npm.cmd run dev
```

`check:env` comprueba formato y perfiles; no certifica claves válidas, SMTP, migraciones o RLS remoto. `.evn.local` es un nombre incorrecto; el archivo válido es `.env.local`. Ambos patrones quedan excluidos de Git, Docker y trazado standalone. Revisar por separado el historial si un secreto alguna vez fue publicado y rotarlo; ignorarlo después no lo elimina del historial.

## Preparar Supabase Cloud

1. Confirmar en Dashboard el proyecto de destino. En la comprobación real de esta auditoría, Auth respondió pero faltaron los contratos `profiles` y `get_my_point_summary`. No asumir que el esquema está instalado.
2. Instalar la CLI oficial por un método soportado y registrar su versión. No se instaló durante la auditoría. Los comandos siguientes usan la sintaxis actual `--remote`; consultar `supabase db push --help` si la CLI instalada es anterior. La documentación actual de CLI advierte cambios respecto a los antiguos selectores de destino. [Referencia CLI](https://supabase.com/docs/reference/cli/supabase-db-push).
3. Con credenciales del operador fuera del código, vincular y revisar las trece migraciones. No ejecutar fixtures, bootstrap de pruebas o `db reset` contra la nube.

```powershell
supabase login
supabase link --project-ref <referencia-del-proyecto-de-pruebas>
supabase migration list --remote
supabase db push --remote --dry-run
# Solo después de revisar el destino y las migraciones pendientes:
supabase db push --remote
```

Conservar el historial de migraciones. No pegar las trece migraciones manualmente y después volver a aplicarlas con la CLI. Ante objetos existentes, detenerse y comparar el esquema; no borrar tablas ni reparar el historial a ciegas. Las doce migraciones originales conservan sus hashes; la decimotercera corrige el recálculo de suspensiones. La separación por entornos y las migraciones versionadas siguen el [flujo oficial de Supabase](https://supabase.com/docs/guides/deployment/managing-environments).

4. Revisar Security Advisor, esquemas expuestos y permisos. Exponer la API necesaria de `public`; mantener `activant_private` fuera de PostgREST. Verificar RLS en todas las tablas públicas, sin escritura directa de reservas, asistencias, roles, habilitaciones o puntos desde el navegador. Revisar también políticas preexistentes ajenas a ACTIVANT.
5. La biblioteca exige `storage.allow_only_operation(text)`; la migración falla de forma cerrada si Storage no tiene el contrato requerido. Mantener privado el bucket creado por la migración; no sustituir por un bucket público ni permitir listado/firma indiscriminados. Ajustar el tamaño máximo del archivo al límite efectivo del plan, aunque el aplicativo permita un tamaño mayor.
6. Habilitar `pg_cron` y ejecutar como propietario [enable_waitlist_jobs.sql](../supabase/operations/enable_waitlist_jobs.sql). Verificar ejecuciones `succeeded`, sin duplicar jobs, y publicación Realtime de `notifications`, `waitlist_offers`, `gym_availability_signals`. Comprobar entrega con dos sesiones reales; el mantenimiento local no prueba el planificador alojado.
7. Regenerar tipos del esquema real si difiere y revisar el resultado. No reemplazar a mano tipos generados para ocultar errores de migración.

## Configurar Auth y cuentas

- Desactivar **Allow new users to sign up** en Authentication. La auditoría real encontró el registro habilitado: debe corregirse antes de abrir el servicio. `supabase/config.toml` no modifica ese ajuste en Cloud.
- Desactivar acceso anónimo y proveedores no utilizados. Mantener Supabase Auth como único proveedor.
- Site URL igual a `APP_URL`. Redirect URLs exactas del callback HTTPS de cada entorno aprobado; evitar comodines productivos. Instalar las plantillas [recovery.html](../supabase/templates/recovery.html) e [invite.html](../supabase/templates/invite.html).
- Establecer contraseña mínima de 12 caracteres y revisar duración de JWT/sesión, límites de Auth y protección frente a automatización. No elevar `allowedOrigins` ni aceptar `Origin: null` para resolver un proxy mal configurado.
- Configurar SMTP autorizado y comprobar recuperación e invitaciones con cuentas sintéticas. El remitente predeterminado está restringido a destinatarios del equipo del proyecto y no debe asumirse como correo institucional operativo. [Documentación SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- Crear o invitar cuentas por Dashboard o Auth Admin autorizado. Perfiles nuevos permanecen inactivos. La activación, vinculación, rol y habilitación de gimnasio son decisiones separadas. No inferir permisos de metadata editable.
- Para el primer administrador, un operador verifica el UUID en `auth.users`, activa su perfil y establece el rol `admin` en `user_roles` mediante una sesión SQL de confianza. Registrar la autorización y comprobar la auditoría del bootstrap. Las RPC administrativas impiden que un administrador se promueva o cambie su propia habilitación. Ver [modelo de permisos](database-model.md).
- Los cierres de sesión revocan refresh tokens; un JWT emitido puede conservar vigencia hasta expirar. No confundir logout con revocación instantánea de todos los accesos directos a la API. Ver [semántica de signout](https://supabase.com/docs/guides/auth/signout).

## Validar y compilar

Ejecutar secuencialmente, con puertos 3000, 3001 y 54322 libres. No mezclar Next dev con build: comparten `.next`.

```powershell
npm.cmd run validate
npm.cmd run test:db
npm.cmd audit --omit=dev --audit-level=high
$env:PLAYWRIGHT_CHROME = '1' # Solo si Chrome está instalado
npm.cmd run test:e2e
npm.cmd run test:auth
npm.cmd run test:cloud:readonly
```

Las pruebas SQL crean un PostgreSQL aislado y nunca usan `.env.local`. La suite privada de navegador fuerza claves y URL sintéticas; no constituye integración completa con Cloud. El preflight Cloud es de solo lectura y devuelve código 1 ante fallos y 2 ante comprobaciones bloqueadas. No publicar su evidencia como si demostrara login, SMTP, Storage o transacciones alojadas.

En el proveedor configurar las variables del entorno final **antes de compilar**, además de suministrarlas al proceso de ejecución. `NEXT_PUBLIC_*` y las cabeceras configuradas en `next.config.ts` se resuelven en build: un artefacto compilado para desarrollo no se convierte en producción cambiando solo variables de ejecución. HSTS exige `APP_ENV=production` durante build. Reconstruir al cambiar proyecto Supabase, origen o perfil.

```powershell
# En una sesión con las variables de producción suministradas por el gestor:
npm.cmd run check:env
npm.cmd run build
```

La salida es `standalone`. Copiar `.next/static` a `.next/standalone/.next/static` y `public` a `.next/standalone/public`, y arrancar `node .next/standalone/server.js` con las variables de ejecución. El [Dockerfile](../Dockerfile) realiza ese ensamblaje, ejecuta con usuario sin privilegios y recibe únicamente URL/clave publicables y origen como argumentos de build. El secreto opcional se inyecta solo en ejecución. Docker no estuvo disponible y su imagen no fue construida ni ejecutada en esta auditoría.

El smoke reproducible `node tools/deployment/smoke-production.mjs` requiere previamente un build `APP_ENV=production` con URL HTTPS y clave **sintéticas**; usa puerto 3001, ensambla los estáticos locales y fuerza variables sintéticas en el proceso hijo. No usar un build productivo con datos privados para pruebas. El ensayo usa HTTP loopback y no valida el certificado TLS, el proxy externo o la imagen Docker.

Publicar detrás de HTTPS con hostname canónico, forwarding de host/protocolo confiable, reloj sincronizado y sin caché compartida de páginas privadas, callbacks o archivos privados. Preservar `Set-Cookie`, `Cache-Control`, `Referrer-Policy` y cabeceras de seguridad. La cámara móvil necesita un contexto seguro y permiso explícito. Validar invitaciones, recovery y cookies `Secure` desde el dominio final. Para varias réplicas revisar consistencia de claves de Server Actions y despliegues coordinados según las guías de self-hosting de Next.js instalado.

## Copias de seguridad y restauración

En Free no asumir disponibilidad de PITR o restauración administrada. Supabase recomienda exportaciones periódicas fuera del proyecto para ese plan. El backup SQL no incluye los bytes de Storage. [Alcance oficial de backups](https://supabase.com/docs/guides/platform/backups).

Asignar un responsable y aprobar periodicidad/retención antes de uso institucional. Propuesta inicial, pendiente de aprobación y medición: RPO 24 horas y RTO 4 horas. No son garantías. Guardar cifrados los dumps, historial, manifiestos y archivos en una ubicación distinta, con acceso mínimo, comprobación de integridad y alertas ante fallos. No ubicarlos en el repositorio, `public`, artefactos CI públicos o un bucket accesible al usuario.

En una sesión de operador vinculada al proyecto correcto, con CLI y Docker requeridos por `db dump`, exportar esquema, datos y roles por separado a una ruta de backup segura. No pasar contraseñas en argumentos ni imprimirlas; usar entrada interactiva o el gestor de secretos del job.

```powershell
supabase db dump --remote --role-only --file <ruta-segura>/roles.sql
supabase db dump --remote --file <ruta-segura>/schema.sql
supabase db dump --remote --data-only --use-copy --file <ruta-segura>/data.sql
supabase db dump --remote --schema supabase_migrations --file <ruta-segura>/history-schema.sql
supabase db dump --remote --schema supabase_migrations --data-only --use-copy --file <ruta-segura>/history-data.sql
```

El dump predeterminado de esquema excluye esquemas gestionados y no incluye datos. Verificar explícitamente que la exportación de datos preserva las identidades Auth y metadatos necesarios para las FK, y que el procedimiento restaura triggers/políticas personalizados en Auth/Storage. Guardar además configuración Auth/SMTP, políticas, extensiones, publicaciones y configuración del hosting sin volcar secretos en documentos. Seguir las consideraciones de [backup/restore e historial](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) y comprobar las opciones de la CLI utilizada. No afirmar que esos comandos aislados constituyen una copia completa.

Respaldar por separado los objetos privados de Storage mediante un proceso administrativo autorizado, con manifiesto de bucket/ruta/tamaño/hash y cifrado. Verificar correspondencia con los metadatos SQL. Las claves para ese proceso viven en el gestor de secretos, nunca en el frontend.

Ensayar restauración en un **nuevo proyecto aislado**, primero con datos sintéticos: detener escritores, revisar roles y privilegios predeterminados del destino, restaurar esquema/datos/historial según compatibilidad de versiones, restaurar objetos y configuración, verificar triggers, RLS/ACL, identidad, reservas/puntos y jobs. No ejecutar ciegamente dumps de roles gestionados ni desactivar restricciones en producción. Medir recuperación y conservar evidencia. No se ejecutaron exportaciones ni restauraciones remotas durante esta auditoría.

## Errores, alertas y recuperación

`src/instrumentation.ts` integra `onRequestError` de Next.js y registra únicamente evento, patrón de ruta, categoría, digest numérico y hora UTC. El hook no registra mensaje/stack, query, cookies, identidad, payload o argumentos RPC. El error raíz ofrece una respuesta genérica en español. Esto no elimina automáticamente registros propios de Next.js, proxy, CDN o Supabase: configurar también su redacción y acceso. Excluir query del callback, Authorization, apikey, contraseñas, tokens QR, cuerpos de formularios y archivos de las trazas. Definir retención institucional y acceso a auditorías/CSV.

Supervisar errores 5xx, latencia, fallos Auth, limitación de intentos QR, ejecuciones Cron atrasadas/fallidas, ofertas pendientes, conexiones/egreso/Storage, divergencias de capacidad y backups fallidos. Los avisos internos no sustituyen alertas de operación. En Free verificar cuotas y disponibilidad real antes de comprometer niveles de servicio; esta auditoría no incluyó pruebas de carga ni validación contractual.

Ante una versión defectuosa, conservar evidencia sin PII y volver al artefacto anterior compatible. No revertir migraciones borrando tablas, reservas, auditoría o ledger: usar una corrección SQL aditiva revisada. Ante pérdida de base, detener escrituras y restaurar en nuevo destino verificado antes de redirigir tráfico. Ante credenciales comprometidas, rotar en el proveedor, revocar sesiones, evaluar vigencia de JWT y reconstruir si cambian variables públicas. Revisar jobs y políticas antes de reabrir reservas. Registrar responsables, tiempos y decisión de reapertura.

## Checklist de liberación

- [x] Validaciones locales, RLS, concurrencia e idempotencia ejecutadas; evidencia en el informe.
- [x] Corrección SQL aditiva y regresiones de sanciones.
- [x] Plantillas de entorno, validación, cabeceras, logs mínimos y artefacto standalone.
- [ ] Proyecto Cloud de pruebas aislado y trece migraciones aplicadas/revisadas.
- [ ] Registro público y anónimo deshabilitados; Auth/SMTP/callbacks configurados.
- [ ] Cuentas sintéticas user, staff, admin e inactiva; sin datos de funcionarios.
- [ ] Login, refresh/revocación, recovery, invitación y denegaciones probados con Auth real.
- [ ] RLS/ACL y Storage privado comprobados directamente contra Cloud, incluidos accesos ajenos y anónimos.
- [ ] Último cupo concurrente, duplicados, QR vencido/manipulado e idempotencia ensayados en ese proyecto.
- [ ] Cron temporizado y entrega Realtime real comprobados; recordatorios según regla aprobada.
- [ ] Calendario laboral verificado y reglas institucionales aprobadas; sin recompensas activadas.
- [ ] Build del entorno final y HTTPS/proxy/cookies comprobados; cámara en teléfonos físicos.
- [ ] Capacidad bajo carga, revisión manual de accesibilidad y restricciones Free aceptadas.
- [ ] Backups completos cifrados, alertas y restauración ensayados; RPO/RTO medidos.
- [ ] Tratamiento/retención de datos, custodios, logs y riesgos residuales aprobados.
- [ ] Imagen Docker y pipeline CI ejecutados si son el mecanismo elegido.
- [ ] Repetir preflight Cloud y cerrar hallazgos altos antes de introducir datos reales.
