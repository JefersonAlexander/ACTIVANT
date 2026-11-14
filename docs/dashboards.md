# Interfaces de bienestar y gestión

## Alcance

Dashboards conectados al cliente SSR de Supabase. El módulo posterior de [reservas](reservations.md) incorpora reserva/cancelación y horarios/configuración; habilitaciones, roles y contenidos aún no tienen herramientas nuevas de gestión. [Constancia](consistency.md) incorpora puntos y revisión de inasistencias. El módulo de [asistencia QR](attendance.md) añade el control de ingreso.

| Ruta | Acceso y contenido |
| --- | --- |
| `/dashboard` | Perfil activo: saludo a partir del correo verificado, habilitación, próxima reserva, cinco actividades anteriores, calendario, biblioteca y perfil. |
| `/gimnasio?mes=AAAA-MM` | Perfil activo: calendario, habilitación, cupos agregados y reserva/cancelación. |
| `/historial` | Perfil activo: reservas activas e historial paginado de todas las reservas. |
| `/perfil` | Perfil activo: correo, estado, roles y vinculación de la propia cuenta, cambio de contraseña. |
| `/biblioteca` | Perfil activo: estado informativo del módulo de contenidos. |
| `/admin` | Rol `admin` y perfil activo: indicadores reales del día y accesos de gestión. |
| `/admin/usuarios`, `/admin/reservas`, `/admin/reportes` | Rol `admin`: destinos informativos de las herramientas aún pendientes. |
| `/admin/horarios?mes=AAAA-MM` | Rol `admin`: calendario, creación/edición de franjas y condiciones de reserva. |
| `/control-asistencia` | Rol `admin` o `gym_staff`: asistencias de hoy, ingreso manual auditado y acceso al QR dinámico. |

Puntos y biblioteca no tienen módulo ni bandera de habilitación en el esquema actual. No se consulta una columna o tabla inexistente ni se muestran saldos inventados. El saludo usa la parte local del correo porque `profiles` aún no contiene un nombre personal.

## Archivos y responsabilidades

- `src/config/navigation.ts`: única definición de enlaces, etiquetas, grupos, permisos requeridos y prefijos privados. La sidebar, menú móvil y accesos de tarjetas la comparten. Los literales de `src/proxy.ts` se conservan explícitos porque Next.js debe poder analizarlos estáticamente.
- `src/modules/auth/permissions.ts`: matriz única de roles y permisos, compartida por navegación y guardas.
- `src/modules/auth/server.ts` y `services/access.ts`: contrato servidor de identidad, perfil y roles. Cada entrada de datos verifica permisos; el layout también verifica para componer la navegación, pero no es la única defensa.
- `src/modules/dashboard/services/queries.ts`: consultas tipadas, acotadas, exclusivamente de servidor, sin claves privilegiadas. Auth/roles y lecturas de presentación están separados: un error de permisos cierra el acceso; un error de lectura permite mostrar una tarjeta con reintento.
- `src/modules/dashboard/dates.ts`: calendario, fechas y límites del día en `America/Bogota`.
- `src/modules/dashboard/components/`: calendario interactivo, habilitación, reserva, historial, tarjetas, avisos y actualización. Utiliza las primitivas existentes de shadcn/ui y Lucide.
- `src/components/layout/app-shell.tsx`, `app-navigation.tsx`: sidebar de escritorio y menú desplegable móvil, enlace activo y perfil/cierre de sesión. La sidebar puede desplazarse en pantallas bajas.
- `src/components/layout/public-shell.tsx`, `src/app/(public)/layout.tsx`: marco público, conservando todas las URLs anteriores. El layout raíz mantiene idioma, metadatos y enlace de salto.
- `src/app/(private)/`: páginas, layout, skeleton de carga, error recuperable y página no encontrada. Las páginas delegan autorización y lecturas a la capa de servidor.
- `src/lib/supabase/proxy.ts` y `src/proxy.ts`: actualización de sesión y `no-store` extendidos a todas las entradas privadas.
- `tests/e2e/dashboard.spec.ts`, `tests/fixtures/supabase-mock.mjs`, `tests/unit/dashboard.test.ts`: permisos, datos, estados, navegación, fechas, responsive y accesibilidad. Los datos sintéticos existen solo en el servidor de pruebas.
- `playwright.auth.config.ts`, `playwright.config.ts`: suite privada con fixtures aislados y regresión pública independiente.

