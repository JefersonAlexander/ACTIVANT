import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
export function invitationsConfigured() { return /^sb_secret_.{12,}$/.test(process.env.SUPABASE_SECRET_KEY ?? ""); }
// Cliente privilegiado limitado a esta integración de Auth. Nunca se entrega a UI/SQL/Storage.
export async function sendAdministrativeInvitation(email: string, redirectTo: string) {
  if (!invitationsConfigured()) throw new Error("Invitaciones no configuradas.");
  const env = getSupabaseEnv();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  return admin.auth.admin.inviteUserByEmail(email, { redirectTo });
}
