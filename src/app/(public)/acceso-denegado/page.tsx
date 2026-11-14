import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/modules/auth";

export const metadata: Metadata = { title: "Acceso pendiente" };

export default function AccessDeniedPage() {
  return <Container className="py-16 text-center">
    <h1 className="text-2xl font-semibold">Tu acceso requiere habilitación</h1>
    <EmptyState icon={ShieldAlert} title="No hay un perfil activo para esta cuenta" description="Comunícate con el administrador institucional para revisar tu acceso. Tener una cuenta no habilita automáticamente el ingreso al dashboard." />
    <div className="flex flex-wrap justify-center gap-3"><LogoutButton /><Button asChild variant="ghost"><Link href="/">Volver al inicio</Link></Button></div>
  </Container>;
}
