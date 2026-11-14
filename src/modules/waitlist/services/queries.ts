import "server-only";
import { cache } from "react";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { read } from "@/lib/supabase/read";
export const getMyWaitlist = cache(async () => {
  await requirePermission("member");
  const { client } = await requireUser();
  return read(client.rpc("get_my_gym_waitlist").abortSignal(AbortSignal.timeout(10_000)));
});
export async function getNotifications(page = 1) {
  const viewer = await requirePermission("member");
  const { client } = await requireUser();
  return read(client.from("notifications").select("id, kind, created_at, read_at, offer_id, gym_slots(starts_at, ends_at)", { count: "exact" })
    .eq("user_id", viewer.user.id).order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1).abortSignal(AbortSignal.timeout(10_000)));
}
export async function getNotificationCount() {
  const { user, client } = await requireUser();
  return read(client.from("notifications").select("id", { head: true, count: "exact" }).eq("user_id", user.id).is("read_at", null).abortSignal(AbortSignal.timeout(10_000)));
}
export async function getNotificationSettings() {
  await requirePermission("admin");
  const { client } = await requireUser();
  return read(client.from("app_settings").select("waitlist_offer_minutes, reservation_reminders_enabled, reservation_reminder_minutes").eq("singleton", true).abortSignal(AbortSignal.timeout(10_000)).single());
}
