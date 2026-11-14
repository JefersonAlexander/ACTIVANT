import { z } from "zod";
export const reservationMutationSchema = z.object({ operation: z.enum(["reserve", "cancel"]), id: z.uuid() });
export const bookingRulesSchema = z.object({
  windowHours: z.coerce.number().int().min(1).max(168),
  defaultCapacity: z.coerce.number().int().min(1).max(2147483647),
  enabled: z.enum(["enabled", "paused"]),
});
const localMinute = z.iso.datetime({ local: true, precision: -1 }).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
export const gymSlotSchema = z.object({
  id: z.uuid().optional(),
  startsAt: localMinute,
  endsAt: localMinute,
  capacity: z.coerce.number().int().min(1).max(2147483647),
  status: z.enum(["open", "closed", "cancelled"]).default("open"),
}).refine((value) => value.endsAt > value.startsAt, { message: "La finalización debe ser posterior al inicio.", path: ["endsAt"] });
// Los datetime-local del formulario siempre representan hora de Colombia.
export function localDateTimeToUtc(value: string) { return new Date(`${value}:00-05:00`).toISOString(); }
export function utcToLocalDateTime(value: string) { return new Date(new Date(value).getTime() - 5 * 3600000).toISOString().slice(0, 16); }
