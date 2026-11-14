import { PublicShell } from "@/components/layout/public-shell";
import Link from "next/link";
import { Compass } from "lucide-react";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <PublicShell><Container className="py-16 text-center">
    <h1 className="text-sm font-semibold text-primary">Página no encontrada</h1>
    <EmptyState icon={Compass} title="Este camino aún no está disponible" description="La dirección que buscas no existe. Puedes regresar a la página de inicio de ACTIVANT." />
    <Button asChild><Link href="/">Volver al inicio</Link></Button>
  </Container></PublicShell>;
}
