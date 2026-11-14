# Autenticación institucional

## Arquitectura

Supabase Auth es el único proveedor. No hay NextAuth/Auth.js, cuentas propias, hash de contraseñas en la aplicación ni registro público. Los formularios ejecutan Server Actions sin devolver contraseñas, tokens o errores crudos a la interfaz.

- `src/lib/supabase/client.ts`: `createBrowserClient`, persistencia en cookies y renovación automática.
- `src/lib/supabase/server.ts`: `createServerClient` por petición, lectura en Server Components y escritura explícita en acciones/callbacks.
- `src/proxy.ts` y `src/lib/supabase/proxy.ts`: integración de Next.js 16; `getUser()` verifica con Auth y renueva tokens cuando corresponde. Se propagan cookies a petición, respuesta y redirecciones, con las cabeceras de caché de `@supabase/ssr`.
- `src/modules/auth/server.ts` publica las guardas implementadas en `services/access.ts`: identidad, perfil activo y roles comprobados en servidor. Cada página/acción privada debe usar esta capa; proxy y layout no sustituyen ese control.
- `profiles`: relación con `auth.users`, `is_active = false` por defecto, RLS y sin permisos de escritura para clientes. Tener cuenta o modificar `user_metadata` no concede acceso.

Las cookies usan `SameSite=Lax`, alcance `/`, caducidad de almacenamiento de siete días y `Secure` en producción. Se usa el modelo estándar de Supabase SSR: el SDK de navegador puede leer los tokens de sesión, por lo que no se marca `HttpOnly` ni se crea una segunda sesión personalizada. Las claves administrativas, `service_role`, contraseñas de base de datos y tokens de gestión nunca se incorporan al navegador o repositorio. Las contraseñas de los formularios viajan exclusivamente en la solicitud al servidor (HTTPS en producción).

Nunca se autoriza con `getSession().user`. Un refresh token revocado conduce al login. El dashboard revalida el perfil al recargar, navegar o recuperar foco, y cada minuto mientras está visible. Las respuestas privadas y de Auth impiden caché compartida.

## Rutas

| Ruta | Función |
| --- | --- |
| `/login` | Correo/contraseña, redirección a `/dashboard` solo con perfil activo |
| `/recuperar-contrasena` | Solicitud por correo sin enumerar cuentas |
| `/auth/callback` | Verificación de `token_hash` recovery/invite, o canje PKCE con cookie verificadora |
| `/actualizar-contrasena` | Requiere identidad verificada; permite definir contraseña a invitados aún inactivos |
| `/dashboard`, `/gimnasio`, `/historial`, `/biblioteca`, `/perfil` | Sesión y perfil activo |
| `/admin` y descendientes | Perfil activo y rol `admin` en `user_roles` |
| `/constancia` | Perfil activo; puntos y revisiones propios |
| `/admin/constancia` | Perfil activo y rol `admin` |
| `/asistencia` | Perfil activo; escáner e historial propios |
| `/control-asistencia` y `/control-asistencia/qr` | Perfil activo y rol `admin` o `gym_staff` |
| `/acceso-denegado` | Explica la habilitación pendiente y permite salir |

El callback rechaza registro por `token_hash`. PKCE solo funciona con la cookie verificadora del navegador que inició el flujo. Nunca usa `next`, `redirect_to` o `x-forwarded-host` para construir destinos; el éxito siempre lleva a `/actualizar-contrasena` en `APP_URL`. Redirige sin tokens y con `Referrer-Policy: no-referrer`. Supabase controla la vigencia y el uso único del enlace. Revisar el escaneo/reescritura de enlaces del proveedor de correo para evitar su consumo automático. Evitar registrar query strings del callback en infraestructura de producción.

Tras cambiar contraseña, se solicita cierre global a Supabase y se eliminan las cookies locales. Si falla la revocación remota, no se garantiza cerrar otros dispositivos. Los JWT ya emitidos pueden seguir siendo válidos hasta expirar. El cierre normal afecta al dispositivo actual y elimina cookies incluso si falla la conectividad con Auth.

## Habilitar Supabase real

No se ha vinculado ni modificado ningún proyecto remoto. Antes de operar con usuarios:

