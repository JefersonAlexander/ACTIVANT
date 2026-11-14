import assert from "node:assert/strict";
import { test } from "node:test";
import { loginSchema, recoverySchema, passwordSchema } from "../../src/modules/auth/schemas.ts";
import { parseAuthCallback } from "../../src/modules/auth/callback.ts";
import { appUrlSchema } from "../../src/modules/auth/config.ts";
import { authErrorMessage, getAuthNotice } from "../../src/modules/auth/messages.ts";
import { isAuthCookie } from "../../src/lib/supabase/cookie-options.ts";

test("login normaliza el correo y preserva la contraseña original", () => {
  const result = loginSchema.parse({ email: "  PERSONA@example.test  ", password: " short " });
  assert.deepEqual(result, { email: "persona@example.test", password: " short " });
  assert.equal(loginSchema.safeParse({ email: "incorrecto", password: "" }).success, false);
  assert.equal(recoverySchema.safeParse({ email: "persona@example.test" }).success, true);
});

test("la nueva contraseña exige longitud y confirmación coincidente", () => {
  for (const [password, confirmPassword] of [["short", "short"], ["long-enough-password", "different"], ["x".repeat(129), "x".repeat(129)]]) {
    assert.equal(passwordSchema.safeParse({ password, confirmPassword }).success, false);
  }
  assert.equal(passwordSchema.safeParse({ password: "a-long-test-passphrase", confirmPassword: "a-long-test-passphrase" }).success, true);
});

test("callback admite recuperación/invitación y rechaza registro o parámetros ambiguos", () => {
  assert.deepEqual(parseAuthCallback(new URLSearchParams("token_hash=test-token&type=recovery")), { token_hash: "test-token", type: "recovery" });
  assert.deepEqual(parseAuthCallback(new URLSearchParams("token_hash=test-token&type=invite")), { token_hash: "test-token", type: "invite" });
  assert.deepEqual(parseAuthCallback(new URLSearchParams("code=test-code&next=https://attacker.invalid")), { code: "test-code" });
  for (const query of ["", "token_hash=x&type=signup", "token_hash=x&type=email", "code=a&code=b", "code=a&token_hash=b&type=recovery", "error=denied&code=a", "code=a&sb_flow_id=invalid!", "code=a&sb_flow_id=flow12345&sb_flow_id=flow23456", "token_hash=x&type=invite&type=recovery"]) {
    assert.equal(parseAuthCallback(new URLSearchParams(query)), null);
  }
});

test("el origen canónico rechaza cabeceras/URLs inseguras o destinos con ruta", () => {
  for (const value of ["https://activant.example.test", "http://localhost:3000", "http://127.0.0.1:3000/"]) assert.equal(appUrlSchema.safeParse(value).success, true);
  for (const value of ["http://remote.invalid", "javascript:alert(1)", "https://user:pass@host.invalid", "https://host.invalid/callback", "https://host.invalid?next=x", "https://host.invalid/#x"]) assert.equal(appUrlSchema.safeParse(value).success, false);
});

test("los mensajes públicos no incluyen detalles del proveedor", () => {
  assert.match(authErrorMessage({ code: "invalid_credentials", status: 400 }), /correo y contraseña/);
  assert.match(authErrorMessage({ status: 429 }), /Espera unos minutos/);
  assert.match(authErrorMessage({ code: "internal_provider_details", status: 500 }), /Intenta nuevamente/);
  assert.equal(authErrorMessage({ code: "internal_provider_details", status: 500 }).includes("internal_provider_details"), false);
});

test("la limpieza reconoce solo cookies de Auth de ACTIVANT", () => {
  for (const name of ["activant-auth", "activant-auth.0", "activant-auth-code-verifier"]) assert.equal(isAuthCookie(name), true);
  for (const name of ["unrelated", "activant-authentication", "other-auth"]) assert.equal(isAuthCookie(name), false);
});

test("las notificaciones de URL solo aceptan mensajes permitidos", () => {
  assert.match(getAuthNotice("sesion-expirada") ?? "", /Tu sesión terminó/);
  for (const value of ["__proto__", "constructor", "toString", "untrusted", ["sesion-expirada"]]) assert.equal(getAuthNotice(value), undefined);
});
