import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Identidades sintéticas del servidor HTTP de tests/fixtures. No son usuarios reales.
const fixturePassword = "test-only-passphrase-2026";
test.describe("formularios nativos", () => {
  test("POST del formulario SSR conserva el origen y rechaza solicitudes falsificadas", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.headers()["referrer-policy"]).toBe("same-origin");
    // Aísla el formulario SSR del streaming/hidratación de React. El navegador
    // realiza un POST nativo real con los campos $ACTION emitidos por Next.
    const html = await response!.text();
    const form = await page.evaluate(markup => {
      const element = new DOMParser().parseFromString(markup, "text/html").querySelector("form");
      if (!element) throw new Error("Falta el formulario SSR de acceso.");
      return element.outerHTML;
    }, html);
    await page.setContent(`<!doctype html><html lang="es"><head><meta name="referrer" content="same-origin"></head><body>${form}</body></html>`);
    await page.getByLabel("Correo electrónico", { exact: true }).fill("active@activant.test");
    await page.getByLabel("Contraseña", { exact: true }).fill(fixturePassword);
    const submission = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/login"));
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    const original = await submission;
    expect(original.headers()["origin"]).toBe("http://127.0.0.1:3000");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Tu espacio de bienestar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await expect(page).toHaveURL(/estado=sesion-cerrada/);
    for (const origin of ["null", "https://external-fixture.invalid"]) {
      const rejected = await page.request.post("/login", { headers: { Origin: origin, "Content-Type": original.headers()["content-type"]! }, data: original.postDataBuffer()!, maxRedirects: 0 });
      expect(rejected.status()).toBe(500); // Next rechaza la acción antes de ejecutar Auth.
    }
  });
});
async function login(page: Page, kind = "active", password = fixturePassword) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(`${kind}@activant.test`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
}
async function setExpiredSession(context: BrowserContext, revoked: boolean) {
  const account = { id: "00000000-0000-4000-8000-000000000001", email: "active@activant.test", aud: "authenticated", role: "authenticated" };
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const cookie = { access_token: `${part({ alg: "HS256" })}.${part({ sub: account.id, exp: 1 })}.fixture-signature`, refresh_token: revoked ? "revoked" : "refresh-active", expires_at: 1, token_type: "bearer", user: account };
  await context.addCookies([{ name: "activant-auth", value: `base64-${part(cookie)}`, url: "http://127.0.0.1:3000", sameSite: "Lax" }]);
}

