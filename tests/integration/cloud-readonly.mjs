// Integración REAL de solo lectura: usa un proyecto Supabase Cloud, nunca el doble HTTP.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const file = process.env.ACTIVANT_ENV_FILE ?? ".env.local";
let env;
try { env = { ...parseEnv(await readFile(file, "utf8")), ...process.env }; }
catch { console.error("Falta el archivo de entorno. No se ejecutaron pruebas de nube."); process.exitCode = 2; }
if (env) {
 const checks = [];
 const record = (name, status, detail) => { checks.push({ name, status, detail }); console.log(`${status}: ${name} — ${detail}`); };
 let url;
 try { url = new URL(env.NEXT_PUBLIC_SUPABASE_URL); } catch { /* validación cerrada */ }
 if (!url || url.protocol !== "https:" || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) {
  record("Configuración de Cloud", "blocked", "Revisa URL y clave publicable. No se muestran sus valores.");
 } else {
  const client = createClient(url.origin, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const results = await Promise.allSettled([
   (async () => {
    const response = await fetch(`${url.origin}/auth/v1/settings`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(15000) });
    record("Conexión real con Supabase Auth", response.ok ? "passed" : "failed", `HTTP ${response.status}`);
    if (!response.ok) return;
    const settings = await response.json();
    record("Registro público deshabilitado", settings.disable_signup === true ? "passed" : settings.disable_signup === false ? "failed" : "blocked", settings.disable_signup === true ? "Auth informa disable_signup=true." : "Verifica Allow new users to sign up en el proyecto antes de desplegar.");
   })(),
   (async () => {
    const result = await client.from("profiles").select("id").limit(0).abortSignal(AbortSignal.timeout(15000));
    record("Tabla profiles y denegación anónima", result.error?.code === "42501" ? "passed" : result.status === 0 || result.error?.code === "PGRST205" ? "blocked" : "failed", `HTTP ${result.status}; código ${result.error?.code ?? "sin error"}. Consulta sin filas; no se leen datos personales.`);
   })(),
   (async () => {
    const result = await client.rpc("get_my_point_summary").abortSignal(AbortSignal.timeout(15000));
    record("RPC privada deniega acceso anónimo", result.error?.code === "42501" ? "passed" : result.status === 0 || result.error?.code === "PGRST202" ? "blocked" : "failed", `HTTP ${result.status}; código ${result.error?.code ?? "sin error"}.`);
   })(),
  ]);
  results.forEach((result, index) => { if (result.status === "rejected") record(`Conectividad de comprobación ${index+1}`, "blocked", "La solicitud no pudo completarse. No se registra URL, clave ni cuerpo de error."); });
 }
 record("Integración autenticada y transaccional Cloud", "blocked", "Requiere migraciones y cuentas sintéticas de usuario, personal y administrador en un proyecto de pruebas. No se crean usuarios ni datos desde este preflight.");
 await mkdir("artifacts/audit", { recursive: true });
 await writeFile("artifacts/audit/cloud-readonly.json", JSON.stringify({ executed_at: new Date().toISOString(), mode: "real-cloud-readonly", project_fingerprint: url ? createHash("sha256").update(url.hostname).digest("hex").slice(0,12) : null, checks }, null, 2)+"\n");
 process.exitCode = checks.some(c => c.status === "failed") ? 1 : checks.some(c => c.status === "blocked") ? 2 : 0;
}
