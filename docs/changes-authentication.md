# Archivos de la etapa de autenticación

La autenticación usa exclusivamente Supabase Auth. No se agregaron dependencias, reservas, horarios o panel administrativo. No se modificó un proyecto remoto ni se aplicaron migraciones a una base real.

## Creados

- `src/proxy.ts`
- `src/lib/supabase/cookie-options.ts`
- `src/lib/supabase/database.types.ts`
- `src/lib/supabase/proxy.ts`
- `src/modules/auth/actions.ts`
- `src/modules/auth/callback.ts`
- `src/modules/auth/config.ts`
- `src/modules/auth/index.ts`
- `src/modules/auth/messages.ts`
- `src/modules/auth/schemas.ts`
- `src/modules/auth/services/access.ts`
- `src/modules/auth/components/auth-shell.tsx`
- `src/modules/auth/components/auth-forms.tsx`
- `src/modules/auth/components/logout-button.tsx`
- `src/modules/auth/components/session-guard.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/app/login/page.tsx`
- `src/app/recuperar-contrasena/page.tsx`
- `src/app/actualizar-contrasena/page.tsx`
- `src/app/acceso-denegado/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/(private)/layout.tsx`
- `src/app/(private)/dashboard/page.tsx`
- `supabase/config.toml`
- `supabase/migrations/20261113120000_create_profiles.sql`
- `supabase/templates/recovery.html`
- `supabase/templates/invite.html`
- `supabase/tests/profiles.test.sql`
- `playwright.auth.config.ts`
- `tests/unit/auth.test.ts`
- `tests/e2e/auth.spec.ts`
- `tests/fixtures/supabase-mock.mjs`
- `docs/authentication.md`
- `docs/changes-authentication.md`

## Modificados

- `.env.example`
- `package.json`
- `playwright.config.ts`
- `src/lib/env.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/README.md`
- `src/components/layout/site-header.tsx`
- `src/components/layout/site-footer.tsx`
- `src/modules/README.md`
- `README.md`
- `docs/architecture.md`
- `docs/design-system.md`
- `docs/validation.md`
- `supabase/README.md`
- `tests/README.md`

## Verificación

Resultados y límites en `validation.md`. Configuración del proyecto Supabase, correos, alta/invitación y habilitación de perfiles en `authentication.md`.
