import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/modules/auth/server";
import { PageHeading } from "@/modules/dashboard/components/dashboard-ui";
import { QrDisplay } from "@/modules/attendance/components/qr-display";
export const metadata={title:"QR de ingreso al gimnasio"};
export default async function GymQrPage(){
 await requirePermission("attendance");
 return <><PageHeading eyebrow="ACTIVANT · Gimnasio institucional" title="QR de ingreso" description="Mantén esta pantalla visible en el punto de acceso. El código cambia cada 15 segundos." action={<Button asChild variant="outline"><Link href="/control-asistencia">Volver al control</Link></Button>}/><div className="mx-auto max-w-2xl"><QrDisplay/></div></>;
}
