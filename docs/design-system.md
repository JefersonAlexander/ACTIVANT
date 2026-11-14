# Sistema visual provisional

Dirección: interfaz institucional serena, clara y accesible. Verde, blanco y neutros; sin sellos, fotografías institucionales ni afirmaciones de servicios no suministrados.

| Token | Valor | Uso |
| --- | --- | --- |
| `primary` | `#246747` | Acciones y énfasis |
| `background` | `#ffffff` | Superficie principal |
| `foreground` | `#24382f` | Texto principal |
| `secondary` | `#edf3e9` | Superficies suaves |
| `muted-foreground` | `#5f6e63` | Texto secundario |
| `border` | `#dde4da` | Separadores |
| `ring` | `#246747` | Foco de teclado |

Los tokens viven en `src/app/globals.css`. La fuente es Segoe UI con alternativas locales. En la portada, ancho de contenido máximo de 1280 px; gutters adaptables de 20/32/48 px. Controles principales de al menos 44 px de alto. El bloque de bienvenida y el estado vacío pasan de dos columnas a una; los principios pasan de tres a una. La navegación móvil de la portada permanece visible, sin menú dependiente de JavaScript.

El contenido de los principios es una propuesta editorial. Los números 01–03 indican orden, no estadísticas. En la portada, el CTA informativo lleva a información disponible dentro de la página.

Verificar teclado, foco, contraste, zoom y ausencia de desbordamiento; las capturas E2E se generan en `test-results/`.


## Acceso institucional

El login utiliza una composición de dos paneles en escritorio y una tarjeta en móvil. Conserva el verde institucional, la marca provisional y las fuentes del sistema. Los inputs tienen 48 px de alto, etiquetas visibles, autocompletado semántico, errores vinculados y foco destacado. La contraseña puede mostrarse/ocultarse con un botón etiquetado y estado anunciado. Los formularios indican carga y los avisos usan regiones `alert`/`status` en español. No se muestran enlaces de registro ni contactos ficticios.

Se comprobaron 320, 375, 768, 1024 y 1440 px y se revisaron capturas de login a 1440 y 390 px. axe-core no detectó infracciones automáticas en el estado inicial del formulario; esta revisión no certifica cumplimiento integral de accesibilidad.


## Espacio privado

Se mantienen los mismos tokens. Fondo neutro, sidebar blanca de 248 px y tarjetas blancas con bordes suaves. La sidebar aparece desde 1024 px y puede desplazarse en pantallas de poca altura; en móvil se utiliza un botón Menú con `aria-expanded` y `aria-controls`, navegación en lista y cierre al seguir un enlace. La sección actual utiliza `aria-current`.

Los indicadores muestran solo cifras consultadas, guion para errores y estados informativos cuando un módulo falta. Calendario de siete columnas con botones por día, etiquetas completas y selección anunciada; las franjas muestran capacidad total, sin inventar cupos disponibles para un usuario que no puede ver reservas ajenas. Los estados de carga usan skeletons y movimiento reducido. Error recuperable, ausencia de registros y falta de permisos tienen mensajes distintos.

Las capturas de dashboards y estados se conservan con las pruebas privadas; el detalle del alcance está en [dashboards](dashboards.md).


## Reserva y gestión de franjas

La ocupación usa `meter` nativo con color del token primario y cifras de cupos ocupados/disponibles. La confirmación utiliza `dialog` nativo, con nombre y descripción accesibles, foco gestionado por el navegador y botones de acción/retorno. Los estados deshabilitados muestran la causa al lado del botón; las respuestas son regiones `status`/`alert`. Los formularios de fechas especifican hora de Colombia. Los paneles compartidos exponen regiones nombradas para facilitar navegación asistida. No se añadieron dependencias visuales.
