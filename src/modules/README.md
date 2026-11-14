# Módulos funcionales

Cada funcionalidad vive en `src/modules/<nombre>/`: `home` contiene la portada, `auth` contiene autenticación/autorización `dashboard` contiene consultas y presentación de bienestar/gestión, y `reservations` implementa reservas/cancelaciones y horarios.

Crear componentes, esquemas, servicios o hooks cuando exista un caso concreto. No incluir reglas de negocio en componentes compartidos. Los módulos pueden usar `components`, `lib` y `config`, y contratos públicos explícitos de otros módulos. Auth expone `server.ts` para identidad/permisos, `permissions.ts` para la matriz pura de roles e `index.ts` para UI; no mezclar servicios de servidor con componentes cliente en un barrel.

Las nuevas páginas privadas y sus lecturas deben verificar identidad, perfil activo y permiso requerido en servidor aunque estén bajo el layout privado. La navegación compartida vive en `src/config/navigation.ts`. Las consultas del dashboard son de solo lectura. Las mutaciones de reservas y horarios viven en Server Actions de `reservations` y funciones SQL autorizadas; asistencia todavía no tiene interfaz de mutación.
