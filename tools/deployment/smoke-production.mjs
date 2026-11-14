// Servidor real standalone, datos sintéticos y solo HTTP en loopback.
import assert from "node:assert/strict";
import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const checks = [];
async function assertNoEnv(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!/^\.(env|evn)/.test(entry.name), "Archivo de entorno incluido en standalone");
    if (entry.isDirectory()) await assertNoEnv(`${directory}/${entry.name}`);
  }
}
await assertNoEnv(".next/standalone");
checks.push("El artefacto standalone excluye archivos .env/.evn");
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
await cp("public", ".next/standalone/public", { recursive: true });
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  env: { ...process.env, NODE_ENV: "production", APP_ENV: "production", PORT: "3001", HOSTNAME: "127.0.0.1",
    APP_URL: "https://activant.example.invalid", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only_not_a_real_key", SUPABASE_SECRET_KEY: "" },
  stdio: "ignore", windowsHide: true,
});
let spawnError;
child.on("error", error => { spawnError = error.code; });
const stopped = new Promise(resolve => child.once("close", resolve));
try {
  let response;
  for (let attempt = 0; attempt < 60; attempt++) {
    assert.ok(!spawnError && child.exitCode === null, "El servidor standalone no inició");
    try { response = await fetch("http://127.0.0.1:3001", { signal: AbortSignal.timeout(2000) }); if (response.ok) break; } catch { /* arranque */ }
    await delay(500);
  }
  assert.equal(response?.status, 200);
  checks.push("Portada en servidor standalone de producción: HTTP 200");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-powered-by"), null);
  checks.push("Cabeceras de seguridad y HSTS del perfil de producción");
  const html = await response.text();
  const asset = html.match(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+\.css)"/);
  assert.ok(asset, "No se encontró el CSS compilado");
  assert.equal((await fetch(new URL(asset[1], "http://127.0.0.1:3001"))).status, 200);
  checks.push("CSS compilado servido desde el artefacto standalone");
  const denied = await fetch("http://127.0.0.1:3001/admin", { redirect: "manual" });
  assert.ok([303, 307].includes(denied.status));
  assert.match(denied.headers.get("location") ?? "", /\/login/);
  assert.match(denied.headers.get("cache-control") ?? "", /no-store/);
  checks.push("Ruta administrativa sin sesión redirige a login sin caché compartida");
  const callback = await fetch("http://127.0.0.1:3001/auth/callback?type=signup&token_hash=fixture", { redirect: "manual" });
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get("referrer-policy"), "no-referrer");
  assert.match(callback.headers.get("cache-control") ?? "", /no-store/);
  assert.ok(!callback.headers.get("location")?.includes("token_hash"));
  checks.push("Callback no permitido conserva no-referrer y elimina parámetros sensibles");
  assert.equal((await fetch("http://127.0.0.1:3001/inexistente" )).status, 404);
  checks.push("Ruta inexistente: HTTP 404");
  await mkdir("artifacts/audit", { recursive: true });
  await writeFile("artifacts/audit/standalone-smoke.json", JSON.stringify({ executed_at: new Date().toISOString(), scope: "Loopback HTTP; perfil producción; sin usuarios ni SQL remoto; no valida TLS del proveedor ni Docker", checks }, null, 2) + "\n");
  checks.forEach(check => console.log(`PASS: ${check}`));
} finally { child.kill(); await stopped; }
