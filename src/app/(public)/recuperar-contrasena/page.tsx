import type { Metadata } from "next";
import { AuthShell, RecoveryForm } from "@/modules/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoveryPage() {
  return <AuthShell title="Recupera tu acceso" description="Escribe el correo asociado a tu cuenta. Te enviaremos un enlace para crear una nueva contraseña.">
    <RecoveryForm configured={isSupabaseConfigured()} />
  </AuthShell>;
}
