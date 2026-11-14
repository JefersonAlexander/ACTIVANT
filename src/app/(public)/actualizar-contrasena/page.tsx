import type { Metadata } from "next";
import { AuthShell, PasswordForm, LogoutButton } from "@/modules/auth";
import { requireUser } from "@/modules/auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Actualizar contraseña" };

export default async function UpdatePasswordPage() {
  await requireUser();
  return <AuthShell title="Define tu contraseña" description="Crea una contraseña única para tu cuenta de ACTIVANT. Al guardarla, deberás iniciar sesión nuevamente.">
    <PasswordForm />
    <div className="mt-5 flex justify-center"><LogoutButton /></div>
  </AuthShell>;
}