1. Completar `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `APP_URL`. Esta última debe ser el origen canónico HTTPS en producción, sin rutas ni parámetros. Reiniciar Next.js.
2. Revisar y aplicar `supabase/migrations/20261113120000_create_profiles.sql` al proyecto correcto. Crea perfiles inactivos también para cuentas preexistentes. Si falta la tabla o falla su consulta, se deniega el acceso.
3. En Supabase Dashboard → Authentication, **desactivar “Allow new users to sign up”**. La configuración local ya incluye `auth.enable_signup = false` y `auth.email.enable_signup = false`, pero no modifica un proyecto alojado. Desactivar proveedores externos/anónimos no utilizados; mantener correo/contraseña.
4. En URL Configuration: **Site URL** igual a `APP_URL` y redirect allowlist con `/auth/callback` exacto de cada entorno aprobado. Evitar comodines de dominio en producción.
5. Copiar `supabase/templates/recovery.html` e `invite.html` a las plantillas equivalentes del Dashboard. Usan `.SiteURL`, `.TokenHash` y un tipo fijo. Permiten recuperación en otro navegador y aceptación de invitaciones SSR. Los enlaces PKCE predeterminados requieren el navegador de origen.
6. Configurar SMTP institucional, límites de envío/intentos, política de contraseña (mínimo 12 caracteres) y expiración de sesiones/JWT en Supabase. La política autoritativa debe estar en el proveedor.
7. Crear o invitar usuarios desde **Authentication → Users** o mediante el formulario exclusivo de administradores en `/admin/usuarios`. La integración opcional de Auth Admin exige una clave secreta solo en servidor, registro idempotente y auditoría; ver [biblioteca y administración](library-administration.md).
8. Verificar la identidad y habilitar el perfil y su vinculación desde `/admin/usuarios`, mediante otro administrador activo. Para el primer administrador, usar una sesión SQL de confianza con el UUID real verificado:

```sql
-- Parámetro de una sesión administrativa; nunca aceptar UUID sin autorización.
update public.profiles set is_active = true where id = :auth_user_id;
```

El invitado puede definir contraseña antes de habilitarse, pero no abrir el dashboard. En cuentas creadas con contraseña, confirmar el correo de acuerdo con el proceso institucional o gestionar una invitación.

## Pruebas

- `npm.cmd test`: Zod, origen canónico, callback, mensajes y limpieza selectiva de cookies.
- `npm.cmd run test:auth`: SDKs reales contra un **doble HTTP aislado** en `tests/fixtures/supabase-mock.mjs`, con identidades y claves sintéticas. Verifica Next.js, perfiles, cookies, renovación/revocación, manipulación de cookie, recuperación, invitación, contraseña y accesibilidad en escritorio/móvil. No sustituye una prueba de Supabase Auth real ni de SMTP.
- `supabase test db`: diez aserciones pgTAP sobre una base **local** con las migraciones aplicadas. La prueba pgTAP no se ejecutó. La etapa de datos incorpora una suite con PostgreSQL portátil real que verifica las políticas; ver `database-model.md`.

En Windows, con Chrome instalado:

```powershell
$env:PLAYWRIGHT_CHROME = "1"
npm.cmd run test:auth
```

La suite requiere libres los puertos 3000 y 54322 y no reutiliza servidores reales. No ejecutar el desarrollo normal o una compilación al mismo tiempo: comparten `.next`. Los fixtures nunca se importan desde `src/`.

## Verificación pendiente contra Supabase real

Con una cuenta de pruebas administrada y perfil activo: login, recarga y logout; credenciales incorrectas y perfil inactivo; recuperación nueva y enlace consumido/expirado; invitación y acceso con nueva contraseña; revocación y renovación de sesión. Confirmar que el endpoint directo de registro de Supabase rechaza signups y ejecutar las pruebas RLS antes de introducir datos institucionales.

## Fuentes

- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/reference/javascript/auth-signout
- Guías instaladas de Next.js bajo `node_modules/next/dist/docs/01-app/`: authentication, data-security, server-actions, cookies y proxy.


La matriz de permisos reside en `auth/permissions.ts` y la navegación en `src/config/navigation.ts`. Las consultas del módulo dashboard llaman las guardas del contrato `auth/server.ts` antes de leer datos. El proxy incluye todas estas rutas; renueva la sesión y evita caché compartida. Los detalles de consultas, páginas y estados están en [dashboards](dashboards.md).

## Formularios antes de la hidratación

El proxy utiliza `Referrer-Policy: same-origin` para las páginas, de forma que un POST nativo conserve un origen verificable sin enviar referencias a sitios externos. `no-referrer` convertiría el Origin de esas navegaciones en `null`, lo que Next.js rechaza correctamente. El callback conserva `no-referrer` para proteger el token del enlace. No se amplía `allowedOrigins` ni se acepta `Origin: null`. La prueba de navegador aísla el formulario HTML SSR de la hidratación de React y comprueba su POST nativo, el login/logout y el rechazo de orígenes falsificados; ver el [algoritmo Origin de Fetch](https://fetch.spec.whatwg.org/#append-a-request-origin-header).
