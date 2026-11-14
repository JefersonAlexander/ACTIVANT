import type { Metadata } from "next";
import { AuthShell, LoginForm } from "@/modules/auth";
import { getAuthNotice } from "@/modules/auth/messages";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const notice = getAuthNotice(estado);
  return <AuthShell title="Bienvenido de nuevo" description="Ingresa con tu cuenta institucional para acceder a tu espacio de bienestar.">
    <LoginForm configured={isSupabaseConfigured()} notice={notice} />
  </AuthShell>;
}
