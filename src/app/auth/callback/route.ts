import { NextResponse, type NextRequest } from "next/server";
import { createClient, clearAuthCookies } from "@/lib/supabase/server";
import { parseAuthCallback } from "@/modules/auth/callback";
import { getAppOrigin } from "@/modules/auth/config";

export async function GET(request: NextRequest) {
  const params = parseAuthCallback(request.nextUrl.searchParams);
  let destination = "/login?estado=enlace-invalido";
  try {
    const origin = getAppOrigin();
    if (params) {
      const client = await createClient({ writable: true });
      const { error } = "code" in params
        ? await client.auth.exchangeCodeForSession(params.code, params.sb_flow_id ? { flowId: params.sb_flow_id } : undefined)
        : await client.auth.verifyOtp(params);
      if (!error) {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (user && !userError) destination = "/actualizar-contrasena";
        else await clearAuthCookies();
      }
    }
    // Origen de despliegue configurado; nunca se confía en forwarded-host o next.
    const response = NextResponse.redirect(new URL(destination, origin), 303);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    // Sin origen configurado se falla de forma cerrada, sin construir un destino
    // con cabeceras de procedencia no verificadas ni mostrar parámetros del enlace.
    return new NextResponse("No pudimos verificar el enlace. Regresa al inicio de sesión y solicita uno nuevo.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }
}
