# Pruebas

- `npm.cmd test`: runner nativo de Node.js 24. Entorno, rechazo de claves secretas, validaciones de formularios, origen canónico, callback y mensajes seguros.
- `npm.cmd run test:e2e`: portada, teclado, responsive, 404 y axe-core.
- `npm.cmd run test:auth`: 16 escenarios en escritorio y móvil contra un doble HTTP de Supabase aislado (32 ejecuciones). Usa los SDKs reales y Server Actions; verifica login/logout, persistencia, perfiles inactivos/ausentes, fallo de datos, renovación/revocación, cookie manipulada, recuperación, contraseña, invitación y callback PKCE.
- `supabase test db`: diez aserciones pgTAP en una base local con la migración aplicada. Pendiente de ejecutar en este entorno.

Para navegador, instalar Chromium con `npx.cmd playwright install chromium` o reutilizar Google Chrome mediante `$env:PLAYWRIGHT_CHROME = "1"` en PowerShell. Ejecutar las suites secuencialmente, sin un servidor normal usando el puerto 3000. Auth también necesita el puerto 54322 y rechaza reutilizar servidores existentes.

`tests/fixtures/supabase-mock.mjs` contiene identidades/contraseñas/tokens sintéticos, se enlaza solo a loopback y nunca se importa desde código de producción. No sustituye una verificación de Supabase Auth real, correo o políticas SQL. No se requieren secretos ni se usa una cuenta administrativa real para la suite.

Capturas en `test-results/`, excluidas de Git. axe-core complementa revisión manual y no certifica por sí solo cumplimiento integral de accesibilidad. Para la verificación de un proyecto real, seguir `docs/authentication.md`.


## Modelo PostgreSQL

Instalar herramientas con `npm.cmd ci --prefix tools/database` y ejecutar `npm.cmd run test:db`. Se aplican las ocho migraciones a PostgreSQL 17 aislado y se comprueban 176 casos de RLS, permisos, integridad, auditoría y concurrencia. Incluye 21 solicitudes para 20 cupos y ingreso duplicado con un QR compartido. También se compara la salida del generador oficial de Supabase con los tipos versionados.

El contrato mínimo de Auth se prepara exclusivamente para pruebas SQL; no prueba firma JWT o correo. Los fixtures `.invalid` están fuera de migraciones y seed automático. No usa una conexión remota ni datos reales. Detalle en `../docs/database-model.md`.

La suite privada incluye `attendance.spec.ts`: escaneo de QR real desde foto/video sintético, rotación, ingreso manual, permisos y errores. PostgreSQL añade `attendance.mjs`, con 19 casos de seguridad. Ver [asistencia y límites de las pruebas](../docs/attendance.md).

Puntos y constancia: `tests/database/program.mjs` añade 26 casos SQL, incluidos bonos/reversiones, concurrencia, meses Bogotá, evidencia y calendario; `program.spec.ts` agrega recorridos de usuario/admin y `program.test.ts` valida entradas. Ver [reglas y límites](../docs/consistency.md).
