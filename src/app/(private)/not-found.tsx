import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/modules/dashboard/components/dashboard-ui";
export default function PrivateNotFound() {
  return <><PageHeading title="Página no encontrada" description="Esta sección no está disponible. Puedes regresar a tu espacio de bienestar." /><Button asChild><Link href="/dashboard">Volver a mi bienestar</Link></Button></>;
}
