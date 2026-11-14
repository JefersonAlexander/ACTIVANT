"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { assetSchema, contentSchema, libraryError, type ActionState } from "./contracts";
export async function saveContent(_state: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("admin"); const { client } = await requireUser();
  const parsed = contentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Revisa título, descripción, categoría, duración y archivos. Publicar requiere confirmar la autorización del material.", revision: _state.revision };
  const v = parsed.data;
  try {
    // SQL admite NULL en estos argumentos; el generador no conserva su nulabilidad.
    const { error } = await client.rpc("admin_save_wellness_content", { p_id: v.id!, p_revision: v.revision, p_title: v.title, p_description: v.description, p_category: v.category, p_duration_minutes: v.durationMinutes, p_cover_asset_id: v.coverAssetId!, p_video_asset_id: v.videoAssetId!, p_external_url: v.externalUrl!, p_status: v.status, p_authorized: v.authorized });
    if (error) return { status: "error", message: libraryError(error), revision: v.id ? v.revision : undefined };
    revalidatePath("/biblioteca", "layout"); revalidatePath("/admin/contenidos"); revalidatePath("/admin/auditoria");
    return { status: "success", revision: v.id ? v.revision + 1 : undefined, message: v.status === "published" ? "Contenido publicado en la biblioteca." : v.status === "archived" ? "Contenido archivado. Ya no aparece en la biblioteca." : "Borrador guardado. Solo los administradores pueden consultarlo." };
  } catch { return { status: "error", message: libraryError({}), revision: v.id ? v.revision : undefined }; }
}
export async function prepareAsset(input: unknown) {
  await requirePermission("admin"); const { client } = await requireUser();
  const parsed = assetSchema.safeParse(input);
  if (!parsed.success) return { error: "Portadas: JPG, PNG o WebP hasta 5 MB. Videos: MP4 o WebM hasta 100 MB." };
  try {
    const v = parsed.data;
    const { data, error } = await client.rpc("admin_prepare_wellness_asset", { p_kind: v.kind, p_mime_type: v.mimeType, p_size_bytes: v.sizeBytes });
    if (error || !data?.[0]) return { error: libraryError(error ?? {}) };
    return { id: data[0].id, objectPath: data[0].object_path };
  } catch { return { error: libraryError({}) }; }
}
export async function finalizeAsset(id: string) {
  await requirePermission("admin"); const { client } = await requireUser();
  if (!z.uuid().safeParse(id).success) return { error: "El archivo no es válido." };
  try { const { error } = await client.rpc("admin_finalize_wellness_asset", { p_asset_id: id }); if (error) return { error: libraryError(error) }; revalidatePath("/admin/contenidos"); return { success: true }; }
  catch { return { error: libraryError({}) }; }
}
