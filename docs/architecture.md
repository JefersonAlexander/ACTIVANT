# Arquitectura de ACTIVANT

## Alcance

Portada institucional, autenticación exclusiva con Supabase Auth, dashboards personales y administrativos, calendario y vistas de consulta. Identidad, perfil activo y roles se verifican en servidor. La capa PostgreSQL incluye reservas, franjas, asistencia y permisos. Reservas/cancelación y horarios/configuración tienen interfaces funcionales; asistencia QR y registro manual auditado tienen interfaces funcionales. La biblioteca privada y las herramientas de usuarios, contenidos, configuración, reportes y auditoría tienen interfaces funcionales. No se incorporan datos operativos inventados. La portada no consulta Supabase.

## Límites

- `src/app`: composición de módulos, rutas, metadatos y estados. `(public)` y `(private)` comparten el layout raíz, con marcos propios sin cambiar las URLs públicas.
- `src/modules/home`: contenido editorial y presentación de portada.
- `src/modules/auth`: acciones Auth, esquemas Zod, callback, interfaz y autorización. `index.ts` expone UI; `server.ts` publica las guardas `server-only`; `permissions.ts` comparte la matriz de roles sin acceso a datos.
- `src/modules/dashboard`: consultas SSR acotadas y presentación de datos reales; consume el contrato público de Auth.
- `src/modules/reservations`: RPC de reserva/cancelación, disponibilidad agregada segura, historial y configuración de horarios; reutiliza Auth y la presentación del calendario.
- `src/modules/library`: catálogo publicado, edición administrativa y manifiestos de archivos privados.
- `src/modules/administration`: gestión de perfiles/roles/habilitación, invitaciones opcionales, consultas filtradas, indicadores, auditoría y CSV.
- `src/components/ui`: primitivas locales de shadcn/ui. Button, Badge, Card, Input y Label.
- `src/components/shared`: presentación transversal. `layout` compone los contratos públicos de Auth, navegación y componentes para los marcos público/privado.
- `src/config`: configuración pública y definición única de navegación por permisos.
- `src/lib`: entorno, utilidades y clientes Supabase.
- `src/proxy.ts`: adaptación de sesión al mecanismo de Next.js 16.
- `supabase`: modelo de usuarios/gimnasio, integridad, RLS, RPC privilegiadas, auditoría y plantillas.
- `tools/database`: motor de pruebas aislado y generador oficial de tipos Supabase; sin dependencias nuevas de producción.
- `tests`: pruebas unitarias y suites de navegador. Los fixtures son exclusivamente de prueba.

Dirección: `app → modules → components/lib/config`. Los módulos se comunican mediante contratos explícitos; las consultas del dashboard consumen `auth/server.ts` y la navegación consume `auth/permissions.ts`. No se crean repositorios genéricos o estado global sin un caso real.

## Decisiones

- TypeScript estricto, `noUncheckedIndexedAccess`, alias `@/* → src/*`.
- Server Components por defecto. Client Components solo para formularios, interacción y observación de sesión.
- Server Actions como entrada de mutaciones Auth, reservas, horarios y asistencia; controles de origen de Next.js por defecto, sin ampliar `allowedOrigins`.
- Supabase Auth es el único proveedor. Clientes de navegador/servidor separados con cookies coordinadas y clave publicable.
- `getUser()` verifica identidad con Auth; nunca se autoriza con la información no verificada de `getSession()` o con metadata editable.
- El proxy renueva tokens y transmite cookies. Las páginas privadas y acciones verifican acceso en servidor; el layout no constituye la única defensa.
- La consulta del perfil exige UUID de la identidad verificada y `is_active = true`. RLS y permisos de tabla impiden autoactivación.
- Perfiles inactivos por defecto, incluidos usuarios preexistentes. Altas/invitaciones y habilitación desde un entorno administrativo de confianza. Sin registro público. La integración opcional de invitaciones aísla una clave secreta exclusivamente de servidor y solo consume Auth Admin; SQL y Storage conservan la sesión del administrador.
- Tipos de base correspondientes al esquema incluido en la migración. Regenerar al aplicar o ampliar ese esquema.
- `APP_URL` fijo para callbacks, sin confiar en cabeceras de host o destinos de query string. Respuestas privadas sin caché compartida.
- Tailwind CSS 4 en PostCSS y `@theme inline`; `components.json` para shadcn/ui. No se instala una biblioteca de componentes completa ni una CLI permanente.
- Verde, blanco y neutros, fuentes del sistema y marca original provisional. Tema claro, foco visible, enlace de salto y movimiento reducido.
- ESLint 9 se conserva por compatibilidad de dependencias pares de los plugins instalados. Los avisos previos de herramientas de desarrollo siguen documentados; el módulo de asistencia agrega solo generador/lector QR y tipos del generador.
- Validación de entorno diferida: portada/build no requieren credenciales. Rutas privadas fallan de forma cerrada si la configuración o el perfil no están disponibles.
- `noindex, nofollow` mientras la plataforma sea provisional.

## Evolución

La auditoría añade `src/lib/deployment.ts` para validar perfiles/orígenes sin imprimir valores y `src/instrumentation.ts` para el arranque del perfil productivo y errores con campos permitidos. `src/lib/observability.ts` excluye mensaje, stack, query, cabeceras e identidad de esa telemetría. El fallback raíz mantiene mensajes españoles sin detalles internos. Los logs del proveedor requieren redacción adicional.

`next.config.ts` genera salida standalone y cabeceras globales; HSTS depende del perfil **durante build**. Los archivos de entorno se excluyen del trazado y del contexto Docker. Las plantillas por entorno, pipeline y procedimiento están en [despliegue](deployment.md). La corrección de sanciones es una decimotercera migración aditiva; conserva los hashes anteriores y los tipos públicos.

Antes de exponer datos institucionales, aplicar migraciones y comprobar RLS en una base de prueba real. Cada funcionalidad deberá incorporar sus reglas de autorización, validación Zod y pruebas. Ver `authentication.md` para configuración del proyecto Supabase y límites de las pruebas simuladas.

El modelo, matriz de permisos y sus límites se documentan en `database-model.md`. Los dashboards y sus límites de consulta están documentados en `dashboards.md`; consultar una franja no crea una reserva. La confirmación transaccional, los bloqueos y las nuevas rutas están descritos en `reservations.md`.

El módulo `attendance` reutiliza los contratos de autorización, componentes visuales y fechas del dashboard. Sus invariantes de escritura residen en PostgreSQL. Ver [controles de seguridad de asistencia](attendance.md).

El módulo `program` agrega libro inmutable y revisión de constancia. Saldo por suma de movimientos; reglas versionadas por mes, bloqueos por usuario/periodo, inasistencias solo con evidencia y revisión. No requiere dependencias adicionales. Ver [constancia](consistency.md).
