import { z } from "zod";
export const waitlistMutationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("join"), id: z.uuid() }),
  z.object({ operation: z.literal("leave"), id: z.uuid() }),
  z.object({ operation: z.literal("accept"), id: z.uuid() }),
  z.object({ operation: z.literal("decline"), id: z.uuid() }),
  z.object({ operation: z.literal("read"), id: z.uuid() }),
]);
export const notificationRulesSchema = z.object({
  offerMinutes: z.coerce.number().int().min(1).max(30),
  reminders: z.enum(["enabled", "disabled"]),
  reminderMinutes: z.coerce.number().int().min(5).max(1440),
});
export type WaitlistActionState = { status: "idle" | "success" | "error"; message: string };
export const initialWaitlistState: WaitlistActionState = { status: "idle", message: "" };
const errors: Record<string, string> = {
  not_eligible: "Tu habilitación no está vigente o no cubre la franja completa.",
  access_restricted: "Tienes una suspensión o restricción para esta franja.",
  already_reserved: "Ya tienes una reserva confirmada para esta franja.",
  bookings_paused: "Las reservas están pausadas por el equipo de bienestar.",
  window_not_open: "La ventana de reservas todavía no está abierta.",
  slot_started: "La franja ya comenzó.", slot_closed: "La franja está cerrada.",
  seats_available: "Hay cupos disponibles. Actualiza el calendario y reserva directamente.",
  waitlist_priority: "Este cupo está ofrecido a la lista de espera.",
  offer_response_required: "Acepta o rechaza tu oferta desde Notificaciones y espera.",
};
export function waitlistError(error: { code?: string; details?: string | null }) {
  if (error.details && Object.hasOwn(errors, error.details)) return errors[error.details]!;
  if (error.code === "23505") return "Ya tienes una solicitud en esta lista de espera. Actualiza la página.";
  if (error.code === "42501") return "No tienes autorización o habilitación para realizar esta operación.";
  return "No pudimos confirmar la operación. Actualiza la página antes de intentar nuevamente.";
}
export const notificationLabels: Record<string, string> = {
  reservation_confirmed: "Reserva confirmada", reservation_cancelled: "Reserva cancelada",
  waitlist_offer: "Tienes un cupo disponible", waitlist_expired: "Tu oferta de cupo venció",
  waitlist_unavailable: "La solicitud dejó de estar disponible", reservation_reminder: "Tu próxima reserva se acerca",
};
