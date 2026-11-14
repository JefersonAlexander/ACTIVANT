"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, clearAuthCookies } from "@/lib/supabase/server";
import { loginSchema, recoverySchema, passwordSchema } from "./schemas";
import { authErrorMessage, type AuthFormState } from "./messages";
import { getAppOrigin } from "./config";
import { findActiveProfile } from "./services/access";

export async function login(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Revisa los campos indicados.", errors: parsed.error.flatten().fieldErrors };
  try {
    const client = await createClient({ writable: true });
    const { data, error } = await client.auth.signInWithPassword(parsed.data);
    if (error || !data.user) return { status: "error", message: authErrorMessage(error) };
    // getUser consulta la autoridad de Auth incluso tras recibir una sesión de login.
    const { data: verified, error: verificationError } = await client.auth.getUser();
    if (verificationError || !verified.user) {
      await client.auth.signOut({ scope: "local" });
      await clearAuthCookies();
      return { status: "error", message: "No pudimos verificar tu sesión. Intenta nuevamente." };
    }
    const profile = await findActiveProfile(client, verified.user.id);
    if (!profile) {
      await client.auth.signOut({ scope: "local" });
      await clearAuthCookies();
      return { status: "error", message: "Tu cuenta no tiene un perfil activo. Comunícate con el administrador institucional." };
    }
  } catch {
    await clearAuthCookies();
    return { status: "error", message: "No pudimos completar el acceso. Intenta nuevamente en unos minutos." };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function recoverPassword(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = recoverySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Revisa el correo electrónico.", errors: parsed.error.flatten().fieldErrors };
  try {
    const client = await createClient({ writable: true });
    const { error } = await client.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${getAppOrigin()}/auth/callback`,
    });
    if (error && (error.status === 429 || error.status === 0 || (error.status ?? 0) >= 500)) {
      return { status: "error", message: authErrorMessage(error) };
    }
  } catch {
    return { status: "error", message: "No pudimos enviar la solicitud. Intenta nuevamente en unos minutos." };
  }
  // Mismo mensaje para cuentas existentes y correos que no pertenecen al sistema.
  return { status: "success", message: "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de correo no deseado." };
}

export async function updatePassword(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Revisa la nueva contraseña.", errors: parsed.error.flatten().fieldErrors };
  try {
    const client = await createClient({ writable: true });
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return { status: "error", message: "Tu sesión expiró. Solicita un nuevo enlace de recuperación." };
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) {
      const message = error.code === "same_password" ? "La nueva contraseña debe ser diferente a la anterior." :
        error.code === "weak_password" ? "La contraseña no cumple la política de seguridad institucional." :
        error.code === "reauthentication_needed" ? "Solicita un nuevo enlace de recuperación para confirmar tu identidad." :
        "No pudimos actualizar la contraseña. Intenta nuevamente o solicita un nuevo enlace.";
      return { status: "error", message };
    }
    // Revoca las sesiones de otros dispositivos tras el cambio. La sesión actual
    // se elimina igualmente del navegador, incluso si falla la llamada remota.
    await client.auth.signOut({ scope: "global" });
    await clearAuthCookies();
  } catch {
    return { status: "error", message: "No pudimos completar la actualización. Intenta nuevamente en unos minutos." };
  }
  revalidatePath("/", "layout");
  redirect("/login?estado=contrasena-actualizada");
}

export async function logout(): Promise<void> {
  try {
    const client = await createClient({ writable: true });
    await client.auth.signOut({ scope: "local" });
  } catch {
    // El cierre local sigue disponible ante fallos de conectividad con Auth.
  }
  await clearAuthCookies();
  revalidatePath("/", "layout");
  redirect("/login?estado=sesion-cerrada");
}
