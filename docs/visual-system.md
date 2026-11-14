# Identidad visual de ACTIVANT

La interfaz utiliza las referencias visuales proporcionadas por el propietario: fondo menta, verde institucional, tarjetas blancas y verde oscuro, botones en forma de capsula, esquinas amplias y sombras suaves. El logo original permanece en `public/images/Logotipo Activant.png`.

| Token | Color | Uso |
| --- | --- | --- |
| background | `#eff9f4` | Fondo general |
| forest / foreground | `#0b5743` | Titulos, texto principal y tarjetas oscuras |
| primary | `#007a2c` | Texto e indicadores verdes con contraste legible |
| brand-green | `#008f32` | Acentos decorativos |
| mint / accent | `#2cf5a0` | Botones principales, seleccion y progreso |
| card | `#ffffff` | Tarjetas y formularios |
| muted-foreground | `#53655d` | Texto secundario |

Los tokens viven en `src/app/globals.css`; Button, Card, Input, Panel y MetricCard los comparten en los modulos publicos, de usuario y administrativos. `Panel` admite `tone="forest"`, que adapta los colores interiores sin cambiar su contenido ni sus acciones. Los dialogos conservan contraste propio cuando proceden de una tarjeta oscura.

Poppins se sirve desde archivos WOFF2 locales en pesos 400, 500, 600 y 700 mediante `next/font/local`. No depende de Google durante compilacion ni navegacion. Los archivos proceden de Google Fonts; su licencia OFL acompana las fuentes en `src/assets/fonts/OFL.txt`.

La barra flotante derecha muestra accesos a bienestar, gimnasio, biblioteca y perfil. El boton Menu abre un dialogo nativo con todas las secciones autorizadas. Se conserva `getNavigation(roles)` como unica fuente de permisos y destinos; el dialogo gestiona foco, Escape y cierre mediante las funciones nativas del navegador.

Las fotografias, nombres, fechas, puntajes y cifras de las referencias no se incorporan como datos del aplicativo. Los contenidos e indicadores siguen procediendo de las consultas y reglas existentes. No se modifican Server Actions, servicios, permisos, migraciones ni reglas de negocio para este cambio visual.

Validar accesibilidad automatica y revisar capturas en escritorio y celular al modificar la paleta, la tipografia o las dimensiones de la navegacion. Las comprobaciones automaticas no certifican por si solas cumplimiento integral de accesibilidad.

## Verificación ejecutada el 14 de noviembre de 2026

| Comprobación | Resultado |
| --- | --- |
| `npm run validate` | ESLint sin advertencias, TypeScript, 39 pruebas unitarias y compilación de producción correctos |
| `npm run test:e2e` | 8 casos públicos correctos |
| `npm run test:auth` | 92 de 102 casos correctos en la primera ejecución; 10 fallaron por un selector ambiguo del menú en la prueba |
| Reejecución de los casos afectados | Los 10 casos pasan tras precisar el selector, en escritorio y celular |
| Revisión del build en Chrome | 18 pantallas: inicio, login, dashboard, administración, menú y perfil, en anchos de 320, 390 y 1440 px; sin desbordamiento horizontal ni infracciones detectadas por axe |
| Navegación por teclado | Foco contenido en el diálogo, cierre con Escape y devolución del foco al botón Menú |
| Logo e icono | Logo cargado sin deformación; icono PNG de 64 × 64 generado correctamente |

Las pruebas de navegador usan identidades sintéticas y el doble HTTP local de Supabase. No ejecutan operaciones contra Supabase Cloud ni verifican su infraestructura. El doble no implementa WebSocket: la actualización Realtime real queda fuera de esta verificación visual.

La evidencia local está en `artifacts/audit/theme-final-validate.txt`, `theme-e2e.txt`, `theme-auth.txt`, `theme-auth-recheck.txt`, `theme-visual-final.txt` y `theme-visual.json`, junto a las capturas `theme-*.png`. Estos artefactos están ignorados por Git. Las capturas contienen únicamente datos sintéticos de pruebas.
