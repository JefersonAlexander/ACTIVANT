import { z } from "zod";
const localMinute = z.iso.datetime({ local: true, precision: -1 }).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
export const adminMutationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("profile"), userId: z.uuid(), active: z.enum(["true", "false"]), affiliation: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/).or(z.literal("")) }),
  z.object({ operation: z.literal("role"), userId: z.uuid(), role: z.enum(["admin", "gym_staff"]), enabled: z.enum(["true", "false"]) }),
  z.object({ operation: z.literal("eligibility"), userId: z.uuid(), eligible: z.enum(["true", "false"]), validFrom: localMinute, validUntil: z.union([localMinute, z.literal("")]) }),
]);
export const invitationSchema = z.object({ requestId: z.uuid(), email: z.string().trim().toLowerCase().max(254).pipe(z.email()) });
export const reportFiltersSchema = z.object({
  desde: z.iso.date(), hasta: z.iso.date(), franja: z.union([z.uuid(), z.literal("")]).default(""),
}).refine(v => v.hasta >= v.desde && (Date.parse(v.hasta) - Date.parse(v.desde)) / 86400000 <= 92, "Selecciona entre 1 y 93 días.");
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export type SearchParams = Record<string, string | string[] | undefined>;
export function parseReportFilters(params: SearchParams, today: string) {
  return reportFiltersSchema.safeParse({ desde: params.desde ?? `${today.slice(0,7)}-01`, hasta: params.hasta ?? today, franja: params.franja ?? "" });
}
export function pageNumber(value: unknown) { return typeof value === "string" && /^\d{1,4}$/.test(value) ? Math.max(1, Number(value)) : 1; }
const number = z.number().nonnegative().finite();
export const reportSchema = z.object({
  observed_at: z.string(), total_slots: number,
  summary: z.object({ reservations: number, cancellations: number, attendances: number, absences: number, pending_reviews: number, demand: number, capacity: number, utilization_percent: number.nullable(), participants: number, recurrent_users: number }),
  slots: z.array(z.object({ id: z.uuid(), starts_at: z.string(), ends_at: z.string(), report_day: z.string(), status: z.string(), capacity: number, confirmed: number, cancelled: number, effective_attendances: number, absences: number, pending_reviews: number, demand: number, held: number, occupancy_percent: number, utilization_percent: number.nullable() })),
  daily: z.array(z.object({ report_day: z.string(), attendances: number, cancellations: number, participants: number })),
  hourly: z.array(z.object({ start_time: z.string(), slots: number, demand: number, attendances: number })),
});
export type GymReport = z.infer<typeof reportSchema>;
export function administrativeError(error: { code?: string; details?: string | null }) {
  if (error.details === "invitation_limit") return "Revisa las invitaciones recientes. La solicitud ya está en proceso o alcanzaste el límite de envíos.";
  if (error.code === "42501") return "No tienes autorización para modificar tu propio acceso o gestionar esta información.";
  return "No pudimos completar la operación. Revisa los campos y actualiza antes de reintentar.";
}
