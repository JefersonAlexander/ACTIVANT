"use server";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { attendanceMessage, manualAttendanceSchema, qrPayloadSchema, type AttendanceResult, type DisplayQrResult } from "./contracts";
function refreshAttendance() {
 for (const path of ["/asistencia", "/historial", "/dashboard", "/admin", "/control-asistencia"]) revalidatePath(path);
}
export async function issueDisplayQr(): Promise<DisplayQrResult> {
 await requirePermission("attendance");
 const { client } = await requireUser();
 try {
  const { data, error } = await client.rpc("issue_gym_display_qr").abortSignal(AbortSignal.timeout(10_000));
  const row = data?.[0];
  if (error || !row) return { status: "error", message: attendanceMessage("unavailable") };
  if (row.outcome!=="ok") return { status: "error", message: attendanceMessage(row.outcome) };
  if (!/^[0-9a-f]{64}$/.test(row.token)) return { status: "error", message: attendanceMessage("unavailable") };
  // La imagen se entrega en la respuesta privada de la acción; nunca en una URL.
  const image = await QRCode.toDataURL(`ACTIVANT:GYM:1:${row.token}`, { width: 480, margin: 4, errorCorrectionLevel: "M" });
  return { status: "ok", image, expiresAt: row.expires_at, serverNow: row.server_now, startsAt: row.starts_at, endsAt: row.ends_at };
 } catch { return { status: "error", message: attendanceMessage("unavailable") }; }
}
export async function registerQrAttendance(payload: string): Promise<AttendanceResult> {
 await requirePermission("member");
 const { client } = await requireUser();
 // Se limita el tamaño, pero también los códigos malformados consumen el límite SQL.
 const token = typeof payload === "string" && payload.length<=128 && qrPayloadSchema.safeParse(payload).success ? payload.slice(15) : "invalid";
 try {
  const { data, error } = await client.rpc("check_in_gym_qr", { p_token: token }).abortSignal(AbortSignal.timeout(10_000));
  refreshAttendance();
  const row = data?.[0];
  if (error || !row) return { status: "error", message: attendanceMessage("unavailable") };
  if (row.outcome!=="ok") return { status: "error", message: attendanceMessage(row.outcome) };
  return { status: "success", message: "Asistencia registrada. ¡Disfruta tu entrenamiento!", checkedInAt: row.checked_in_at };
 } catch { refreshAttendance(); return { status: "error", message: attendanceMessage("unavailable") }; }
}
export async function registerManualAttendance(_state: AttendanceResult, form: FormData): Promise<AttendanceResult> {
 await requirePermission("attendance");
 const { client } = await requireUser();
 const parsed = manualAttendanceSchema.safeParse(Object.fromEntries(form));
 if (!parsed.success) return { status: "error", message: "Revisa el código de la reserva y selecciona un motivo de excepción." };
 try {
  const { data, error } = await client.rpc("record_gym_manual_attendance", { p_reservation_id: parsed.data.reservationId, p_reason: parsed.data.reason }).abortSignal(AbortSignal.timeout(10_000));
  refreshAttendance();
  const row = data?.[0];
  if (error || !row) return { status: "error", message: attendanceMessage("unavailable") };
  return row.outcome==="ok" ? { status: "success", message: "Asistencia manual registrada y auditada.", checkedInAt: row.checked_in_at } : { status: "error", message: attendanceMessage(row.outcome) };
 } catch { refreshAttendance(); return { status: "error", message: attendanceMessage("unavailable") }; }
}
