import { CalendarDays, Check, ClipboardList, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MemberOverview, ReservationSummary } from "../services/queries";
import { formatDate, formatTime } from "../dates";
import { Panel, QuietEmpty, ReadError } from "./dashboard-ui";

export function EligibilityPanel({ overview }: { overview: Pick<MemberOverview, "profile" | "eligibility" | "checkedAt"> }) {
  const { profile, eligibility } = overview;
  const error = profile.error ?? eligibility.error;
  const record = eligibility.data;
  const now = new Date(overview.checkedAt).getTime();
  const eligible = !!(record?.is_eligible && new Date(record.valid_from).getTime() <= now && (!record.valid_until || new Date(record.valid_until).getTime() >= now) && profile.data?.affiliation_types?.is_active);
  return <Panel title="Tu acceso al gimnasio" action={<ShieldCheck aria-hidden="true" className="size-5 text-primary" />}>
    {error ? <ReadError message={error} /> : <><Badge variant={eligible ? "default" : "outline"}>{eligible ? "Habilitación vigente" : "Habilitación pendiente"}</Badge><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{eligible ? "Tu perfil cuenta con habilitación para el gimnasio. Cada franja requiere una reserva confirmada y habilitación durante todo el horario." : "No tienes una habilitación vigente o tu vinculación requiere revisión. Consulta al equipo de bienestar para verificar tu acceso."}</p><dl className="mt-5 space-y-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Vinculación</dt><dd className="max-w-full break-words font-medium">{profile.data?.affiliation_types?.label ?? "Sin asignar"}</dd></div>{record && <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Vigencia</dt><dd className="max-w-full break-words font-medium">{formatDate(record.valid_from, { day: "numeric", month: "short", year: "numeric" })} – {record.valid_until ? formatDate(record.valid_until, { day: "numeric", month: "short", year: "numeric" }) : "Sin fecha de fin"}</dd></div>}</dl></>}
  </Panel>;
}
export function NextReservation({ result }: { result: MemberOverview["next"] }) {
  const reservation = result.data?.[0];
  return <Panel title="Tu próxima reserva" action={<CalendarDays className="size-5 text-primary" aria-hidden="true" />}>
    {result.error ? <ReadError message={result.error} /> : reservation ? <><Badge>Confirmada</Badge><p className="mt-4 text-xl font-semibold first-letter:uppercase">{formatDate(reservation.gym_slots.starts_at, { weekday: "long", day: "numeric", month: "long" })}</p><p className="mt-2 text-sm text-muted-foreground">Gimnasio · {formatTime(reservation.gym_slots.starts_at)} – {formatTime(reservation.gym_slots.ends_at)}</p><Button asChild variant="outline" className="mt-5"><Link href="/historial">Consultar mis reservas</Link></Button></> : <QuietEmpty icon={CalendarDays} title="Un espacio por agendar" description="Aún no tienes una próxima reserva confirmada. Puedes consultar las franjas publicadas en el gimnasio." />}
  </Panel>;
}
export function ReservationList({ items }: { items: ReservationSummary[] }) {
  if (items.length === 0) return <QuietEmpty icon={ClipboardList} title="Tu recorrido empieza aquí" description="Cuando tengas reservas anteriores, podrás consultar aquí tus actividades y asistencias." />;
  return <ul className="divide-y">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">{item.attendance && !item.attendance.attendance_invalidations ? <Check className="size-5" aria-hidden="true" /> : <CalendarDays className="size-5" aria-hidden="true" />}</span><div><p className="text-sm font-semibold">Gimnasio</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.gym_slots.starts_at)} · {formatTime(item.gym_slots.starts_at)} – {formatTime(item.gym_slots.ends_at)}</p></div></div><Badge variant="outline">{item.status === "cancelled" || item.gym_slots.status === "cancelled" ? "Cancelada" : item.attendance?.attendance_invalidations ? "Asistencia invalidada" : item.attendance ? "Asistencia registrada" : "Sin asistencia registrada"}</Badge></li>)}</ul>;
}
