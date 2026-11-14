import "server-only";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { read } from "@/lib/supabase/read";
import { dayRange } from "@/modules/dashboard/dates";
export async function getAttendanceHistory(page=1, staff=false) {
 const viewer = await requirePermission(staff ? "attendance" : "member");
 const { client } = await requireUser();
 let query = client.from("attendance").select("reservation_id, checked_in_at, method, manual_reason, attendance_invalidations(invalidated_at), reservations!inner(user_id, gym_slots!inner(starts_at, ends_at))", { count: "exact" });
 if (staff) { const range=dayRange(); query=query.gte("checked_in_at",range.start).lt("checked_in_at",range.end); }
 else query=query.eq("reservations.user_id",viewer.user.id);
 return { result: await read(query.order("checked_in_at",{ascending:false}).order("reservation_id").range((page-1)*10,page*10-1).abortSignal(AbortSignal.timeout(10_000))), page, staff };
}
export async function getCurrentReservations() {
 await requirePermission("attendance");
 const { client } = await requireUser();
 const now=new Date().toISOString();
 return read(client.from("reservations").select("id, gym_slots!inner(starts_at, ends_at), attendance(checked_in_at, attendance_invalidations(invalidated_at))", { count: "exact" }).eq("status","confirmed").lte("gym_slots.starts_at",now).gt("gym_slots.ends_at",now).order("created_at").limit(100).abortSignal(AbortSignal.timeout(10_000)));
}
export type AttendanceHistoryData = Awaited<ReturnType<typeof getAttendanceHistory>>;
