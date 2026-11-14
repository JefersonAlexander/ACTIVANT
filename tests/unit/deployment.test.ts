import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentIssues } from "../../src/lib/deployment.ts";
import { safeErrorEvent } from "../../src/lib/observability.ts";
import nextConfig from "../../next.config.ts";
const env={APP_ENV:"production",APP_URL:"https://activant.example.invalid",NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture_only_valid_shape"};
test("producción exige orígenes HTTPS y perfil explícito; no filtra secretos por variables públicas",()=>{
 assert.deepEqual(deploymentIssues(env),[]);
 assert.ok(deploymentIssues({...env,APP_URL:"http://localhost:3000"}).includes("APP_URL"));
 assert.ok(deploymentIssues({...env,APP_ENV:""}).includes("APP_ENV"));
 assert.ok(deploymentIssues({...env,NEXT_PUBLIC_DATABASE_PASSWORD:"fixture-sensitive"}).includes("NEXT_PUBLIC_DATABASE_PASSWORD"));
 assert.deepEqual(deploymentIssues({...env,APP_ENV:"test",APP_URL:"http://127.0.0.1:3000",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54322"}),[]);
});
test("telemetría conserva solo patrón, categoría y digest numérico, sin identidad ni secretos",()=>{
 const secret="sb_secret_fixture_sensitive";
 const event=safeErrorEvent({message:secret,stack:secret,digest:"123456",headers:{authorization:secret}},"/biblioteca/[id]","render");
 assert.deepEqual(event,{event:"activant.server_error",route:"/biblioteca/[id]",type:"render",digest:"123456"});
 assert.equal(JSON.stringify(safeErrorEvent({digest:secret},`/auth/callback?token=${secret}`,"arbitrary")).includes(secret),false);
});

test("HSTS se emite solamente con perfil de producción, sin imponer subdominios", async () => {
 const previous = process.env.APP_ENV;
 try {
  for (const profile of ["development", "test", "production"]) {
   process.env.APP_ENV = profile;
   const rules = await nextConfig.headers!();
   const hsts = rules[0]!.headers.find((header) => header.key === "Strict-Transport-Security");
   assert.equal(hsts?.value, profile === "production" ? "max-age=31536000" : undefined);
  }
 } finally {
  if (previous === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = previous;
 }
});
