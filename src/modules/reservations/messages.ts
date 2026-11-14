export type ReservationActionState = { status: "idle" | "success" | "error"; message: string };
export const initialReservationState: ReservationActionState = { status: "idle", message: "" };
export const bookingReasons: Record<string, string> = {
  not_eligible: "Tu habilitación no está vigente o no cubre la franja completa. Consulta al equipo de bienestar.",
  access_restricted: "Tienes una suspensión o restricción de acceso vigente para esta reserva.",
  already_reserved: "Ya tienes una reserva activa para esta franja.",
  bookings_paused: "Las reservas están pausadas por el equipo de bienestar.",
  slot_closed: "Esta franja está cerrada.",
  slot_started: "La franja ya comenzó. No admite esta operación.",
  window_not_open: "La ventana de reserva aún no está abierta.",
  slot_full: "Esta franja está completa. Puedes consultar la lista de espera o elegir otro horario.",
  offer_response_required: "Tienes un cupo ofrecido. Acéptalo o recházalo en Notificaciones y espera.",
  waitlist_priority: "El cupo está ofrecido a la lista de espera. Consulta la disponibilidad actual.",
  capacity_below_holds: "La capacidad debe cubrir las reservas y las ofertas de cupo vigentes.",
  waitlist_slot_history: "No se puede cambiar el horario de una franja con historial de lista de espera.",
  attendance_recorded: "No puedes cancelar una reserva con asistencia registrada.",
};
export function reservationError(error: { code?: string; details?: string | null }) {
  if (error.details && Object.hasOwn(bookingReasons, error.details)) return bookingReasons[error.details]!;
  if (error.code === "23505") return bookingReasons.already_reserved!;
  if (error.code === "42501") return "No tienes autorización o habilitación para realizar esta operación.";
  if (error.code === "23503") return "La franja o la reserva ya no está disponible.";
  if (error.code === "23P01") return "El horario se cruza con otra franja publicada.";
  if (error.code === "23514" || error.code === "22004") return "Revisa el horario y la capacidad. No se pueden modificar franjas con reservas incompatibles.";
  return "No pudimos confirmar la operación. Actualiza tus reservas antes de intentar nuevamente.";
}
