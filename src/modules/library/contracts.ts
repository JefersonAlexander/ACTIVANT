import { z } from "zod";
export const libraryCategories = { rutinas: "Rutinas de actividad física", clases: "Clases virtuales", movilidad: "Ejercicios de movilidad", pausas: "Pausas activas", casa: "Actividades en casa" } as const;
export const categorySchema = z.enum(["rutinas", "clases", "movilidad", "pausas", "casa"]);
const optionalId = z.union([z.uuid(), z.literal("")]).transform(v => v || null);
export const authorizedUrlSchema = z.union([z.literal(""), z.url().max(2048).refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && /^[a-z0-9.-]+$/i.test(url.hostname) && !/[\s\u0000-\u001f]/.test(value);
}, "Utiliza un enlace HTTPS sin credenciales.")]).transform(v => v ? new URL(v).toString() : null);
export const contentSchema = z.object({
  id: optionalId, revision: z.coerce.number().int().min(0), title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000), category: categorySchema,
  durationMinutes: z.coerce.number().int().min(1).max(600), coverAssetId: optionalId, videoAssetId: optionalId,
  externalUrl: authorizedUrlSchema, status: z.enum(["draft", "published", "archived"]),
  authorized: z.enum(["yes"]).optional().transform(v => v === "yes"),
}).refine(v => !(v.videoAssetId && v.externalUrl), { message: "Selecciona video o enlace, no ambos." })
  .refine(v => v.status !== "published" || !!(v.coverAssetId && (v.videoAssetId || v.externalUrl) && v.authorized), { message: "Para publicar se requieren portada, recurso y autorización." });
export const assetSchema = z.object({ kind: z.enum(["cover", "video"]), mimeType: z.string(), sizeBytes: z.number().int().positive() })
  .refine(v => v.kind === "cover" ? ["image/jpeg", "image/png", "image/webp"].includes(v.mimeType) && v.sizeBytes <= 5 * 1024 ** 2 : ["video/mp4", "video/webm"].includes(v.mimeType) && v.sizeBytes <= 100 * 1024 ** 2);
export type ActionState = { status: "idle" | "success" | "error"; message: string; revision?: number };
export const initialActionState: ActionState = { status: "idle", message: "" };
export function libraryError(error: { details?: string | null; code?: string }) {
  const messages: Record<string, string> = { content_conflict: "Otra persona modificó este contenido. Actualiza antes de guardar.", cover_required: "Selecciona una portada que haya terminado de cargar.", video_required: "Selecciona un video que haya terminado de cargar.", upload_incomplete: "La carga todavía no está completa. Verifica el archivo e intenta confirmar nuevamente.", invalid_media: "El archivo no coincide con el tipo o el tamaño permitido.", authorization_required: "Confirma la autorización institucional antes de publicar." };
  if (error.details && Object.hasOwn(messages, error.details)) return messages[error.details]!;
  if (error.code === "42501") return "Se requiere un administrador activo para gestionar contenidos.";
  return "No pudimos guardar el contenido o el archivo. Revisa los campos y actualiza antes de reintentar.";
}
