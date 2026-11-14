import "server-only";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { monthRange } from "@/modules/dashboard/dates";
import { read, type ReadResult } from "@/lib/supabase/read";
import type { CalendarSlot } from "../types";
import { getMyWaitlist } from "@/modules/waitlist/services/queries";

export async function getBookingCalendar(month?: string) {
  await requirePermission("member");
  const { client } = await requireUser();
  const range = monthRange(month);
  const [result, waitlist] = await Promise.all([read(client.rpc("get_gym_slot_availability", { p_start: range.start, p_end: range.end }).abortSignal(AbortSignal.timeout(10_000))), getMyWaitlist()]);
  const slots: ReadResult<CalendarSlot[]> = { error: result.error, count: result.data?.[0]?.total_matches ?? 0, data: result.data?.map((s) => ({
    id: s.slot_id, starts_at: s.starts_at, ends_at: s.ends_at, capacity: s.capacity, status: s.status,
    waitlist: waitlist.error ? undefined : waitlist.data?.find(w => w.slot_id === s.slot_id && w.status === "waiting") ?? null,
    availability: { occupied: s.occupied, available: s.available, canBook: s.can_book, reason: s.blocking_reason, opensAt: s.booking_opens_at, reservationId: s.reservation_id, observedAt: s.observed_at },
  })) ?? null };
  return { range, slots, waitlist };
}
export async function getBookingSettings() {
  await requirePermission("member");
  const { client } = await requireUser();
  return read(client.from("app_settings").select("booking_window_hours, reservations_enabled, default_slot_capacity").eq("singleton", true).abortSignal(AbortSignal.timeout(10_000)).single());
}
export async function getMyReservations(page = 1) {
  const viewer = await requirePermission("member");
  const { client } = await requireUser();
  const now = new Date().toISOString();
  const fields = "id, status, created_at, gym_slots!inner(id, starts_at, ends_at, status), attendance(checked_in_at, attendance_invalidations(invalidated_at))" as const;
  const [active, history] = await Promise.all([
    read(client.from("reservations").select(fields, { count: "exact" }).eq("user_id", viewer.user.id).eq("status", "confirmed").gt("gym_slots.ends_at", now).order("gym_slots(starts_at)").limit(50).abortSignal(AbortSignal.timeout(10_000))),
    read(client.from("reservations").select(fields, { count: "exact" }).eq("user_id", viewer.user.id).order("created_at", { ascending: false }).order("id").range((page - 1) * 10, page * 10 - 1).abortSignal(AbortSignal.timeout(10_000))),
  ]);
  return { active, history, observedAt: now, page };
}
export type MyReservations = Awaited<ReturnType<typeof getMyReservations>>;
