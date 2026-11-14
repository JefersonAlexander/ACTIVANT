import { z } from "zod";
import { requirePermission, requireUser } from "@/modules/auth/server";
import { getSupabaseEnv } from "@/lib/env";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cross-Origin-Resource-Policy": "same-origin" };
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("member"); const { client } = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Archivo no encontrado.", { status: 404, headers: privateHeaders });
  const range = request.headers.get("range");
  if (range && !/^bytes=(?:\d{1,12}-\d{0,12}|-\d{1,12})$/.test(range)) return new Response("Rango no permitido.", { status: 416, headers: privateHeaders });
  const { data: asset, error } = await client.from("wellness_assets").select("object_path,mime_type,status").eq("id", id).maybeSingle();
  if (error) return new Response("No pudimos consultar el archivo.", { status: 503, headers: privateHeaders });
  if (!asset || asset.status !== "ready") return new Response("Archivo no encontrado.", { status: 404, headers: privateHeaders });
  // Identidad ya verificada con getUser(). Este token solo se reenvía a Storage,
  // que vuelve a validarlo y aplica RLS; getSession() no concede autorización.
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) return new Response("La sesión expiró.", { status: 401, headers: privateHeaders });
  const env = getSupabaseEnv();
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/authenticated/activant-wellness/${asset.object_path.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const result = await fetch(url, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}`, ...(range ? { Range: range } : {}) }, cache: "no-store", redirect: "error", signal: request.signal });
    if (result.status === 416) return new Response("Rango no disponible.", { status: 416, headers: privateHeaders });
    if (!result.ok) return new Response("Archivo no disponible.", { status: result.status >= 500 ? 503 : 404, headers: privateHeaders });
    const headers = new Headers({ ...privateHeaders, "Content-Type": asset.mime_type, "Content-Disposition": "inline", "Accept-Ranges": "bytes" });
    for (const name of ["Content-Length", "Content-Range"]) { const value = result.headers.get(name); if (value) headers.set(name, value); }
    return new Response(result.body, { status: result.status, headers });
  } catch { return new Response("No pudimos abrir el archivo.", { status: 503, headers: privateHeaders }); }
}
