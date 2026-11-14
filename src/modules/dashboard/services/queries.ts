import "server-only";
import { cache } from "react";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { dayRange, monthRange } from "../dates";

import { read } from "@/lib/supabase/read";

const reservationFields = "id, status, gym_slots!inner(id, starts_at, ends_at, status), attendance(checked_in_at, attendance_invalidations(invalidated_at))" as const;

export const getMemberProfile = cache(async () => {
  const viewer = await requirePermission("member");
  const { client } = await requireUser();
  const checkedAt = new Date().toISOString();
  const [profile, eligibility] = await Promise.all([
    read(client.from("profiles").select("affiliation_type, affiliation_types(label, is_active)").eq("id", viewer.user.id).eq("is_active", true).abortSignal(AbortSignal.timeout(10_000)).maybeSingle()),
    read(client.from("gym_eligibility").select("is_eligible, valid_from, valid_until").eq("user_id", viewer.user.id).abortSignal(AbortSignal.timeout(10_000)).maybeSingle()),
  ]);
  return { viewer, profile, eligibility, checkedAt };
});
export const getMemberReservations = cache(async () => {
  const viewer = await requirePermission("member");
  const { client } = await requireUser();
  const now = new Date().toISOString();
  const [next, history] = await Promise.all([
    read(client.from("reservations").select(reservationFields).eq("user_id", viewer.user.id).eq("status", "confirmed").gt("gym_slots.ends_at", now).neq("gym_slots.status", "cancelled").order("gym_slots(starts_at)", { ascending: true }).limit(1).abortSignal(AbortSignal.timeout(10_000))),
    read(client.from("reservations").select(reservationFields).eq("user_id", viewer.user.id).lt("gym_slots.ends_at", now).order("gym_slots(starts_at)", { ascending: false }).limit(5).abortSignal(AbortSignal.timeout(10_000))),
  ]);
  return { next, history };
});
export const getMemberOverview = cache(async () => {
  const [profile, reservations] = await Promise.all([getMemberProfile(), getMemberReservations()]);
  return { ...profile, ...reservations };
});
export type MemberOverview = Awaited<ReturnType<typeof getMemberOverview>>;
export type ReservationSummary = NonNullable<MemberOverview["history"]["data"]>[number];

export async function getCalendar(month?: string, includeCancelled = false) {
  await requirePermission(includeCancelled ? "admin" : "member");
  const { client } = await requireUser();
  const range = monthRange(month);
  let query = client.from("gym_slots").select("id, starts_at, ends_at, capacity, status", { count: "exact" })
    .gte("starts_at", range.start).lt("starts_at", range.end).order("starts_at").limit(500);
  if (!includeCancelled) query = query.neq("status", "cancelled");
  const slots = await read(query.abortSignal(AbortSignal.timeout(10_000)));
  return { range, slots };
}
export type CalendarData = Awaited<ReturnType<typeof getCalendar>>;

export async function getAdminOverview() {
  await requirePermission("admin");
  const { client } = await requireUser();
  const now = new Date();
  const range = dayRange(now);
  const [users, bookings, attendance, slots, availability] = await Promise.all([
    read(client.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true).abortSignal(AbortSignal.timeout(10_000))),
    read(client.from("reservations").select("id, gym_slots!inner(starts_at)", { count: "exact", head: true }).eq("status", "confirmed").gte("gym_slots.starts_at", range.start).lt("gym_slots.starts_at", range.end).abortSignal(AbortSignal.timeout(10_000))),
    read(client.from("attendance").select("reservation_id", { count: "exact", head: true }).gte("checked_in_at", range.start).lt("checked_in_at", range.end).abortSignal(AbortSignal.timeout(10_000))),
    read(client.from("gym_slots").select("id, starts_at, ends_at, capacity, status, reservations(count)", { count: "exact" }).gte("starts_at", range.start).lt("starts_at", range.end).eq("reservations.status", "confirmed").order("starts_at").limit(500).abortSignal(AbortSignal.timeout(10_000))),
    read(client.rpc("get_gym_slot_availability", { p_start: range.start, p_end: range.end }).abortSignal(AbortSignal.timeout(10_000))),
  ]);
  // Un resultado truncado nunca se presenta como un total completo.
  const complete = !availability.error && availability.data !== null && Number(availability.data[0]?.total_matches ?? 0) === availability.data.length;
  const available = complete ? availability.data!.filter((s) => s.status === "open" && new Date(s.starts_at).getTime() > new Date(s.observed_at).getTime())
    .reduce((sum, slot) => sum + slot.available, 0) : null;
  return { users, bookings, attendance, slots, available, availabilityError: availability.error, today: now.toISOString() };
}
export async function getAttendanceOverview() {
  await requirePermission("attendance");
  const { client } = await requireUser();
  const range = dayRange();
  return read(client.from("attendance").select("reservation_id", { count: "exact", head: true }).gte("checked_in_at", range.start).lt("checked_in_at", range.end).abortSignal(AbortSignal.timeout(10_000)));
}
