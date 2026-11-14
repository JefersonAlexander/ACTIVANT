import { supabaseEnvSchema } from "./env.ts";
import { appUrlSchema } from "../modules/auth/config.ts";
export function deploymentIssues(env: Record<string,string|undefined>) {
  const issues: string[] = [];
  if (!["development","test","production"].includes(env.APP_ENV ?? "")) issues.push("APP_ENV");
  const supabase = supabaseEnvSchema.safeParse(env);
  if (!supabase.success) issues.push(...supabase.error.issues.map(i=>String(i.path[0])));
  const origin = appUrlSchema.safeParse(env.APP_URL);
  if (!origin.success) issues.push("APP_URL");
  if (env.APP_ENV === "production") {
    if (origin.success && new URL(origin.data).protocol !== "https:") issues.push("APP_URL");
    if (supabase.success && new URL(supabase.data.NEXT_PUBLIC_SUPABASE_URL).protocol !== "https:") issues.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (env.SUPABASE_SECRET_KEY && !/^sb_secret_[^\s]{12,}$/.test(env.SUPABASE_SECRET_KEY)) issues.push("SUPABASE_SECRET_KEY");
  for (const [name,value] of Object.entries(env)) if (name.startsWith("NEXT_PUBLIC_") && value && (/sb_secret_|service_role|postgres(?:ql)?:\/\//i.test(value) || /SECRET|PASSWORD|PRIVATE|ACCESS_TOKEN/i.test(name))) issues.push(name);
  return [...new Set(issues)];
}
