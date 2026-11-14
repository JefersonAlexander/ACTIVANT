import { isPrivatePath } from "@/config/navigation";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/env";
import { authCookieOptions, isAuthCookie } from "./cookie-options";
import type { Database } from "./database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const privateRoute = isPrivatePath(request.nextUrl.pathname) ||
    request.nextUrl.pathname === "/actualizar-contrasena";
  const protectResponse = (result: NextResponse) => {
    result.headers.set("Cache-Control", "private, no-store, max-age=0");
    result.headers.set("Pragma", "no-cache");
    result.headers.set("Expires", "0");
    // Un POST nativo con no-referrer envía Origin:null y Next rechaza la acción.
    // same-origin conserva el origen interno y omite referencias a otros sitios.
    result.headers.set("Referrer-Policy", request.nextUrl.pathname === "/auth/callback" ? "no-referrer" : "same-origin");
    return result;
  };
  const toLogin = (status: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("estado", status);
    const destination = NextResponse.redirect(url, 303);
    // Conservar cookies renovadas/borradas también en las redirecciones.
    for (const cookie of response.cookies.getAll()) destination.cookies.set(cookie);
    return protectResponse(destination);
  };
  if (!isSupabaseConfigured()) {
    return privateRoute ? toLogin("configuracion-no-disponible") : protectResponse(response);
  }
  const env = getSupabaseEnv();
  const client = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        const previous = response.cookies.getAll();
        response = NextResponse.next({ request });
        for (const cookie of previous) response.cookies.set(cookie);
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  const hadSession = request.cookies.getAll().some(({ name }) => isAuthCookie(name) && !name.includes("code-verifier"));
  try {
    // getUser fuerza verificación con Supabase Auth y renueva tokens cuando procede.
    const { data: { user }, error } = await client.auth.getUser();
    if (!user && privateRoute) {
      const unavailable = error && (error.status === 0 || (error.status ?? 0) >= 500);
      if (hadSession && !unavailable) {
        for (const { name } of request.cookies.getAll()) {
          if (isAuthCookie(name)) response.cookies.set(name, "", { path: "/", sameSite: "lax", secure: authCookieOptions.secure, maxAge: 0 });
        }
      }
      return toLogin(unavailable ? "servicio-no-disponible" : hadSession ? "sesion-expirada" : "inicia-sesion");
    }
  } catch {
    if (privateRoute) return toLogin("servicio-no-disponible");
  }
  return protectResponse(response);
}
