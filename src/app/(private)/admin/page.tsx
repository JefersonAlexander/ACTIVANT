import type { Metadata } from "next";
import { CalendarDays, ClipboardCheck, Ticket, Users } from "lucide-react";
import { getAdminOverview } from "@/modules/dashboard/services/queries";
import { formatDate, formatTime } from "@/modules/dashboard/dates";
import { DestinationLink, MetricCard, PageHeading, Panel, QuietEmpty, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { RefreshButton } from "@/modules/dashboard/components/refresh-button";
import { Badge } from "@/components/ui/badge";
export const metadata: Metadata = { title: "Resumen administrativo" };
export default async function AdminDashboard() {
  const data = await getAdminOverview();
  const hasErrors = data.users.error || data.bookings.error || data.attendance.error || data.slots.error || data.availabilityError;
  return <>
    <PageHeading eyebrow="Administración" title="El bienestar, en perspectiva" description={`Resumen del ${formatDate(data.today, { day: "numeric", month: "long", year: "numeric" })}. Horarios de Colombia.`} action={<RefreshButton />} />
    {hasErrors && <div className="mb-5"><ReadError message="Algunos indicadores no están disponibles. Los valores sin confirmar se muestran con un guion." /></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Usuarios activos" value={data.users.count} icon={Users} error={data.users.error} description="Perfiles activos en la plataforma" />
      <MetricCard label="Reservas del día" value={data.bookings.count} icon={Ticket} error={data.bookings.error} description="Confirmadas para franjas de hoy" />
      <MetricCard label="Cupos disponibles" value={data.available} icon={CalendarDays} error={data.availabilityError} description="Hoy, en franjas futuras abiertas; descuenta ofertas vigentes" />
      <MetricCard label="Asistencias registradas" value={data.attendance.count} icon={ClipboardCheck} error={data.attendance.error} description="Registros realizados durante el día" />
    </div>
    <div className="mt-7 grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Panel title="La jornada de hoy" description="Franjas publicadas y reservas confirmadas.">
        {data.slots.error ? <ReadError message={data.slots.error} /> : !data.slots.data?.length ? <QuietEmpty icon={CalendarDays} title="Sin franjas para hoy" description="No hay horarios publicados para esta jornada. Cuando se creen, podrás consultarlos aquí." /> : <><ul className="divide-y">{data.slots.data.map((slot) => <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div><p className="text-sm font-semibold">{formatTime(slot.starts_at)} – {formatTime(slot.ends_at)}</p><p className="mt-1 text-xs text-muted-foreground">{slot.reservations[0]?.count ?? 0} reservas · capacidad {slot.capacity}</p></div><Badge variant="outline">{slot.status === "open" ? "Abierta" : slot.status === "closed" ? "Cerrada" : "Cancelada"}</Badge></li>)}</ul>{(data.slots.count ?? 0) > data.slots.data.length && <p className="mt-4 text-sm text-muted-foreground">Listado limitado a 500 franjas. Consulta el calendario para revisar los horarios.</p>}</>}
      </Panel>
      <section aria-labelledby="management-heading"><h2 id="management-heading" className="mb-4 text-lg font-semibold">Accesos de gestión</h2><div className="space-y-3"><DestinationLink href="/admin/usuarios" description="Perfiles, vinculación y acceso institucional." /><DestinationLink href="/admin/horarios" description="Consulta el calendario del gimnasio." /><DestinationLink href="/admin/reservas" description="Consulta y cancelaciones por fecha y franja." /><DestinationLink href="/admin/reportes" description="Indicadores, participación y exportaciones CSV." /><DestinationLink href="/admin/contenidos" description="Publica recursos autorizados en la biblioteca." /><DestinationLink href="/admin/configuracion" description="Reglas de reservas, espera y constancia." /><DestinationLink href="/admin/auditoria" description="Trazabilidad de las operaciones administrativas." /><DestinationLink href="/control-asistencia" description="Consulta la jornada de asistencia." /></div></section>
    </div>
  </>;
}
