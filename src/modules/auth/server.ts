import "server-only";
// Contrato público para las rutas y las consultas de otros módulos.
export { requireUser, requireActiveProfile, requireViewer, requirePermission } from "./services/access";
export type { AppRole, Permission } from "./permissions";
