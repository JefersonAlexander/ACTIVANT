import "server-only";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { read } from "@/lib/supabase/read";
import { reportSchema, type ReportFilters } from "../contracts";
export function filterRange(filters: ReportFilters) {
  const start = `${filters.desde}T00:00:00-05:00`;
  return { start, end: new Date(Date.parse(`${filters.hasta}T00:00:00-05:00`) + 86400000).toISOString() };
}
export async function getUsers(search = "", page = 1) {
  await requirePermission("admin"); const { client } = await requireUser();
  return read(client.rpc("admin_list_activant_users", { p_search: search.slice(0,120), p_page: page }).abortSignal(AbortSignal.timeout(10_000)));
}
export async function getAffiliations() {
  await requirePermission("admin"); const { client } = await requireUser();
  return read(client.from("affiliation_types").select("code,label,is_active").order("label").abortSignal(AbortSignal.timeout(10_000)));
}
export async function getAdministrativeReservations(filters: ReportFilters, page = 1) {
  await requirePermission("admin"); const { client } = await requireUser(); const range = filterRange(filters);
  let query = client.from("reservations").select("id,user_id,status,created_at,cancelled_at,gym_slots!inner(id,starts_at,ends_at),attendance(checked_in_at,attendance_invalidations(invalidated_at))", { count: "exact" }).gte("gym_slots.starts_at", range.start).lt("gym_slots.starts_at", range.end);
  if (filters.franja) query = query.eq("slot_id", filters.franja);
  return read(query.order("created_at", { ascending: false }).order("id").range((page-1)*20,page*20-1).abortSignal(AbortSignal.timeout(10_000)));
}
export async function getFilterSlots(filters: ReportFilters) {
  await requirePermission("admin"); const { client } = await requireUser(); const range = filterRange(filters);
  return read(client.from("gym_slots").select("id,starts_at,ends_at").gte("starts_at",range.start).lt("starts_at",range.end).order("starts_at").limit(500).abortSignal(AbortSignal.timeout(10_000)));
}
export async function getGymReport(filters: ReportFilters) {
  await requirePermission("admin"); const { client } = await requireUser();
  const result = await read(client.rpc("admin_get_gym_report", { p_start: filters.desde, p_end: filters.hasta, p_slot_id: filters.franja || undefined }).abortSignal(AbortSignal.timeout(20_000)));
  const parsed = result.error ? null : reportSchema.safeParse(result.data);
  if (!parsed?.success) return { data: null, error: result.error ?? "No pudimos interpretar los indicadores. Actualiza la consulta." };
  return { data: parsed.data, error: null };
}
export async function getAudit(filters: ReportFilters, page = 1, exportAll = false) {
  await requirePermission("admin"); const { client } = await requireUser();
  // Selección deliberada: los reportes no exportan valores antiguos/nuevos ni datos privados.
  const size = exportAll ? 5000 : 30;
  const result = await read(client.rpc("admin_read_audit", { p_start: filters.desde, p_end: filters.hasta, p_slot_id: filters.franja || undefined, p_page: page, p_limit: size }).abortSignal(AbortSignal.timeout(15_000)));
  return { ...result, count: result.error ? null : Number(result.data?.[0]?.total_matches ?? 0) };
}
export async function getInvitations() {
  await requirePermission("admin"); const { client } = await requireUser();
  return read(client.from("admin_invitation_requests").select("id,email,status,created_at,user_id").order("created_at", { ascending: false }).limit(10).abortSignal(AbortSignal.timeout(10_000)));
}
export type AdministrativeUser = NonNullable<Awaited<ReturnType<typeof getUsers>>["data"]>[number];
