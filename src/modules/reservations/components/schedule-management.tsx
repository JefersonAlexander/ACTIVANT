import { requirePermission } from "@/modules/auth/server";
import { getCalendar } from "@/modules/dashboard/services/queries";
import { dayKey, formatDate, formatTime } from "@/modules/dashboard/dates";
import { GymCalendar } from "@/modules/dashboard/components/gym-calendar";
import { PageHeading, Panel, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { getBookingSettings } from "../services/queries";
import { getNotificationSettings } from "@/modules/waitlist/services/queries";
import { NotificationRulesForm } from "@/modules/waitlist/components/waitlist-controls";
import { BookingRulesForm, GymSlotForm } from "./schedule-forms";
export async function ScheduleManagement({ month }: { month?: string }) {
  await requirePermission("admin");
  const [calendar, settings, notifications] = await Promise.all([getCalendar(month, true), getBookingSettings(), getNotificationSettings()]);
  return <><PageHeading eyebrow="Administración" title="Horarios" description="Publica franjas, ajusta su capacidad y administra las condiciones de reserva." />
    <div className="grid items-start gap-5 xl:grid-cols-2"><Panel title="Condiciones de reserva">{settings.error || !settings.data ? <ReadError message={settings.error ?? "No se encontró la configuración."} /> : <BookingRulesForm windowHours={settings.data.booking_window_hours} defaultCapacity={settings.data.default_slot_capacity} enabled={settings.data.reservations_enabled} />}</Panel><Panel title="Nueva franja">{settings.data ? <GymSlotForm defaultCapacity={settings.data.default_slot_capacity} /> : <p className="text-sm text-muted-foreground">Actualiza la configuración para crear una franja.</p>}</Panel></div>
    <div className="mt-6"><Panel title="Lista de espera y notificaciones">{notifications.error || !notifications.data ? <ReadError message={notifications.error ?? "No se encontró la configuración."} /> : <NotificationRulesForm offerMinutes={notifications.data.waitlist_offer_minutes} reminders={notifications.data.reservation_reminders_enabled} reminderMinutes={notifications.data.reservation_reminder_minutes} />}</Panel></div>
    <div className="mt-6 grid items-start gap-5 xl:grid-cols-2"><Panel title="Calendario del gimnasio">{calendar.slots.error ? <ReadError message={calendar.slots.error} /> : <GymCalendar key={calendar.range.month} range={calendar.range} slots={calendar.slots.data ?? []} today={dayKey(new Date())} basePath="/admin/horarios" />}</Panel><Panel title="Editar franjas del mes" description="Abre una franja para cambiar su capacidad o estado.">{calendar.slots.error ? <ReadError message={calendar.slots.error} /> : <><ul className="divide-y">{calendar.slots.data?.map((slot) => <li key={slot.id}><details className="py-3"><summary className="min-h-11 cursor-pointer rounded-lg py-3 text-sm font-semibold">{formatDate(slot.starts_at)} · {formatTime(slot.starts_at)} – {formatTime(slot.ends_at)} · capacidad {slot.capacity}</summary><div className="pt-4"><GymSlotForm slot={slot} defaultCapacity={slot.capacity} /></div></details></li>)}</ul>{!calendar.slots.data?.length && <p className="text-sm text-muted-foreground">No hay franjas publicadas este mes.</p>}{(calendar.slots.count ?? 0) > (calendar.slots.data?.length ?? 0) && <p className="mt-4 text-sm text-muted-foreground">Se muestran las primeras 500 franjas del mes.</p>}</>}</Panel></div>
  </>;
}
