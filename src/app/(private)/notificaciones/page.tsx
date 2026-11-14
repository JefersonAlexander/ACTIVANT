import Link from "next/link";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel, QuietEmpty, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { formatDate, formatTime } from "@/modules/dashboard/dates";
import { getMyWaitlist, getNotifications } from "@/modules/waitlist/services/queries";
import { WaitlistPanel } from "@/modules/waitlist/components/waitlist-panel";
import { WaitlistButton } from "@/modules/waitlist/components/waitlist-controls";
import { notificationLabels } from "@/modules/waitlist/contracts";
export const metadata = { title: "Notificaciones y espera" };
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const raw = (await searchParams).pagina;
  const page = raw && /^\d{1,4}$/.test(raw) ? Math.max(1, Number(raw)) : 1;
  const [waitlist, notifications] = await Promise.all([getMyWaitlist(), getNotifications(page)]);
  return <><PageHeading eyebrow="No pierdas tu oportunidad" title="Notificaciones y espera" description="Consulta tus ofertas de cupo y los avisos de tus reservas. Las ofertas tienen un plazo para responder." />
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"><WaitlistPanel result={waitlist} history />
      <Panel title="Tus notificaciones" description="Avisos dentro de ACTIVANT. Los recordatorios dependen de la configuración institucional.">
        {notifications.error ? <ReadError message={notifications.error} /> : <>
          {notifications.data?.length ? <ul className="divide-y">{notifications.data.map(n => <li key={n.id} data-notification-id={n.id} className="flex gap-3 py-5 first:pt-0"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><Bell className="size-4" aria-hidden="true" /></span><div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{Object.hasOwn(notificationLabels,n.kind) ? notificationLabels[n.kind] : "Aviso del gimnasio"}</h3>{!n.read_at && <Badge variant="outline">Sin leer</Badge>}</div>
            {n.gym_slots && <p className="text-sm text-muted-foreground">Gimnasio · {formatDate(n.gym_slots.starts_at)} · {formatTime(n.gym_slots.starts_at)} – {formatTime(n.gym_slots.ends_at)}</p>}
            <p className="text-xs text-muted-foreground">Recibido el {formatDate(n.created_at)} a las {formatTime(n.created_at)} (Colombia).</p>
            {n.kind === "waitlist_offer" && <p className="text-sm leading-relaxed text-muted-foreground">Consulta el estado actual en Tu lista de espera. Este aviso no confirma una reserva.</p>}
            <WaitlistButton id={n.id} operation="read" completed={!!n.read_at}>Marcar como leída</WaitlistButton>
          </div></li>)}</ul> : <QuietEmpty icon={Bell} title="Todavía no tienes notificaciones" description="Aquí aparecerán las confirmaciones, cancelaciones y ofertas de cupo." />}
          <nav aria-label="Páginas de notificaciones" className="mt-5 flex flex-wrap items-center gap-3">{page > 1 && <Button asChild variant="outline"><Link href={`/notificaciones?pagina=${page-1}`}>Anterior</Link></Button>}<span className="text-sm text-muted-foreground">Página {page}</span>{page*20 < (notifications.count ?? 0) && <Button asChild variant="outline"><Link href={`/notificaciones?pagina=${page+1}`}>Siguiente</Link></Button>}</nav>
        </>}
      </Panel></div></>;
}
