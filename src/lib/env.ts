import { z } from "zod";

export const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().pipe(z.string().refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" &&
      (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  }, "Usa el origen HTTPS de Supabase o un origen HTTP local, sin credenciales ni rutas.")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().startsWith("sb_publishable_").min(20),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

// Lectura explícita para permitir que Next.js incluya las variables públicas
// en el navegador. La validación es diferida: la portada no requiere Supabase.
export function getSupabaseEnv(): SupabaseEnv {
  const result = supabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Configura correctamente ${fields.join(", ")} en .env.local. Consulta .env.example.`);
  }

  return result.data;
}

export function isSupabaseConfigured(): boolean {
  return supabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }).success;
}
