# ACTIVANT

**Antes de desplegar:** consultar el [informe de auditoría](docs/audit-2026-11-13.md) y el [procedimiento con checklist](docs/deployment.md). La conexión real con Supabase Auth ya respondió; faltan el esquema remoto y el cierre del registro público. No está aprobado todavía para datos institucionales.

Plataforma de bienestar institucional para la Gobernación de Antioquia. Base Next.js App Router con TypeScript estricto, Tailwind CSS, shadcn/ui, Lucide, Zod y autenticación exclusiva de Supabase Auth. Incluye el modelo PostgreSQL de gimnasio, reservas, asistencia y permisos. Incluye dashboards de usuario y administración, calendario y consultas protegidas por rol. Incluye reservas y cancelaciones transaccionales, cupos agregados e historial, además de configuración de horarios/capacidad. Incluye registro de asistencia con QR dinámico de 15 segundos, escáner móvil e ingreso manual auditado. Incluye libro transaccional de puntos, bonos, constancia y revisión de inasistencias. Incluye lista de espera FIFO con ofertas temporales, notificaciones internas y recordatorios configurables. Incluye biblioteca privada, gestión de usuarios/roles/habilitaciones, contenidos, reglas, reportes CSV y auditoría. No hay recompensas ni canjes habilitados.

## Ejecutar

Node.js 24 LTS o superior y npm.

```powershell
cd C:\Users\Robert\Downloads\ACTIVANT
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

No sobrescribas un `.env.local` existente. En PowerShell se utiliza `npm.cmd` para evitar el bloqueo de `npm.ps1`, sin cambiar políticas del equipo. Abre http://localhost:3000/login.

La portada funciona sin Supabase. Para habilitar autenticación, completa `.env.local` y sigue **[Configuración de autenticación](docs/authentication.md)**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
APP_ENV=development
APP_URL=http://localhost:3000
```

`APP_URL` es el origen canónico del aplicativo y debe usar HTTPS en producción. No colocar claves secretas, `service_role`, contraseñas de base de datos ni tokens administrativos en variables públicas. Reinicia Next.js al cambiar variables; para producción, compila con la configuración pública del entorno correspondiente.

Ejecuta `npm.cmd run check:env` para comprobar el formato sin mostrar valores. `npm.cmd run test:cloud:readonly` consulta únicamente configuración y contratos públicos del proyecto, sin crear usuarios ni registros; un resultado bloqueado no demuestra que la integración completa funcione. El despliegue standalone y las variables por entorno se explican en la guía de despliegue.

Antes de usar cuentas reales debes aplicar las migraciones versionadas, deshabilitar signup en el proyecto Supabase, configurar URL/plantillas/SMTP y crear o invitar la cuenta desde un entorno administrativo. Los perfiles nacen **inactivos** y requieren habilitación expresa. El archivo local `supabase/config.toml` no cambia la configuración remota.

Para la expiración automática de ofertas sin usuarios conectados, habilita `pg_cron` y ejecuta el script operativo indicado en [lista de espera y notificaciones](docs/waitlist-notifications.md). Los avisos son internos; no se envían correos/SMS/push. El plazo inicial de oferta es de cinco minutos, configurable en `/admin/horarios`.

## Modelo de datos y RLS

[Diseño del modelo y relaciones](docs/database-model.md). Las migraciones versionadas extienden perfiles con integridad, RLS, auditoría y funciones SQL controladas. No se aplicaron a producción.

```powershell
npm.cmd ci --prefix tools/database
npm.cmd run test:db
npm.cmd run db:types
```

Las herramientas PostgreSQL y el generador oficial de Supabase viven en un paquete aislado de desarrollo. `test:db` verifica permisos, concurrencia y correspondencia de tipos. Los fixtures son sintéticos, están protegidos y no forman parte de las migraciones. No se crean servicios ni se conecta una base existente. Ver [herramientas de base](tools/database/README.md).

## Rutas

- `/`: portada institucional provisional.
- `/login`: correo y contraseña.
- `/recuperar-contrasena`: solicitud de recuperación sin enumerar cuentas.
- `/auth/callback`: recuperación e invitación por token, o código PKCE verificado.
- `/actualizar-contrasena`: sesión verificada para definir o cambiar contraseña.
- `/dashboard`: resumen personal, habilitación, reserva e historial; identidad y perfil activo obligatorios.
- `/gimnasio`: calendario, cupos, confirmación y cancelación de reservas.
- `/historial`: Mis reservas activas e historial paginado.
- `/notificaciones`: bandeja propia, lista de espera, ofertas temporales y respuestas.
- `/perfil`: información personal.
- `/biblioteca`, `/biblioteca/[id]`: catálogo autorizado y detalle; archivos servidos por una ruta autenticada.
- `/admin`: resumen administrativo; solo rol `admin` activo.
- `/admin/horarios`: publicación/edición de franjas, condiciones, plazo de ofertas y recordatorios.
- `/admin/usuarios`: perfiles, roles, habilitación e invitación opcional por Auth Admin.
- `/admin/reservas`: consulta filtrada y cancelación segura.
- `/admin/contenidos`: borradores, cargas privadas, publicación y archivo.
- `/admin/configuracion`: reglas de reservas, espera y constancia.
- `/admin/reportes`, `/admin/auditoria`: indicadores, trazabilidad y CSV.
- `/constancia`: saldo, progreso, movimientos y revisiones propias.
- `/admin/constancia`: revisión, compensaciones, reglas y calendario; solo `admin`.
- `/asistencia`: escáner QR e historial propio.
- `/control-asistencia`: panel diario e ingreso manual auditado; solo `admin` o `gym_staff`.
- `/control-asistencia/qr`: pantalla de QR renovado cada 15 segundos; solo personal autorizado.
- `/acceso-denegado`: cuenta sin perfil habilitado.

