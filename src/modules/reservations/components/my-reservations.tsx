import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/modules/dashboard/dates";
import { Panel, QuietEmpty, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { ReservationControl } from "./reservation-control";
import type { MyReservations } from "../services/queries";

type Item = NonNullable<MyReservations["history"]["data"]>[number];
function ReservationItems({ items, observedAt, cancel = false }: { items: Item[]; observedAt: string; cancel?: boolean }) {
  return <ul className="divide-y">{items.map((item) => {
    const slot = item.gym_slots;
    const cancelled = item.status === "cancelled";
    const finished = new Date(slot.ends_at).getTime() <= new Date(observedAt).getTime();
    const label = cancelled ? "Cancelada" : item.attendance?.attendance_invalidations ? "Asistencia invalidada" : item.attendance ? "Asistencia registrada" : slot.status === "cancelled" ? "Franja cancelada" : finished ? "Finalizada" : "Confirmada";
    return <li key={item.id} className="space-y-4 py-5 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold first-letter:uppercase">{formatDate(slot.starts_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p><p className="mt-1 text-sm text-muted-foreground">Gimnasio · {formatTime(slot.starts_at)} – {formatTime(slot.ends_at)}</p></div><Badge variant="outline">{label}</Badge></div><p className="break-all text-xs text-muted-foreground">Código de reserva: {item.id}</p>{cancel && !cancelled && !finished && <ReservationControl reservationId={item.id} startsAt={slot.starts_at} endsAt={slot.ends_at} canCancel={!item.attendance && new Date(slot.starts_at).getTime() > new Date(observedAt).getTime()} />}</li>;
  })}</ul>;
}
export function MyReservationsView({ data, summary = false }: { data: MyReservations; summary?: boolean }) {
  return <div className="space-y-6">
    <Panel title="Reservas activas" description="Tus próximas franjas y reservas en curso.">
      {data.active.error ? <ReadError message={data.active.error} /> : data.active.data?.length ? <><ReservationItems items={data.active.data} observedAt={data.observedAt} cancel />{(data.active.count ?? 0) > data.active.data.length && <p className="mt-4 text-sm text-muted-foreground">Se muestran las primeras 50 reservas activas.</p>}</> : <QuietEmpty icon={CalendarDays} title="Aún no tienes reservas activas" description="Elige un horario disponible en el calendario del gimnasio." />}
    </Panel>
    {summary ? <Button asChild variant="outline"><Link href="/historial">Ver Mis reservas e historial</Link></Button> : <Panel title="Historial de reservas" description="Todas tus reservas, incluidas las activas y las canceladas. Diez por página.">
      {data.history.error ? <ReadError message={data.history.error} /> : data.history.data?.length ? <ReservationItems items={data.history.data} observedAt={data.observedAt} cancel /> : <QuietEmpty icon={CalendarDays} title="Sin reservas registradas" description="Tu historial aparecerá aquí después de realizar una reserva." />}
      <nav aria-label="Páginas del historial" className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm"><span>Página {data.page} · {data.history.count ?? "—"} reservas</span><div className="flex gap-2">{data.page > 1 && <Button asChild variant="outline" size="sm"><Link href={`/historial?pagina=${data.page - 1}`}>Anterior</Link></Button>}{data.page * 10 < (data.history.count ?? 0) && <Button asChild variant="outline" size="sm"><Link href={`/historial?pagina=${data.page + 1}`}>Siguiente</Link></Button>}</div></nav>
    </Panel>}
  </div>;
}
