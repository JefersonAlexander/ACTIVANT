import "server-only";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { read } from "@/lib/supabase/read";
export async function getLibrary({ category, search, page = 1, admin = false }: { category?: string; search?: string; page?: number; admin?: boolean } = {}) {
  await requirePermission(admin ? "admin" : "member"); const { client } = await requireUser();
  let query = client.from("wellness_contents").select("*", { count: "exact" });
  if (!admin) query = query.eq("status", "published");
  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("title", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  return read(query.order("updated_at", { ascending: false }).order("id").range((page - 1) * 12, page * 12 - 1).abortSignal(AbortSignal.timeout(10_000)));
}
export async function getContent(id: string) {
  await requirePermission("member"); const { client } = await requireUser();
  return read(client.from("wellness_contents").select("*").eq("id", id).abortSignal(AbortSignal.timeout(10_000)).maybeSingle());
}
export async function getLibraryAccess() {
  await requirePermission("member"); const { client } = await requireUser();
  return read(client.rpc("get_wellness_library_access").abortSignal(AbortSignal.timeout(10_000)));
}
export async function getLibraryAssets() {
  await requirePermission("admin"); const { client } = await requireUser();
  return read(client.from("wellness_assets").select("id,kind,mime_type,created_at").eq("status", "ready").order("created_at", { ascending: false }).limit(100).abortSignal(AbortSignal.timeout(10_000)));
}
export type LibraryContent = NonNullable<Awaited<ReturnType<typeof getLibrary>>["data"]>[number];
export type LibraryAsset = NonNullable<Awaited<ReturnType<typeof getLibraryAssets>>["data"]>[number];
