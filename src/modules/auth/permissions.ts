import type { Database } from "@/lib/supabase/database.types";
export type AppRole = Database["public"]["Enums"]["app_role"];
export type Permission = "member" | "admin" | "attendance";
export function canAccess(roles: readonly AppRole[], permission: Permission) {
  return permission === "member" || roles.includes("admin") || (permission === "attendance" && roles.includes("gym_staff"));
}
