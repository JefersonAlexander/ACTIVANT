"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { localDateTimeToUtc } from "@/modules/reservations/schemas";
import { getAppOrigin } from "@/modules/auth/config";
import { adminMutationSchema, administrativeError, invitationSchema } from "./contracts";
import { invitationsConfigured, sendAdministrativeInvitation } from "./services/invitations";
import type { ActionState } from "@/modules/library/contracts";
export async function mutateAdministration(_state: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("admin"); const { client } = await requireUser();
  const parsed = adminMutationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Revisa el usuario, las fechas y los valores seleccionados." };
  const v = parsed.data;
  if (v.operation === "eligibility" && v.validUntil && v.validUntil <= v.validFrom) return { status: "error", message: "La vigencia final debe ser posterior al inicio." };
  try {
    const result = v.operation === "profile" ? await client.rpc("admin_set_profile_access", { p_user_id: v.userId, p_is_active: v.active === "true", p_affiliation_type: v.affiliation || null! })
      : v.operation === "role" ? await client.rpc("admin_set_user_role", { p_user_id: v.userId, p_role: v.role, p_enabled: v.enabled === "true" })
      : await client.rpc("admin_set_gym_eligibility", { p_user_id: v.userId, p_is_eligible: v.eligible === "true", p_valid_from: localDateTimeToUtc(v.validFrom), p_valid_until: v.validUntil ? localDateTimeToUtc(v.validUntil) : undefined });
    if (result.error) return { status: "error", message: administrativeError(result.error) };
    revalidatePath("/", "layout");
    return { status: "success", message: v.operation === "profile" ? "Estado y vinculación actualizados y auditados." : v.operation === "role" ? "Permisos actualizados y auditados." : "Habilitación del gimnasio actualizada y auditada." };
  } catch { return { status: "error", message: administrativeError({}) }; }
}
export async function inviteUser(_state: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("admin"); const { client } = await requireUser();
  const parsed = invitationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Ingresa un correo válido y actualiza el formulario si la solicitud no es válida." };
  if (!invitationsConfigured()) return { status: "error", message: "El operador debe configurar la clave de Auth Admin en el servidor para enviar invitaciones." };
  const { requestId, email } = parsed.data;
  // Registro previo + idempotencia: una respuesta perdida nunca reenvía automáticamente.
  try {
    const begin = await client.rpc("admin_begin_invitation", { p_request_id: requestId, p_email: email });
    if (begin.error) return { status: "error", message: administrativeError(begin.error) };
    if (!begin.data) return { status: "error", message: "Esta solicitud ya fue procesada o sigue pendiente. Consulta su estado antes de volver a invitar." };
    const result = await sendAdministrativeInvitation(email, `${getAppOrigin()}/auth/callback`);
    const status = result.error ? "failed" : result.data.user ? "sent" : "uncertain";
    const finish = await client.rpc("admin_finish_invitation", { p_request_id: requestId, p_status: status, p_user_id: result.data.user?.id });
    revalidatePath("/admin/usuarios"); revalidatePath("/admin/auditoria");
    if (finish.error || status === "uncertain") return { status: "error", message: "No pudimos confirmar el resultado. Revisa la solicitud y Supabase Auth antes de reintentar." };
    if (status === "failed") return { status: "error", message: "Supabase no confirmó la invitación. Revisa si la cuenta ya existe o la configuración de correo antes de reintentar." };
    return { status: "success", message: "Invitación solicitada a Supabase Auth. El perfil nace inactivo; habilítalo y asigna su vinculación tras verificar la identidad." };
  } catch {
    await client.rpc("admin_finish_invitation", { p_request_id: requestId, p_status: "uncertain" }).then(() => {}, () => {});
    revalidatePath("/admin/usuarios");
    return { status: "error", message: "El resultado del envío es incierto. Verifica Supabase Auth antes de iniciar otra solicitud." };
  }
}
