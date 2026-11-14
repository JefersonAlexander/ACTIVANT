import assert from "node:assert/strict";
import { test } from "node:test";
import { getSupabaseEnv, supabaseEnvSchema } from "../../src/lib/env.ts";

// Valores sintéticos exclusivos de pruebas; no son credenciales de un proyecto.
const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only_not_a_real_key",
};

test("acepta configuración pública y Supabase local", () => {
  assert.equal(supabaseEnvSchema.safeParse(validEnv).success, true);
  assert.equal(supabaseEnvSchema.safeParse({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }).success, true);
});

test("rechaza configuración ausente, URL inválida y HTTP remoto", () => {
  assert.equal(supabaseEnvSchema.safeParse({}).success, false);
  for (const url of ["not-a-url", "http://example.supabase.co", "ftp://example.com", "https://user:secret@example.supabase.co", "https://example.supabase.co/rest/v1", "https://example.supabase.co/?key=secret", "https://example.supabase.co/#secret"]) {
    assert.equal(supabaseEnvSchema.safeParse({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: url }).success, false);
  }
});

test("impide pasar una clave secreta por el campo publicable", () => {
  assert.equal(supabaseEnvSchema.safeParse({ ...validEnv, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test_only_not_a_real_key" }).success, false);
});

test("informa los campos faltantes sin revelar su contenido", () => {
  const urlBefore = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyBefore = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const sensitiveValue = "sb_secret_test_value_must_not_be_logged";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = sensitiveValue;
  try {
    assert.throws(() => getSupabaseEnv(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_URL/);
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
      assert.equal(error.message.includes(sensitiveValue), false);
      return true;
    });
  } finally {
    if (urlBefore === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = urlBefore;
    if (keyBefore === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = keyBefore;
  }
});
