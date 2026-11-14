import assert from "node:assert/strict";
import { test } from "node:test";
import { releaseSecrets, releaseIssues, sameSupabaseProject, childEnvironment, redactReleaseOutput, executeRelease } from "../../tools/deployment/release-policy.ts";

const env = {
  GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "JefersonAlexander/ACTIVANT", GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "push", GITHUB_SHA: "a".repeat(40), GITHUB_TOKEN: "github-fixture-only",
  SUPABASE_ACCESS_TOKEN: "sbp_fixture_0123456789012345", SUPABASE_PROJECT_ID: "abcdefghijklmnopqrst",
  SUPABASE_DB_PASSWORD: 'fixture-password-&/"value', VERCEL_TOKEN: "vercel-fixture-only-token",
  VERCEL_ORG_ID: "team_fixture_only", VERCEL_PROJECT_ID: "prj_fixtureOnly",
};

test("publicacion solo en main del repositorio autorizado, por push o ejecucion manual", () => {
  assert.deepEqual(releaseIssues(env), []);
  assert.deepEqual(releaseIssues({ ...env, GITHUB_EVENT_NAME: "workflow_dispatch" }), []);
  for (const override of [
    { GITHUB_REF: "refs/heads/preview" }, { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_EVENT_NAME: "pull_request_target" }, { GITHUB_REPOSITORY: "external/ACTIVANT" },
    { GITHUB_SHA: "invalid" }, { GITHUB_ACTIONS: "false" },
  ]) assert.ok(releaseIssues({ ...env, ...override }).includes("trusted_main_context"));
});

test("secretos ausentes o invalidos se informan por nombre, sin sus valores", () => {
  for (const name of releaseSecrets) assert.ok(releaseIssues({ ...env, [name]: "" }).includes(name));
  const issues = releaseIssues({ ...env, SUPABASE_PROJECT_ID: "https://wrong.invalid", SUPABASE_ACCESS_TOKEN: "wrong-sensitive-token" });
  assert.ok(issues.includes("SUPABASE_PROJECT_ID"));
  assert.ok(issues.includes("SUPABASE_ACCESS_TOKEN"));
  assert.ok(!JSON.stringify(issues).includes("wrong-sensitive-token"));
});

test("el proyecto de Vercel debe coincidir exactamente con el destino SQL", () => {
  const id = env.SUPABASE_PROJECT_ID;
  assert.equal(sameSupabaseProject(`https://${id}.supabase.co`, id), true);
  assert.equal(sameSupabaseProject(`https://${id}.supabase.co/`, id), true);
  for (const url of [`http://${id}.supabase.co`, "https://other.supabase.co", `https://${id}.supabase.co/path`, `https://${id}.supabase.co?key=x`]) {
    assert.equal(sameSupabaseProject(url, id), false);
  }
});

test("npm y Vercel no reciben las credenciales de migracion ni el token GitHub", () => {
  const build = childEnvironment(env, "build"), vercel = childEnvironment(env, "vercel"), database = childEnvironment(env, "supabase");
  for (const child of [build, vercel]) for (const name of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "GITHUB_TOKEN"]) assert.equal(child[name], undefined);
  assert.equal(vercel.VERCEL_ORG_ID, env.VERCEL_ORG_ID);
  assert.equal(database.SUPABASE_DB_PASSWORD, env.SUPABASE_DB_PASSWORD);
  assert.equal(database.VERCEL_TOKEN, undefined);
  assert.equal(database.GITHUB_TOKEN, undefined);
});

test("salida de herramientas oculta secretos literales, JSON y URL codificados", () => {
  const password = env.SUPABASE_DB_PASSWORD;
  const encoded = encodeURIComponent(password), json = JSON.stringify(password).slice(1, -1);
  const result = redactReleaseOutput([password, encoded, json, env.VERCEL_TOKEN].join("\n"), [password, env.VERCEL_TOKEN]);
  for (const value of [password, encoded, json, env.VERCEL_TOKEN]) assert.ok(!result.includes(value));
  assert.equal(result.split("[REDACTED]").length, 5);
});

function operations() {
  const events: string[] = [];
  return { events, steps: {
    isCurrent: async () => true,
    prepare: async () => { events.push("build"); },
    migrate: async () => { events.push("migrate"); },
    verify: async () => { events.push("verify"); },
    publish: async () => { events.push("publish"); },
  } };
}

test("un build fallido no modifica la base ni publica", async () => {
  const { events, steps } = operations();
  steps.prepare = async () => { events.push("build"); throw new Error("fixture build failure"); };
  await assert.rejects(executeRelease(steps), /build failure/);
  assert.deepEqual(events, ["build"]);
});

test("una migracion fallida o verificacion rechazada impiden publicar", async () => {
  for (const failure of ["migrate", "verify"] as const) {
    const { events, steps } = operations();
    steps[failure] = async () => { events.push(failure); throw new Error("fixture failure"); };
    await assert.rejects(executeRelease(steps), /fixture failure/);
    assert.equal(events.includes("publish"), false);
    assert.deepEqual(events, failure === "migrate" ? ["build", "migrate"] : ["build", "migrate", "verify"]);
  }
});

test("un commit reemplazado antes de SQL no migra; reemplazado despues no publica", async () => {
  for (const stopAt of [1, 2, 3]) {
    const { events, steps } = operations(); let check = 0;
    steps.isCurrent = async () => ++check !== stopAt;
    const result = await executeRelease(steps);
    assert.equal(result.published, false);
    assert.equal(result.migrated, stopAt === 3);
    assert.deepEqual(events, stopAt === 1 ? [] : stopAt === 2 ? ["build"] : ["build", "migrate", "verify"]);
  }
});

test("solo se publica despues del build, SQL y verificaciones aprobadas", async () => {
  const { events, steps } = operations();
  assert.deepEqual(await executeRelease(steps), { published: true, migrated: true });
  assert.deepEqual(events, ["build", "migrate", "verify", "publish"]);
});
