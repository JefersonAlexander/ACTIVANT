import { PageHeading, Panel, ReadError, DestinationLink } from "@/modules/dashboard/components/dashboard-ui";
import { BookingRulesForm } from "@/modules/reservations/components/schedule-forms";
import { getBookingSettings } from "@/modules/reservations/services/queries";
import { getNotificationSettings } from "@/modules/waitlist/services/queries";
import { NotificationRulesForm } from "@/modules/waitlist/components/waitlist-controls";
import { getProgramAdmin } from "@/modules/program/services/queries";
import { RulesForm } from "@/modules/program/components/program-forms";
import { dayKey } from "@/modules/dashboard/dates";
export async function ConfigurationPage() {
  const [booking, notifications, program] = await Promise.all([getBookingSettings(), getNotificationSettings(), getProgramAdmin()]);
  const [year, month] = dayKey(new Date()).slice(0,7).split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year!, month!, 1)).toISOString().slice(0,7);
  return <><PageHeading eyebrow="Administración" title="Configuración de reglas" description="Condiciones administrables del gimnasio y del programa. Los cambios se validan y auditan en la base de datos." /><div className="grid items-start gap-6 xl:grid-cols-2"><Panel title="Reservas y capacidad predeterminada">{booking.error || !booking.data ? <ReadError message={booking.error ?? "Configuración no disponible."} /> : <BookingRulesForm windowHours={booking.data.booking_window_hours} defaultCapacity={booking.data.default_slot_capacity} enabled={booking.data.reservations_enabled} />}</Panel><Panel title="Lista de espera y recordatorios">{notifications.error || !notifications.data ? <ReadError message={notifications.error ?? "Configuración no disponible."} /> : <NotificationRulesForm offerMinutes={notifications.data.waitlist_offer_minutes} reminders={notifications.data.reservation_reminders_enabled} reminderMinutes={notifications.data.reservation_reminder_minutes} />}</Panel><Panel title="Reglas de puntos y constancia" description="Las versiones futuras entran en vigor por mes; los periodos abiertos conservan su versión.">{program.rules.error ? <ReadError message={program.rules.error} /> : program.rules.data?.[0] ? <RulesForm rules={program.rules.data[0]} nextMonth={nextMonth} /> : <p className="text-sm">No se encontró una versión de reglas.</p>}</Panel><div className="space-y-4"><DestinationLink href="/admin/horarios" description="Crear y editar franjas, horarios y capacidad por franja." /><DestinationLink href="/admin/constancia" description="Calendario hábil, justificaciones y ajustes auditados." /><DestinationLink href="/control-asistencia" description="Registro de ingreso, QR y cierre conciliado de asistencia." /></div></div></>;
}
