# Clientes Supabase

Ambos clientes usan `@supabase/ssr` y la misma política de cookies. `@supabase/supabase-js` aporta el cliente tipado y las operaciones Auth.

- `client.ts`: renovación automática y observación de cierre/expiración en `SessionGuard`.
- `server.ts`: nueva instancia por petición. `createClient()` es de lectura para Server Components; `createClient({ writable: true })` escribe cookies desde acciones y callback. No hay singleton de servidor.
- `proxy.ts`: verifica con `getUser()`, renueva antes del render y copia cookies a petición/respuesta/redirecciones. Impide caché compartida.
- `database.types.ts`: contrato correspondiente a la migración real. Regenerar con `npm.cmd run db:types` al ampliar el esquema.

Nunca autorizar con `getSession().user` ni devolver tokens desde acciones. SQL y Storage usan exclusivamente sesión y clave publicable. La clave opcional de Auth Admin permanece aislada en `src/modules/administration/services/invitations.ts`, exclusivamente de servidor. La portada sigue sin necesitar Supabase. Configuración, plantillas y límites de verificación en `docs/authentication.md`.
