"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { notificationRulesSchema, waitlistMutationSchema, waitlistError, type WaitlistActionState } from "./contracts";
function invalidate() {
  for (const path of ["/notificaciones", "/gimnasio", "/historial", "/dashboard", "/admin", "/admin/horarios"]) revalidatePath(path);
  revalidatePath("/", "layout");
}
export async function mutateWaitlist(_state: WaitlistActionState, form: FormData): Promise<WaitlistActionState> {
  await requirePermission("member");
  const { client } = await requireUser();
  const parsed = waitlistMutationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "La solicitud no es válida. Actualiza la página." };
  const { operation, id } = parsed.data;
  try {
    if (operation === "accept" || operation === "decline") {
      const { data, error } = await client.rpc("respond_gym_waitlist_offer", { p_offer_id: id, p_accept: operation === "accept" });
      invalidate();
      if (error) return { status: "error", message: waitlistError(error) };
      const outcome = data?.[0]?.outcome;
      if (outcome === "accepted") return { status: "success", message: "Reserva confirmada. Ya puedes consultarla en Mis reservas." };
      if (outcome === "declined") return { status: "success", message: "Oferta rechazada. El cupo se ofrece a la siguiente persona." };
      return { status: "error", message: outcome === "expired" ? "La oferta venció y el cupo pasó a la siguiente persona." : "La oferta ya no está disponible. Consulta el estado de tu solicitud." };
    }
    const result = operation === "join" ? await client.rpc("join_gym_waitlist", { p_slot_id: id })
      : operation === "leave" ? await client.rpc("leave_gym_waitlist", { p_waitlist_id: id })
      : await client.rpc("mark_notification_read", { p_notification_id: id });
    invalidate();
    if (result.error) return { status: "error", message: waitlistError(result.error) };
    return { status: "success", message: operation === "join" ? "Ingresaste a la lista de espera. Te avisaremos aquí cuando tengas una oferta de cupo." : operation === "leave" ? "Saliste de la lista de espera." : "Notificación marcada como leída." };
  } catch { invalidate(); return { status: "error", message: waitlistError({}) }; }
}
export async function saveNotificationRules(_state: WaitlistActionState, form: FormData): Promise<WaitlistActionState> {
  await requirePermission("admin");
  const { client } = await requireUser();
  const parsed = notificationRulesSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Usa entre 1 y 30 minutos por oferta y entre 5 y 1440 minutos para el recordatorio." };
  try {
    const { error } = await client.rpc("admin_update_notification_rules", { p_offer_minutes: parsed.data.offerMinutes, p_reminders_enabled: parsed.data.reminders === "enabled", p_reminder_minutes: parsed.data.reminderMinutes });
    if (error) return { status: "error", message: waitlistError(error) };
    invalidate();
    return { status: "success", message: "Configuración guardada. Las ofertas vigentes conservan su vencimiento original." };
  } catch { return { status: "error", message: waitlistError({}) }; }
}