## Consultas y significado de los indicadores

El servidor utiliza la identidad validada mediante `getUser()`, obtiene roles desde `user_roles` y opera con el cliente SSR sujeto a RLS. Nunca usa metadata editable para autorizar. Un acceso no permitido redirige a `/dashboard?estado=sin-permiso`, sin ejecutar las consultas administrativas. La caché de React deduplica solo dentro del render de la petición; no comparte datos privados entre usuarios.

Las lecturas personales incluyen siempre el UUID de la identidad, incluso cuando una cuenta administrativa puede leer más mediante RLS. La habilitación visual exige permiso vigente y categoría de vinculación activa; no constituye una autorización de reserva. La base de datos comprobará la vigencia durante toda la franja al implementar ese flujo.

La próxima reserva es confirmada, no cancelada y aún no finalizada; el historial contiene hasta cinco reservas finalizadas, con asistencia cuando exista. El calendario consulta hasta 500 franjas del mes y excluye las canceladas. En el dashboard se conserva la capacidad total. En `/gimnasio`, una RPC segura devuelve los agregados de ocupación sin exponer reservas ajenas; ver `reservations.md`.

En administración, usuarios activos es el conteo exacto de perfiles activos; reservas del día cuenta confirmadas para franjas que comienzan hoy; asistencias cuenta registros efectuados hoy. Cupos disponibles suma capacidad menos reservas confirmadas únicamente en franjas abiertas de hoy que todavía no comienzan. Las fechas se evalúan en Bogotá. Los conteos se solicitan a PostgREST; no se estiman con una lista paginada. Si las franjas se truncan o la consulta falla, el total de cupos se muestra como no disponible. Las lecturas independientes representan el estado al consultar y pueden cambiar entre actualizaciones.

No se convierte un error de red en una lista vacía ni en un cero. Las consultas de presentación tienen límite de diez segundos y reintento manual; la sesión se sigue renovando y verificando mediante el mecanismo existente.

## Diseño y comprobación

Verde institucional `#246747`, superficies blancas y fondo neutro `#f5f6f3`; tipografía local, bordes suaves y separación entre información y acciones. Mobile-first: una columna, luego tarjetas en dos/cuatro columnas según espacio; sidebar a partir de 1024 px. Menú móvil con botón etiquetado, estado expandido y enlace actual. Calendario con botones por fecha, selección anunciada, etiquetas completas y navegación mensual por enlaces. `main`, encabezados, listas y definiciones aportan estructura semántica. Se respetan foco y movimiento reducido.

Ejecutar `npm.cmd run validate`, `npm.cmd run test:auth` y `npm.cmd run test:e2e` de forma secuencial para el conjunto de comprobaciones. Las capturas y trazas se guardan en `test-results/auth/` y `test-results/home/` (ignorados por Git). La auditoría automática de accesibilidad no sustituye una revisión completa con tecnologías de asistencia.

Este entorno no tiene `.env.local` ni proyecto Supabase alojado configurado. Las consultas usan el esquema y tipos reales existentes, pero su integración alojada debe verificarse con las variables públicas, las migraciones aplicadas y cuentas autorizadas. Las pruebas de navegador usan el SDK real contra un doble HTTP; no certifican PostgREST, Auth, correo o RLS remoto. La validación PostgreSQL anterior permanece documentada por separado.

Referencias consultadas: guías locales de Next.js 16.4.6 (`route-groups`, `data-security`) y documentación oficial de [consulta de relaciones y conteos Supabase](https://supabase.com/docs/reference/javascript/select), [ordenamiento](https://supabase.com/docs/reference/javascript/order) y [autorización en Next.js](https://nextjs.org/docs/app/guides/authentication).

El dashboard consulta `get_my_point_summary` y muestra saldo/progreso real. `/constancia` y `/admin/constancia` se incorporan a la navegación central. Recompensas y canjes permanecen deshabilitados.
