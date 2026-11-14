import { z } from "zod";
export const qrPayloadSchema = z.string().regex(/^ACTIVANT:GYM:1:[0-9a-f]{64}$/);
export const manualReasons = {
  camera_unavailable: "Cámara no disponible",
  device_unavailable: "Sin dispositivo disponible",
  connectivity: "Problema de conectividad",
  accessibility: "Apoyo de accesibilidad",
} as const;
export const manualAttendanceSchema = z.object({ reservationId: z.uuid(), reason: z.enum(["camera_unavailable", "device_unavailable", "connectivity", "accessibility"]) });
export type AttendanceResult = { status: "idle" | "success" | "error"; message: string; checkedInAt?: string };
export type DisplayQrResult = { status: "ok"; image: string; expiresAt: string; serverNow: string; startsAt: string; endsAt: string } | { status: "error"; message: string };
const messages: Record<string,string> = {
 invalid_qr: "Este código no es válido. Escanea el QR de la pantalla del gimnasio.",
 expired_qr: "El QR expiró o dejó de estar disponible. Escanea el nuevo código de la pantalla.",
 no_reservation: "No tienes una reserva para esta franja. Consulta Mis reservas o solicita ayuda al personal.",
 reservation_cancelled: "La reserva está cancelada y no admite asistencia.",
 already_recorded: "La asistencia de esta reserva ya está registrada. Puedes consultarla en tu historial.",
 outside_window: "La asistencia solo puede registrarse durante el horario de la reserva.",
 not_eligible: "Tu habilitación para el gimnasio no está vigente. Consulta al personal autorizado.",
 access_restricted: "Tienes una restricción de acceso vigente. Consulta al personal autorizado.",
 inactive_account: "Tu cuenta no está activa. Contacta al administrador.",
 rate_limited: "Has realizado demasiados intentos. Espera un minuto antes de volver a intentar; si continúa, consulta al personal.",
 no_current_slot: "No hay una franja en curso. El QR estará disponible durante el horario del gimnasio.",
 invalid_reason: "Selecciona el motivo del registro manual.",
};
export function attendanceMessage(outcome: string) {
 return Object.hasOwn(messages,outcome) ? messages[outcome]! : "No pudimos confirmar la operación. Revisa el historial antes de intentar nuevamente.";
}
