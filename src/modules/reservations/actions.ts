"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { bookingRulesSchema, gymSlotSchema, localDateTimeToUtc, reservationMutationSchema } from "./schemas";
import { reservationError, type ReservationActionState } from "./messages";

function invalidateReservations() {
  revalidatePath("/", "layout");
  for (const path of ["/gimnasio", "/historial", "/dashboard", "/admin", "/admin/horarios", "/notificaciones"]) revalidatePath(path);
}
export async function mutateReservation(_state: ReservationActionState, formData: FormData): Promise<ReservationActionState> {
  const { client } = await requireUser();
  const parsed = reservationMutationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "La solicitud no es válida. Actualiza la página e intenta nuevamente." };
  if (parsed.data.operation === "reserve") await requirePermission("member");
  // El UUID del usuario procede exclusivamente de auth.uid() dentro de PostgreSQL.
  try {
    const result = parsed.data.operation === "reserve"
      ? await client.rpc("reserve_gym_slot", { p_slot_id: parsed.data.id })
      : await client.rpc("cancel_gym_reservation", { p_reservation_id: parsed.data.id });
    invalidateReservations(); // También resuelve una respuesta perdida seguida de un reintento.
    if (result.error) return { status: "error", message: reservationError(result.error) };
    return { status: "success", message: parsed.data.operation === "reserve" ? "Tu reserva quedó confirmada. Ya puedes verla en Mis reservas." : "Reserva cancelada. El cupo ya está disponible." };
  } catch {
    invalidateReservations();
    return { status: "error", message: reservationError({}) };
  }
}
export async function saveBookingRules(_state: ReservationActionState, formData: FormData): Promise<ReservationActionState> {
  await requirePermission("admin");
  const { client } = await requireUser();
  const parsed = bookingRulesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Usa una ventana entre 1 y 168 horas y una capacidad entera mayor que cero." };
  try {
    const { error } = await client.rpc("admin_update_booking_rules", { p_window_hours: parsed.data.windowHours, p_enabled: parsed.data.enabled === "enabled", p_default_capacity: parsed.data.defaultCapacity });
    if (error) return { status: "error", message: reservationError(error) };
    invalidateReservations();
    return { status: "success", message: "Condiciones de reserva actualizadas. La capacidad predeterminada aplica a nuevas franjas." };
  } catch { return { status: "error", message: reservationError({}) }; }
}
export async function saveGymSlot(_state: ReservationActionState, formData: FormData): Promise<ReservationActionState> {
  await requirePermission("admin");
  const { client } = await requireUser();
  const input = Object.fromEntries(formData);
  if (!input.id) delete input.id;
  const parsed = gymSlotSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Revisa las fechas, la capacidad y el estado. La finalización debe ser posterior al inicio." };
  const value = parsed.data;
  try {
    const result = value.id
      ? await client.rpc("admin_update_gym_slot", { p_slot_id: value.id, p_starts_at: localDateTimeToUtc(value.startsAt), p_ends_at: localDateTimeToUtc(value.endsAt), p_capacity: value.capacity, p_status: value.status })
      : await client.rpc("admin_create_gym_slot", { p_starts_at: localDateTimeToUtc(value.startsAt), p_ends_at: localDateTimeToUtc(value.endsAt), p_capacity: value.capacity });
    if (result.error) return { status: "error", message: reservationError(result.error) };
    invalidateReservations();
    return { status: "success", message: value.id ? "Franja actualizada." : "Franja creada y publicada." };
  } catch { return { status: "error", message: reservationError({}) }; }
}
