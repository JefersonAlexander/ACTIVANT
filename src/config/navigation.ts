import { canAccess, type AppRole } from "../modules/auth/permissions.ts";
export const navigation = [
  { href: "/dashboard", label: "Mi bienestar", icon: "home", permission: "member", group: "Tu espacio" },
  { href: "/gimnasio", label: "Gimnasio", icon: "gym", permission: "member", group: "Tu espacio" },
  { href: "/historial", label: "Mis reservas", icon: "history", permission: "member", group: "Tu espacio" },
  { href: "/notificaciones", label: "Notificaciones y espera", icon: "bell", permission: "member", group: "Tu espacio" },
  { href: "/constancia", label: "Puntos y constancia", icon: "history", permission: "member", group: "Tu espacio" },
  { href: "/asistencia", label: "Registrar asistencia", icon: "attendance", permission: "member", group: "Tu espacio" },
  { href: "/biblioteca", label: "Biblioteca", icon: "library", permission: "member", group: "Tu espacio" },
  { href: "/perfil", label: "Mi perfil", icon: "profile", permission: "member", group: "Tu espacio" },
  { href: "/admin", label: "Resumen administrativo", icon: "admin", permission: "admin", group: "Gestión" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "users", permission: "admin", group: "Gestión" },
  { href: "/admin/horarios", label: "Horarios", icon: "calendar", permission: "admin", group: "Gestión" },
  { href: "/admin/reservas", label: "Reservas", icon: "bookings", permission: "admin", group: "Gestión" },
  { href: "/admin/constancia", label: "Revisión de constancia", icon: "reports", permission: "admin", group: "Gestión" },
  { href: "/admin/reportes", label: "Reportes", icon: "reports", permission: "admin", group: "Gestión" },
  { href: "/admin/contenidos", label: "Contenidos", icon: "library", permission: "admin", group: "Gestión" },
  { href: "/admin/configuracion", label: "Configuración", icon: "settings", permission: "admin", group: "Gestión" },
  { href: "/admin/auditoria", label: "Auditoría", icon: "shield", permission: "admin", group: "Gestión" },
  { href: "/control-asistencia", label: "Control de asistencia", icon: "attendance", permission: "attendance", group: "Gestión" },
] as const;
export function getNavigation(roles: readonly AppRole[]) {
  return navigation.filter((item) => canAccess(roles, item.permission));
}
export const privatePrefixes = [...new Set(navigation.map(({ href }) => href.split("/").slice(0, 2).join("/")))];
export function isPrivatePath(path: string) {
  return privatePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
