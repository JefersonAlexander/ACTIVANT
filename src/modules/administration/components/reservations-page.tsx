import Link from "next/link";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeading, Panel, QuietEmpty, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { dayKey, formatDate, formatTime } from "@/modules/dashboard/dates";
import { ReservationControl } from "@/modules/reservations/components/reservation-control";
import { pageNumber, parseReportFilters, type SearchParams } from "../contracts";
import { getAdministrativeReservations, getFilterSlots } from "../services/queries";
import { DateSlotFilters, Pagination } from "./filters";
export async function ReservationsPage({ params }: { params: SearchParams }) {
  const parsed = parseReportFilters(params, dayKey(new Date()));
  if (!parsed.success) return <><PageHeading title="Reservas" description="Consulta y cancelación administrativa de reservas." /><ReadError message="Selecciona un rango válido de hasta 93 días." /><Button asChild variant="outline" className="mt-4"><Link href="/admin/reservas">Restablecer filtros</Link></Button></>;
  const filters = parsed.data, page = pageNumber(params.pagina);
  const [reservations, slots] = await Promise.all([getAdministrativeReservations(filters, page), getFilterSlots(filters)]);
  return <><PageHeading eyebrow="Administración" title="Reservas" description="Consulta reservas por fecha y franja. Las cancelaciones conservan la trazabilidad y respetan las validaciones del gimnasio." /><DateSlotFilters filters={filters} slots={slots.data ?? []} action="/admin/reservas" />{slots.error && <ReadError message={slots.error} />}<Panel title="Reservas del rango">
    {reservations.error ? <ReadError message={reservations.error} /> : !reservations.data?.length ? <QuietEmpty icon={Ticket} title="Sin reservas en esta consulta" description="Selecciona otras fechas o una franja diferente." /> : <ul className="divide-y">{reservations.data.map(row => <li key={row.id} className="space-y-3 py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{formatDate(row.gym_slots.starts_at)} · {formatTime(row.gym_slots.starts_at)} – {formatTime(row.gym_slots.ends_at)}</h3><p className="mt-2 break-all text-xs text-muted-foreground">Usuario: {row.user_id}</p><p className="mt-1 break-all text-xs text-muted-foreground">Reserva: {row.id}</p></div><Badge variant="outline">{row.status === "cancelled" ? "Cancelada" : "Confirmada"}</Badge></div>{row.attendance && <p className="text-sm">{row.attendance.attendance_invalidations ? "Asistencia invalidada; consulta la revisión de constancia." : "Asistencia efectiva registrada."}</p>}{row.status === "confirmed" && !row.attendance && <ReservationControl reservationId={row.id} startsAt={row.gym_slots.starts_at} endsAt={row.gym_slots.ends_at} canCancel />}</li>)}</ul>}
    {!reservations.error && <Pagination page={page} count={reservations.count ?? 0} size={20} href="/admin/reservas" filters={filters} />}
  </Panel></>;
}
