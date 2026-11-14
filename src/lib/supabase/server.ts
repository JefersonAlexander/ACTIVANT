import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";
import { authCookieOptions, isAuthCookie } from "./cookie-options";
import type { Database } from "./database.types";

// Instancia por petición. Los Server Components solo leen cookies: proxy.ts
// renueva la sesión antes del render. Acciones y callbacks usan writable: true.
export async function createClient({ writable = false } = {}) {
  // Leer primero la API dinámica evita intentar autenticar durante el prerender.
  const store = await cookies();
  const env = getSupabaseEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll: () => store.getAll(),
        setAll(cookiesToSet) {
          if (!writable) return;
          // Las respuestas de estas rutas reciben no-store desde proxy.ts.
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        },
      },
    },
  );
}

export async function clearAuthCookies() {
  const store = await cookies();
  for (const { name } of store.getAll()) {
    if (isAuthCookie(name)) store.set(name, "", { path: "/", sameSite: "lax", secure: authCookieOptions.secure, maxAge: 0 });
  }
}