Los formularios tienen validación, carga y mensajes en español. La sesión persiste en cookies mediante `@supabase/ssr`; `src/proxy.ts` la renueva antes de renderizar. La protección real también se ejecuta en el servidor de cada página privada y en las acciones que lo requieren.

## Estructura

```text
src/
  app/                   Layout raíz, grupos (public)/(private), rutas y estados
  modules/
    home/                Portada
    auth/                Acciones, formularios, validación y autorización
    dashboard/           Consultas SSR y componentes de bienestar/gestión
    reservations/        Reservas, cancelación, cupos y horarios administrables
    attendance/          QR compartido, escáner e ingreso manual
    program/             Libro de puntos, constancia y revisión de inasistencias
    waitlist/            Ofertas FIFO, respuestas, bandeja y Realtime
  components/
    ui/                  Primitivas shadcn/ui adaptadas
    shared/              Composiciones reutilizables
    layout/              Marcos público/privado y navegación responsive
  config/                Configuración pública y navegación única por permisos
  lib/supabase/          Clientes SSR, cookies, tipos y renovación
  proxy.ts               Mecanismo de sesión de Next.js 16
supabase/
  migrations/            Modelo institucional/gimnasio, RLS y funciones seguras
  operations/            Activación y verificación de Cron/Realtime sin secretos
  tests/                 Pruebas pgTAP
  templates/             Correos de recuperación e invitación
  config.toml            Configuración local sin registro público
tests/
  unit/                  Validación y casos de seguridad
  e2e/                   Portada, Auth, dashboards, reservas y permisos
  fixtures/              Doble HTTP de Supabase solo para pruebas
docs/                    Arquitectura, autenticación, diseño y validación
```

Alias: `@/* → src/*`. Las dependencias permanecen fijadas en `package.json` y `package-lock.json`. No se agregaron dependencias durante la implementación de Auth ni de los dashboards ni de reservas.

## Validar

```powershell
npm.cmd run validate
```

Ejecuta ESLint, TypeScript, pruebas unitarias y build. Los tests de navegador se ejecutan por separado:

```powershell
# Primera vez, si no vas a reutilizar Chrome instalado:
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run test:auth
```

Con Chrome existente en Windows:

```powershell
$env:PLAYWRIGHT_CHROME = "1"
npm.cmd run test:e2e
npm.cmd run test:auth
```

Ejecutar ambas suites secuencialmente, con el servidor habitual detenido. `test:auth` verifica Auth, dashboards, reservas, asistencia, constancia, espera/notificaciones, biblioteca y administración; usa el SDK real contra un servidor HTTP simulado y credenciales sintéticas: no envía correos ni verifica un proyecto Supabase real. Ver [pruebas y límites](docs/validation.md).

Para producción local:

```powershell
npm.cmd run build
npm.cmd run start
```

## Documentación

- [Autenticación, migración y habilitación administrativa](docs/authentication.md).
- [Modelo PostgreSQL, relaciones y políticas](docs/database-model.md).
- [Reservas: reglas, concurrencia, configuración y pruebas](docs/reservations.md).
- [Lista de espera, notificaciones y activación de tareas automáticas](docs/waitlist-notifications.md).
- [Puntos, constancia, inasistencias y reglas de operación](docs/consistency.md).
- [Asistencia QR: instalación, controles de seguridad y limitaciones](docs/attendance.md).
- [Dashboards: rutas, archivos, consultas y permisos](docs/dashboards.md).
- [Arquitectura](docs/architecture.md).
- [Sistema visual](docs/design-system.md).
- [Validación y limitaciones](docs/validation.md).
- [Migraciones y pruebas SQL](supabase/README.md).

Se siguió `AGENTS.md` y se consultaron las guías incluidas con Next.js instalado. La interfaz conserva un tema verde/blanco/neutro y marca provisional; la versión sigue con `noindex, nofollow` hasta aprobación de publicación.

## Biblioteca y administración

Ver [configuración, seguridad, indicadores y límites](docs/library-administration.md). Las migraciones nuevas crean un bucket privado y exigen una versión de Storage con `storage.allow_only_operation(text)`. Las invitaciones desde la aplicación requieren la variable opcional `SUPABASE_SECRET_KEY`, exclusivamente de servidor. Sin ella, la gestión de perfiles existentes continúa disponible.
