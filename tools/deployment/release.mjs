import { spawn } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { releaseSecrets, releaseIssues, sameSupabaseProject, childEnvironment, redactReleaseOutput, executeRelease } from "./release-policy.ts";

const env = process.env;
const secrets = [...releaseSecrets, "GITHUB_TOKEN"].map(name => env[name]).filter(Boolean);
const output = value => console.log(redactReleaseOutput(String(value), secrets));
async function summary(text) {
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, redactReleaseOutput(text, secrets) + "\n");
}

async function command(label, executable, args, scope) {
  output(label);
  const child = spawn(executable, args, { env: childEnvironment(env, scope), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  // Acumular evita filtrar secretos divididos entre dos chunks de stdout/stderr.
  const chunks = []; let size = 0, overflow = false;
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => {
    size += chunk.length;
    if (size > 16 * 1024 * 1024) { overflow = true; child.kill(); }
    else chunks.push(chunk);
  });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  if (overflow) throw new Error(`${label}: salida demasiado extensa; no se publica su contenido.`);
  const log = Buffer.concat(chunks).toString("utf8");
  if (log.trim()) output(log);
  if (code !== 0) throw new Error(`${label}: la herramienta termino con error.`);
  return log.trim();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(30000) });
  let body;
  try { body = await response.json(); } catch { throw new Error("Respuesta remota no valida; no se muestra su contenido."); }
  return { response, body };
}

async function isCurrent() {
  const { response, body } = await fetchJson("https://api.github.com/repos/JefersonAlexander/ACTIVANT/git/ref/heads/main", {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!response.ok) throw new Error(`No se pudo verificar main en GitHub: HTTP ${response.status}.`);
  return body.object?.sha === env.GITHUB_SHA;
}

let productionEnv;
async function prepare() {
  await command("Instalar dependencias fijadas del aplicativo", "npm", ["ci"], "build");
  await command("Obtener configuracion Production de Vercel", "vercel", ["pull", "--yes", "--environment=production", "--token", env.VERCEL_TOKEN], "vercel");
  productionEnv = parseEnv(await readFile(".vercel/.env.production.local", "utf8"));
  for (const [name, value] of Object.entries(productionEnv)) if (/SECRET|TOKEN|PASSWORD/.test(name) && value) secrets.push(value);
  const { deploymentIssues } = await import("../../src/lib/deployment.ts");
  const issues = deploymentIssues(productionEnv);
  if (productionEnv.APP_ENV !== "production") issues.push("APP_ENV");
  if (!sameSupabaseProject(productionEnv.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_PROJECT_ID)) issues.push("NEXT_PUBLIC_SUPABASE_URL/project_id");
  for (const name of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"]) if (productionEnv[name]) issues.push(`${name}: quitar de Vercel`);
  if (issues.length) throw new Error(`Revisa las variables Production de Vercel: ${[...new Set(issues)].join(", ")}.`);
  await command("Compilar el commit probado con variables de produccion", "vercel", ["build", "--prod", "--token", env.VERCEL_TOKEN], "vercel");
}

async function migrate() {
  await command("Vincular el proyecto Supabase configurado", "supabase", ["link", "--project-ref", env.SUPABASE_PROJECT_ID], "supabase");
  await command("Revisar migraciones pendientes", "supabase", ["db", "push", "--remote", "--dry-run"], "supabase");
  await command("Aplicar migraciones pendientes sin fixtures", "supabase", ["db", "push", "--remote", "--yes"], "supabase");
  await command("Verificar historial de migraciones", "supabase", ["migration", "list", "--remote"], "supabase");
}

async function verify() {
  const url = new URL(productionEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
  const headers = { apikey: productionEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
  const settings = await fetchJson(`${url}/auth/v1/settings`, { headers });
  if (!settings.response.ok || settings.body.disable_signup !== true) throw new Error("Desactiva Allow new users to sign up en Supabase Auth antes de publicar.");
  const profile = await fetchJson(`${url}/rest/v1/profiles?select=id&limit=0`, { headers });
  if (profile.body?.code !== "42501") throw new Error("No se confirmo la denegacion anonima de profiles; revisar migraciones y permisos.");
  const rpc = await fetchJson(`${url}/rest/v1/rpc/get_my_point_summary`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" });
  if (rpc.body?.code !== "42501") throw new Error("No se confirmo la denegacion anonima de la RPC privada; revisar migraciones y permisos.");
  output("Auth sin registro publico y contratos privados sin acceso anonimo verificados. No se leen datos personales.");
}

try {
  const issues = releaseIssues(env);
  if (issues.length) throw new Error(`Faltan secretos o contexto valido: ${issues.join(", ")}.`);
  if (process.argv.includes("--check-env")) output("Los seis secretos estan presentes y el contexto corresponde a main. No se muestran valores ni se conecta a servicios.");
  else {
    if (!env.GITHUB_TOKEN) throw new Error("Falta GITHUB_TOKEN para comprobar la revision de main.");
    const outcome = await executeRelease({ isCurrent, prepare, migrate, verify, publish: async () => {
      await command("Publicar el artefacto ya compilado en Vercel", "vercel", ["deploy", "--prebuilt", "--prod", "--yes", "--token", env.VERCEL_TOKEN], "vercel");
    } });
    if (outcome.published) await summary(`ACTIVANT: commit ${env.GITHUB_SHA} compilado, migraciones pendientes aplicadas y Vercel publicado. La validacion Auth autenticada, SMTP y camaras fisicas sigue siendo una comprobacion separada.`);
    else await summary(`ACTIVANT: no se publico una revision sustituida de main. Migraciones ejecutadas en esta pasada: ${outcome.migrated ? "si" : "no"}. La ejecucion del commit vigente continuara el proceso.`);
  }
} catch (error) {
  const message = redactReleaseOutput(error instanceof Error ? error.message : "Fallo de publicacion.", secrets);
  console.error(message);
  await summary(`ACTIVANT no completo la publicacion: ${message}. Si SQL ya se aplico, conservar historial y corregir hacia adelante; no ejecutar db reset.`);
  process.exitCode = 1;
}
