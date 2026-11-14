// Guardas de la herramienta de publicacion. No se importan desde el aplicativo.
export const releaseSecrets = [
  "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID", "SUPABASE_DB_PASSWORD",
  "VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID",
] as const;
type Environment = Record<string, string | undefined>;

export function releaseIssues(env: Environment): string[] {
  const issues: string[] = releaseSecrets.filter(name => !env[name]?.trim());
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== "JefersonAlexander/ACTIVANT" ||
    env.GITHUB_REF !== "refs/heads/main" || !["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME ?? "") ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "")) issues.push("trusted_main_context");
  if (env.SUPABASE_ACCESS_TOKEN && !/^sbp_[A-Za-z0-9_-]{12,}$/.test(env.SUPABASE_ACCESS_TOKEN)) issues.push("SUPABASE_ACCESS_TOKEN");
  if (env.SUPABASE_PROJECT_ID && !/^[a-z0-9]{20}$/.test(env.SUPABASE_PROJECT_ID)) issues.push("SUPABASE_PROJECT_ID");
  if (env.VERCEL_PROJECT_ID && !/^prj_[A-Za-z0-9]+$/.test(env.VERCEL_PROJECT_ID)) issues.push("VERCEL_PROJECT_ID");
  if (env.VERCEL_ORG_ID && !/^[A-Za-z0-9_-]{10,100}$/.test(env.VERCEL_ORG_ID)) issues.push("VERCEL_ORG_ID");
  if (env.VERCEL_TOKEN && /\s/.test(env.VERCEL_TOKEN)) issues.push("VERCEL_TOKEN");
  return [...new Set(issues)];
}

export function sameSupabaseProject(url: string | undefined, projectId: string): boolean {
  return url === `https://${projectId}.supabase.co` || url === `https://${projectId}.supabase.co/`;
}

// No entregar credenciales de migracion al build, npm o CLI de Vercel.
export function childEnvironment(env: Environment, scope: "build" | "supabase" | "vercel"): Environment {
  const result = { ...env };
  for (const name of [...releaseSecrets, "GITHUB_TOKEN"]) delete result[name];
  if (scope === "supabase") for (const name of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"]) result[name] = env[name];
  if (scope === "vercel") for (const name of ["VERCEL_ORG_ID", "VERCEL_PROJECT_ID"]) result[name] = env[name];
  return result;
}

export function redactReleaseOutput(value: string, secrets: readonly string[]): string {
  let result = value;
  const variants = secrets.filter(Boolean).flatMap(secret => [secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)])
    .sort((a, b) => b.length - a.length);
  for (const secret of variants) result = result.split(secret).join("[REDACTED]");
  return result;
}

type ReleaseOperations = {
  isCurrent: () => Promise<boolean>;
  prepare: () => Promise<void>;
  migrate: () => Promise<void>;
  verify: () => Promise<void>;
  publish: () => Promise<void>;
};

// Si falla cualquier etapa, no se ejecuta la siguiente ni se revierte SQL a ciegas.
export async function executeRelease(operations: ReleaseOperations) {
  if (!await operations.isCurrent()) return { published: false, migrated: false };
  await operations.prepare();
  if (!await operations.isCurrent()) return { published: false, migrated: false };
  await operations.migrate();
  await operations.verify();
  if (!await operations.isCurrent()) return { published: false, migrated: true };
  await operations.publish();
  return { published: true, migrated: true };
}