test("usuario activo accede, persiste al recargar y cierra sesión", async ({ page, context }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Tu espacio de bienestar" })).toBeVisible();
  expect((await context.cookies()).some((cookie) => cookie.name.startsWith("activant-auth"))).toBe(true);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL(/estado=sesion-cerrada/);
  expect((await context.cookies()).filter((cookie) => /^activant-auth(?:\.|$)/.test(cookie.name))).toEqual([]);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("credenciales inválidas muestran un error en español", async ({ page }) => {
  await login(page, "active", "wrong-fixture-password");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Verifica tu correo y contraseña");
  await expect(page).toHaveURL(/\/login$/);
});

for (const account of ["inactive", "missing", "profile-error"]) {
  test(`bloquea cuenta ${account} sin conceder acceso`, async ({ page, context }) => {
    await login(page, account);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(account === "profile-error" ? "No pudimos completar el acceso" : "perfil activo");
    expect((await context.cookies()).filter((cookie) => /^activant-auth(?:\.|$)/.test(cookie.name))).toEqual([]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
}

test("protege dashboard y cambio de contraseña sin sesión", async ({ page }) => {
  for (const path of ["/dashboard", "/dashboard/ruta-interna", "/actualizar-contrasena"]) {
    const response = await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    expect(response?.headers()["cache-control"]).toContain("no-store");
  }
});

test("renueva sesión expirada mediante refresh token y conserva cookies", async ({ page, context }) => {
  await setExpiredSession(context, false);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Tu espacio de bienestar" })).toBeVisible();
  const cookie = (await context.cookies()).find((item) => item.name === "activant-auth");
  expect(cookie?.value).toBeTruthy();
  const content = JSON.parse(Buffer.from(cookie!.value.replace("base64-", ""), "base64url").toString());
  expect(content.expires_at).toBeGreaterThan(Date.now() / 1000);
});

test("una sesión revocada redirige al login sin mostrar datos privados", async ({ page, context }) => {
  await setExpiredSession(context, true);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/estado=sesion-expirada/);
  await expect(page.getByRole("status")).toContainText("Tu sesión terminó");
  await expect(page.getByRole("heading", { name: "Tu espacio de bienestar" })).toHaveCount(0);
});

test("no confía en la identidad escrita en una cookie manipulada", async ({ page, context }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  const cookie = (await context.cookies()).find((item) => item.name === "activant-auth")!;
  const content = JSON.parse(Buffer.from(cookie.value.replace("base64-", ""), "base64url").toString());
  content.access_token = content.access_token.replace(".fixture-signature", ".forged-signature");
  await context.addCookies([{ ...cookie, value: `base64-${Buffer.from(JSON.stringify(content)).toString("base64url")}` }]);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("un perfil desactivado pierde acceso aunque conserve sesión", async ({ page, request }, testInfo) => {
  const mobile = testInfo.project.name === "mobile";
  await login(page, mobile ? "disabled-mobile" : "disabled");
  await expect(page).toHaveURL(/\/dashboard$/);
  await request.post("http://127.0.0.1:54322/_test/disable", { data: { id: mobile ? "00000000-0000-4000-8000-000000000006" : "00000000-0000-4000-8000-000000000004" } });
  await page.reload();
  await expect(page).toHaveURL(/\/acceso-denegado$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("habilitación");
});

test("recuperación no revela si un correo está registrado", async ({ page }) => {
  await page.goto("/recuperar-contrasena");
  await page.getByLabel("Correo electrónico").fill("unknown@activant.test");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("status")).toContainText("Si el correo está registrado");
});

test("callback rechaza enlaces inválidos, registro y destinos externos", async ({ page }) => {
  const callback = await page.request.get("/auth/callback?token_hash=invalid-fixture&type=recovery", { maxRedirects: 0 });
  expect(callback.status()).toBe(303);
  expect(callback.headers()["referrer-policy"]).toBe("no-referrer");
  expect(callback.headers()["cache-control"]).toContain("no-store");
  expect(callback.headers()["location"]).not.toContain("token_hash");
  for (const query of ["token_hash=expired&type=recovery", "token_hash=x&type=signup", "code=missing-verifier&next=https://attacker.invalid"]) {
    const response = await page.goto(`/auth/callback?${query}`);
    await expect(page).toHaveURL(/127.0.0.1:3000\/login\?estado=enlace-invalido$/);
    expect(response?.headers()["cache-control"]).toContain("no-store");
  }
});

test("enlace de recuperación permite cambiar contraseña y exige nuevo login", async ({ page }, testInfo) => {
  // Token exclusivo por proyecto porque un enlace se consume una sola vez.
  const token = testInfo.project.name === "desktop" ? "valid-recovery" : "replay-recovery";
  await page.goto(`/auth/callback?token_hash=${token}&type=recovery&next=https://attacker.invalid`);
  await expect(page).toHaveURL(/\/actualizar-contrasena$/);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("a-new-fixture-passphrase");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("different-fixture-value");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("a-new-fixture-passphrase");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("a-new-fixture-passphrase");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page).toHaveURL(/estado=contrasena-actualizada/);
  await page.goto(`/auth/callback?token_hash=${token}&type=recovery`);
  await expect(page).toHaveURL(/estado=enlace-invalido/);
});

test("login accesible, responsive y sin registro público", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /registrar|crear cuenta/i })).toHaveCount(0);
  await page.getByLabel("Contraseña", { exact: true }).fill("test-only-visible-value");
  await page.getByRole("button", { name: "Mostrar contraseña", exact: true }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar contraseña", exact: true }).click();
  await page.getByLabel("Contraseña", { exact: true }).clear();
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(audit.violations).toEqual([]);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize(testInfo.project.name === "desktop" ? { width: 1440, height: 1000 } : { width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("invitación válida abre la definición de contraseña sin crear cuentas públicamente", async ({ page }, testInfo) => {
  await page.goto(`/auth/callback?token_hash=valid-invite-${testInfo.project.name}&type=invite`);
  await expect(page).toHaveURL(/\/actualizar-contrasena$/);
  await expect(page.getByRole("heading", { name: "Define tu contraseña" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/acceso-denegado$/);
});

test("callback PKCE canjea el código solo con la cookie del flujo correspondiente", async ({ page, context }, testInfo) => {
  const flow = "fixture-flow-1234";
  const value = `base64-${Buffer.from(JSON.stringify("fixture-only-verifier/recovery")).toString("base64url")}`;
  await context.addCookies([{ name: `activant-auth-flow-${flow}-code-verifier`, value, url: "http://127.0.0.1:3000", sameSite: "Lax" }]);
  await page.goto(`/auth/callback?code=fixture-valid-code-${testInfo.project.name}&sb_flow_id=${flow}`);
  await expect(page).toHaveURL(/\/actualizar-contrasena$/);
  expect((await context.cookies()).some((cookie) => cookie.name === `activant-auth-flow-${flow}-code-verifier`)).toBe(false);
});
