import Link from "next/link";
import { getMemberProfile } from "@/modules/dashboard/services/queries";
import { dayKey } from "@/modules/dashboard/dates";
import { GymCalendar } from "@/modules/dashboard/components/gym-calendar";
import { EligibilityPanel } from "@/modules/dashboard/components/member-panels";
import { ModuleNotice, PageHeading, Panel, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { RefreshButton } from "@/modules/dashboard/components/refresh-button";
import { Button } from "@/components/ui/button";
import { getBookingCalendar, getBookingSettings, getMyReservations } from "@/modules/reservations/services/queries";
import { MyReservationsView } from "@/modules/reservations/components/my-reservations";
import { WaitlistPanel } from "@/modules/waitlist/components/waitlist-panel";
export const metadata = { title: "Reservar gimnasio" };
export default async function GymPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const [calendar, profile, settings, reservations] = await Promise.all([getBookingCalendar(mes), getMemberProfile(), getBookingSettings(), getMyReservations()]);
  return <><PageHeading eyebrow="Muévete a tu ritmo" title="Tu momento en el gimnasio" description="Elige una fecha, consulta los cupos y confirma tu reserva." action={<Button asChild variant="outline"><Link href="/historial">Mis reservas</Link></Button>} />
    {settings.error ? <ReadError message={settings.error} /> : <ModuleNotice>{settings.data?.reservations_enabled ? `Las reservas se habilitan ${settings.data.booking_window_hours} horas antes del inicio. Puedes cancelar antes de que comience la franja. La ocupación puede cambiar hasta confirmar.` : "Las reservas están pausadas. Puedes consultar tus reservas y cancelar las que todavía no comienzan."}</ModuleNotice>}
    <div className="mt-6 grid items-start gap-5 lg:grid-cols-2"><Panel title="Calendario del gimnasio" description="Horarios y cupos en hora de Colombia." action={<RefreshButton />}>{calendar.slots.error ? <ReadError message={calendar.slots.error} /> : <><GymCalendar key={calendar.range.month} range={calendar.range} slots={calendar.slots.data ?? []} today={dayKey(new Date())} />{(calendar.slots.count ?? 0) > (calendar.slots.data?.length ?? 0) && <p className="mt-4 text-sm text-muted-foreground">Se muestran las primeras 500 franjas del mes.</p>}</>}</Panel><div className="space-y-5"><EligibilityPanel overview={profile} /><MyReservationsView data={reservations} summary /><WaitlistPanel result={calendar.waitlist} /></div></div>
  </>;
}
