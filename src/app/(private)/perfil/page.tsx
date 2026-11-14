import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getMemberProfile } from "@/modules/dashboard/services/queries";
import { EligibilityPanel } from "@/modules/dashboard/components/member-panels";
import { PageHeading, Panel, ReadError } from "@/modules/dashboard/components/dashboard-ui";
export const metadata = { title: "Mi perfil" };
export default async function ProfilePage() {
  const data = await getMemberProfile();
  const roles = { user: "Usuario", gym_staff: "Personal del gimnasio", admin: "Administrador" };
  return <><PageHeading title="Mi perfil" description="Tu información institucional y los permisos de tu cuenta." /><div className="grid items-start gap-5 lg:grid-cols-2"><Panel title="Información de la cuenta"><dl className="space-y-5 text-sm"><div><dt className="text-muted-foreground">Correo electrónico</dt><dd className="mt-1 break-all font-medium">{data.viewer.user.email ?? "Sin correo disponible"}</dd></div><div><dt className="text-muted-foreground">Estado del perfil</dt><dd className="mt-1 font-medium">Activo</dd></div><div><dt className="text-muted-foreground">Roles asignados</dt><dd className="mt-1 font-medium">{data.viewer.roles.length ? data.viewer.roles.map((role) => roles[role]).join(", ") : "Sin roles adicionales"}</dd></div></dl>{data.profile.error && <div className="mt-5"><ReadError message={data.profile.error} /></div>}<Button asChild variant="outline" className="mt-6"><Link href="/actualizar-contrasena">Cambiar contraseña</Link></Button></Panel><EligibilityPanel overview={data} /></div></>;
}
