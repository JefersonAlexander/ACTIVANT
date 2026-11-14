import { BarChart3, CalendarCheck, CircleAlert, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel, ReadError, QuietEmpty, MetricCard, ModuleNotice } from "@/modules/dashboard/components/dashboard-ui";
import { dayKey, formatDate, formatTime } from "@/modules/dashboard/dates";
import { parseReportFilters, type SearchParams } from "../contracts";
import { getFilterSlots, getGymReport } from "../services/queries";
import { DateSlotFilters, filterQuery } from "./filters";
export const tableClass = "w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-3 [&_th]:font-semibold [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_tbody_tr]:border-t";
export const percent = (value: number | null) => value === null ? "Sin franjas finalizadas" : `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value)} %`;
export async function ReportPage({ params }: { params: SearchParams }) {
  const parsed = parseReportFilters(params, dayKey(new Date()));
  if (!parsed.success) return <><PageHeading eyebrow="Administración" title="Reportes" description="Indicadores del gimnasio con información registrada en Supabase." /><ReadError message="Selecciona fechas válidas en un rango máximo de 93 días y una franja válida." /><Button asChild variant="outline" className="mt-4"><Link href="/admin/reportes">Restablecer filtros</Link></Button></>;
  const filters = parsed.data;
  const [report, slots] = await Promise.all([getGymReport(filters), getFilterSlots(filters)]);
  const data = report.data;
  return <><PageHeading eyebrow="Administración" title="Reportes" description="Ocupación, asistencia y participación. Cada indicador corresponde al rango y la franja seleccionados." />
    <DateSlotFilters filters={filters} slots={slots.data ?? []} action="/admin/reportes" />{slots.error && <ReadError message={slots.error} />}
    {report.error || !data ? <ReadError message={report.error ?? "No se encontraron indicadores."} /> : <>
      <p className="mb-5 text-xs text-muted-foreground">Consulta del servidor: {formatDate(data.observed_at)} · {formatTime(data.observed_at)} · Colombia.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Reservas confirmadas" value={data.summary.reservations} description="Reservas que conservan su estado confirmado." icon={Ticket} />
        <MetricCard label="Asistencias efectivas" value={data.summary.attendances} description="Asistencias validadas, sin registros invalidados." icon={CalendarCheck} />
        <MetricCard label="Inasistencias injustificadas" value={data.summary.absences} description="Casos revisados y confirmados; no se presumen por falta de marcación." icon={CircleAlert} />
        <MetricCard label="Cancelaciones" value={data.summary.cancellations} description="Reservas canceladas de las franjas del rango." icon={Ticket} />
        <MetricCard label="Participantes" value={data.summary.participants} description="Personas con al menos una asistencia efectiva." icon={Users} />
        <MetricCard label="Usuarios recurrentes" value={data.summary.recurrent_users} description="Personas con dos o más asistencias efectivas en el rango." icon={Users} />
        <MetricCard label="Demanda registrada" value={data.summary.demand} description="Personas distintas por franja, entre reservas y lista de espera." icon={BarChart3} />
        <MetricCard label="Casos por revisar" value={data.summary.pending_reviews} description="Casos pendientes o con solicitud de revisión." icon={CircleAlert} />
      </div>
      <div className="my-6"><ModuleNotice>Aprovechamiento: {percent(data.summary.utilization_percent)}. Se calcula con asistencias efectivas sobre la capacidad de las franjas finalizadas y no canceladas. La ocupación usa reservas confirmadas; las ofertas de espera se muestran por separado.</ModuleNotice></div>
      {!data.total_slots ? <QuietEmpty icon={BarChart3} title="Sin franjas en este rango" description="Ajusta las fechas o selecciona otra franja para consultar los indicadores." /> : <div className="space-y-6">
        <Panel title="Ocupación por franja" description={`${data.total_slots} franjas. Se muestran hasta 2.000; reduce el rango para exportar si se supera ese límite.`} action={<Button asChild variant="outline"><a href={`/admin/exportar?${filterQuery(filters, { tipo: "franjas" })}`}>Exportar franjas CSV</a></Button>}>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de ocupación desplazable"><table className={tableClass}><caption className="sr-only">Ocupación y aprovechamiento por franja, hora de Colombia</caption><thead><tr><th scope="col">Franja</th><th scope="col">Estado</th><th scope="col">Capacidad</th><th scope="col">Confirmadas</th><th scope="col">Ofertas</th><th scope="col">Ocupación</th><th scope="col">Asistencias</th><th scope="col">Aprovechamiento</th><th scope="col">Demanda</th></tr></thead><tbody>{data.slots.map(slot => <tr key={slot.id}><th scope="row">{formatDate(slot.starts_at)}<br />{formatTime(slot.starts_at)} – {formatTime(slot.ends_at)}</th><td>{slot.status === "cancelled" ? "Cancelada" : slot.status === "closed" ? "Cerrada" : "Abierta"}</td><td>{slot.capacity}</td><td>{slot.confirmed}</td><td>{slot.held}</td><td>{percent(slot.occupancy_percent)}</td><td>{slot.effective_attendances}</td><td>{percent(slot.utilization_percent)}</td><td>{slot.demand}</td></tr>)}</tbody></table></div>
        </Panel>
        <div className="grid items-start gap-6 xl:grid-cols-2"><Panel title="Demanda por horario" description="Cada persona se cuenta una vez por franja, aunque haya cancelado o pasado de la espera a una reserva."><ul className="divide-y">{data.hourly.map(row => <li key={row.start_time} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-semibold">{row.start_time}</span><span>{row.demand} solicitudes · {row.slots} franjas</span></li>)}</ul></Panel>
        <Panel title="Evolución de la participación" description="Días con franjas registradas. Las barras representan asistencias efectivas." action={<Button asChild variant="outline"><a href={`/admin/exportar?${filterQuery(filters, { tipo: "participacion" })}`}>Exportar participación CSV</a></Button>}><ul className="space-y-4">{data.daily.map(row => <li key={row.report_day} className="text-sm"><div className="mb-2 flex flex-wrap justify-between gap-2"><span className="font-semibold">{row.report_day}</span><span>{row.attendances} asistencias · {row.participants} personas</span></div><progress className="program-progress w-full" value={row.attendances} max={Math.max(1, ...data.daily.map(d => d.attendances))} aria-label={`Asistencias del ${row.report_day}: ${row.attendances}`} /></li>)}</ul></Panel></div>
      </div>}
    </>}
  </>;
}
