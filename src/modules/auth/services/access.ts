import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccess, type Permission } from "../permissions";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export async function findActiveProfile(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.from("profiles").select("id, is_active")
    .eq("id", userId).eq("is_active", true).maybeSingle();
  if (error) throw new Error("No fue posible verificar el perfil.");
  return data?.id === userId && data.is_active === true ? data : null;
}

// Nunca se autoriza mediante getSession(), metadata o datos enviados por el cliente.
export const requireUser = cache(async () => {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error && (error.status === 0 || (error.status ?? 0) >= 500)) throw new Error("No fue posible verificar la sesión.");
  if (error || !user) redirect("/login?estado=sesion-expirada");
  return { client, user };
});

export const requireActiveProfile = cache(async () => {
  const { client, user } = await requireUser();
  const profile = await findActiveProfile(client, user.id);
  if (!profile) redirect("/acceso-denegado");
  return { user: { id: user.id, email: user.email }, profile };
});

// Roles leídos de la base de datos; nunca de metadata editable o de la cookie.
export const requireViewer = cache(async () => {
  const { user, profile } = await requireActiveProfile();
  const { client } = await requireUser();
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", user.id);
  if (error) throw new Error("No fue posible verificar los permisos.");
  return { user, profile, roles: (data ?? []).map(({ role }) => role) };
});
export async function requirePermission(permission: Permission) {
  const viewer = await requireViewer();
  if (!canAccess(viewer.roles, permission)) redirect("/dashboard?estado=sin-permiso");
  return viewer;
}
