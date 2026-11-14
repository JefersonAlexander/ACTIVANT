# Migraciones y despliegue automatico

El workflow [quality.yml](../.github/workflows/quality.yml) contiene dos jobs. `local-quality` comprueba el codigo con configuracion sintetica. `production` depende de ese resultado y solo se ejecuta por push o ejecucion manual de `main`, en `JefersonAlexander/ACTIVANT`. Las pull requests no reciben los secretos de publicacion.

La publicacion sigue este orden:

1. Comprobar que existen los seis secretos y que el contexto GitHub es el esperado.
2. Instalar Supabase CLI **3.1.0** y Vercel CLI **65.16.0**. Son herramientas del runner; no se agregan dependencias al aplicativo.
3. Consultar la revision vigente de `main`. Una revision sustituida termina sin publicar.
4. Instalar dependencias del lockfile y obtener las variables **Production** de Vercel.
5. Exigir `APP_ENV=production`, origen HTTPS y coincidencia entre la URL Supabase de Vercel y `SUPABASE_PROJECT_ID`.
6. Compilar ese commit con `vercel build --prod`. Si falla, no se modifica la base.
7. Revisar y aplicar unicamente migraciones pendientes con `supabase db push --remote`; sin fixtures ni semillas. Conservar historial.
8. Consultar sin sesion Auth/settings, `profiles` sin filas y la RPC privada. Exigir registro publico deshabilitado y denegacion anonima de los contratos privados.
9. Verificar otra vez que el commit sigue vigente y publicar el artefacto compilado con `vercel deploy --prebuilt --prod`.

El job de produccion usa un grupo de concurrencia compartido, sin cancelar automaticamente una ejecucion activa. Una version nueva espera; las revisiones sustituidas no vuelven a publicar por llegar tarde. No hay ejecucion de `db reset`, reparacion de historial, borrado de datos o rollback SQL automatico.

## Configuracion necesaria una sola vez

En GitHub, repositorio ACTIVANT → Settings → Secrets and variables → Actions → Repository secrets:

| Nombre exacto | Origen |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Token personal, limitado al proyecto. El enlace CLI requiere Read en Project Settings, API Keys y API Key Secrets. |
| `SUPABASE_PROJECT_ID` | Referencia de 20 caracteres del proyecto Supabase seleccionado. |
| `SUPABASE_DB_PASSWORD` | Contrasena de PostgreSQL del proyecto. La escritura SQL utiliza estos permisos, no los permisos Read del token. |
| `VERCEL_TOKEN` | Token con acceso al equipo que contiene ACTIVANT. |
| `VERCEL_ORG_ID` | Team ID del equipo de Vercel, no su nombre visible. |
| `VERCEL_PROJECT_ID` | Project ID de ACTIVANT, comienza por `prj_`. |

`GITHUB_TOKEN` lo proporciona GitHub automaticamente, con `contents: read`; no hay que crearlo. No guardar secretos en YAML, `.env.example`, mensajes o comentarios del repositorio. GitHub no permite consultar sus valores una vez guardados: corregirlos exige actualizarlos. El preflight informa nombres y formato, no demuestra que las credenciales sean validas hasta conectar.

En Vercel → ACTIVANT → Settings → Environment Variables, alcance **Production**:

```dotenv
APP_ENV=production
APP_URL=https://activant.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://REFERENCIA_DEL_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=CLAVE_PUBLICABLE_DEL_MISMO_PROYECTO
```

Los dos ultimos valores son marcadores que deben reemplazarse. Mantener los secretos de migracion exclusivamente en GitHub. La clave opcional `SUPABASE_SECRET_KEY` de invitaciones es distinta y, si se utiliza, corresponde solo al servidor Vercel. El archivo local `.env.local` conserva su configuracion de desarrollo.

El [vercel.json](../vercel.json) deshabilita el despliegue Git automatico de `main` para que no se adelante al workflow. La CLI publica despues de las migraciones. Las otras ramas conservan su comportamiento Preview y deben usar un proyecto de pruebas. No hace falta desconectar GitHub de Vercel ni crear un Deploy Hook. Revisar que no haya otros workflows/hooks publicando produccion por fuera de este orden. Los Redeploy manuales del Dashboard son operaciones del propietario y pueden omitir estas comprobaciones.

En Supabase → Authentication → [Sign In / Providers](https://supabase.com/dashboard/project/_/auth/providers), apagar **Allow new users to sign up** y el acceso anonimo. Configurar Site URL y callback exactos segun [despliegue](deployment.md). Los cambios de Auth no se aplican con `db push`.

## Primera ejecucion y recuperacion

1. Publicar el workflow y `vercel.json` en `main`. GitHub ejecutara `quality` automaticamente.
2. En GitHub → Actions → quality, comprobar primero `local-quality` y despues `Migraciones y despliegue de produccion`.
3. Si el workflow detecta un secreto ausente, corregirlo sin compartir su valor y ejecutar otra vez desde Actions → quality → Run workflow → main. Si se cambio el codigo, publicar un commit nuevo para probarlo.
4. Si se aplico parte de SQL antes de un fallo, revisar el historial y corregir la causa. La siguiente pasada omite migraciones registradas; no borrar tablas, marcar versiones como aplicadas sin ejecutarlas o utilizar reset para resolverlo.
5. Tras terminar, revisar `profiles` y `user_roles` en Supabase. Crear la primera cuenta mediante Auth, activar su perfil y asignar el primer `admin` desde una sesion administrativa verificada. La publicacion no crea usuarios ni contrasenas predeterminadas.

El resumen del job indica si se publico, si se abandono una revision sustituida o donde fallo. Los logs propios ocultan valores conocidos de secretos, sus representaciones JSON y URL. Los subprocesos npm/build/Vercel no reciben las credenciales de migracion; solo las operaciones CLI Supabase las reciben. No se suben a Actions artefactos de produccion, archivos `.vercel`, variables descargadas, dumps o secretos. Las exclusiones de trazado de Next.js cubren archivos de entorno anidados y `.vercel`.

Si la base se migra pero el despliegue falla, la version anterior del aplicativo sigue publicada. Por ello las migraciones futuras deben ser compatibles con la version anterior mientras dura el despliegue; los cambios incompatibles requieren plan de transicion. La automatizacion no sustituye backups ni su restauracion ensayada.

## Alcance de las verificaciones

Las comprobaciones HTTP de este job son de solo lectura y no prueban un login real, SMTP, camaras fisicas, planificador Cron o entrega Realtime. Continuan los requisitos institucionales del [checklist](deployment.md#checklist-de-liberación). Las pruebas locales de guardas/coordinacion no se presentan como una ejecucion remota real.

Las fuentes tecnicas del flujo son [migraciones CI de Supabase](https://supabase.com/docs/guides/deployment/managing-environments), [permisos de tokens personales](https://supabase.com/docs/guides/platform/personal-access-tokens), [Vercel con GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) y [configuracion de despliegue Git](https://vercel.com/docs/project-configuration/git-configuration).
