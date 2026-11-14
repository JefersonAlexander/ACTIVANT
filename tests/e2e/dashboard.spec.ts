import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.setTimeout(60_000);

// Datos sintéticos aislados en tests/fixtures; jamás son fallback de la aplicación.
async function login(page: Page, kind: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(`${kind}@activant.test`);
  await page.getByLabel("Contraseña", { exact: true }).fill("test-only-passphrase-2026");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: kind === "roles-error" ? "No pudimos mostrar este contenido" : "Tu espacio de bienestar", exact: true })).toBeVisible();
}
async function openNavigation(page: Page) {
  const menu = page.getByRole("button", { name: "Menú", exact: true });
  await expect(menu).toBeVisible();
  if (await menu.getAttribute("aria-expanded") !== "true") await menu.click();
  await expect(page.getByRole("button", { name: "Cerrar menú", exact: true })).toHaveAttribute("aria-expanded", "true");
  const nav = page.getByRole("navigation", { name: "Navegación de ACTIVANT" });
  await expect(nav).toBeVisible();
  return nav;
}
async function auditAndCapture(page: Page, path: string) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({ path, fullPage: true });
}

test("dashboard personal consulta datos, permite navegar y es accesible", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "member");
  await expect(page.getByText("Hola, member.", { exact: true })).toBeVisible();
  await expect(page.getByText("Habilitación vigente", { exact: true })).toBeVisible();
  await expect(page.getByText("Servidor de planta", { exact: true })).toBeVisible();
  await expect(page.getByText("Asistencia registrada", { exact: true })).toBeVisible();
  await auditAndCapture(page, info.outputPath("dashboard-usuario.png"));
  await page.getByRole("link", { name: "Reservar gimnasio" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tu momento en el gimnasio");
  await expect(page.getByRole("note")).toContainText("ocupación puede cambiar");
  await page.getByRole("link", { name: "Mes siguiente", exact: true }).click();
  await expect(page).toHaveURL(/mes=\d{4}-\d{2}/);
  const calendar = page.getByRole("group", { name: "Selecciona un día del calendario" });
  await expect(calendar).toBeVisible();
  const day = calendar.getByRole("button").last();
  await day.click();
  await expect(day).toHaveAttribute("aria-pressed", "true");
  const nav = await openNavigation(page);
  await nav.getByRole("link", { name: "Mi perfil", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mi perfil");
  await expect(page.getByRole("main").getByText("member@activant.test", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("dashboard vacío distingue ausencia de datos de indicadores reales", async ({ page }, info) => {
  await login(page, "empty");
  await expect(page.getByText("Habilitación pendiente", { exact: true })).toBeVisible();
  await expect(page.getByText("Un espacio por agendar", { exact: true })).toBeVisible();
  await expect(page.getByText("Tu recorrido empieza aquí", { exact: true })).toBeVisible();
  await expect(page.getByText("No hay franjas publicadas para este día.")).toBeVisible();
  await expect(page.getByText(/\d+ puntos acumulados/)).toHaveCount(0);
  await auditAndCapture(page, info.outputPath("dashboard-vacio.png"));
});

test("administrador ve indicadores y accesos autorizados", async ({ page }, info) => {
  await login(page, "admin");
  const nav = await openNavigation(page);
  await nav.getByRole("link", { name: "Resumen administrativo", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("El bienestar, en perspectiva");
  const cards = page.getByRole("main");
  await expect(cards.getByText("12", { exact: true })).toBeVisible();
  await expect(cards.getByText("3", { exact: true })).toBeVisible();
  await expect(cards.getByText("2", { exact: true })).toBeVisible();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const remaining = ["08:00", "23:00"].reduce((sum, hour, i) => sum + (new Date(`${day}T${hour}:00-05:00`) > new Date() ? 20 - (i + 1) - (i === 1 ? 2 : 0) : 0), 0);
  await expect(page.getByRole("heading", { name: "Cupos disponibles", exact: true }).locator("..").locator("..")).toContainText(String(remaining));
  await expect(page.getByRole("heading", { name: "La jornada de hoy" })).toBeVisible();
  await auditAndCapture(page, info.outputPath("dashboard-administrativo.png"));
  for (const [path, heading] of [["/admin/usuarios", "Usuarios"], ["/admin/horarios", "Horarios"], ["/admin/reservas", "Reservas"], ["/admin/reportes", "Reportes"], ["/control-asistencia", "Control de asistencia"]]) {
    await page.goto(path!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading!);
  }
});

for (const kind of ["member", "staff"]) {
  test(`${kind} no puede abrir rutas administrativas ni ver accesos de admin`, async ({ page }) => {
    await login(page, kind);
    const nav = await openNavigation(page);
    await expect(nav.getByRole("link", { name: "Resumen administrativo", exact: true })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Control de asistencia", exact: true })).toHaveCount(kind === "staff" ? 1 : 0);
    for (const path of ["/admin", "/admin/usuarios", "/admin/horarios", "/admin/reservas", "/admin/reportes", ...(kind === "member" ? ["/control-asistencia"] : [])]) {
      const response = await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard\?estado=sin-permiso$/);
      await expect(page.getByRole("main").getByRole("alert")).toContainText("No tienes permisos");
      expect(response?.headers()["cache-control"]).toContain("no-store");
    }
    if (kind === "staff") {
      await page.goto("/control-asistencia");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Control de asistencia");
      await expect(page.getByText("2", { exact: true })).toBeVisible();
    }
  });
}

test("todas las entradas privadas exigen sesión", async ({ page }) => {
  for (const route of ["/admin", "/admin/usuarios", "/gimnasio", "/perfil", "/historial", "/biblioteca", "/control-asistencia"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "El bienestar, en perspectiva" })).toHaveCount(0);
  }
});

test("errores de consultas no se convierten en estados vacíos", async ({ page }, info) => {
  await login(page, "data-error");
  await expect(page.getByRole("alert").first()).toContainText("No pudimos consultar");
  await expect(page.getByText("Un espacio por agendar", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Actualizar", exact: true }).first()).toBeEnabled();
  await auditAndCapture(page, info.outputPath("dashboard-error.png"));
});

test("errores administrativos no se presentan como ceros", async ({ page }) => {
  await login(page, "admin-error");
  await page.goto("/admin");
  await expect(page.getByRole("main").getByRole("alert").first()).toContainText("Algunos indicadores no están disponibles");
  await expect(page.getByLabel("No disponible", { exact: true })).toHaveCount(4);
  await expect(page.getByText("Sin franjas para hoy", { exact: true })).toHaveCount(0);
});

test("error de permisos impide renderizar el dashboard", async ({ page }) => {
  await login(page, "roles-error");
  await expect(page.getByRole("heading", { name: "Tu espacio de bienestar" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No pudimos mostrar este contenido" })).toBeVisible();
});

test("adaptación de ambos dashboards y navegación por teclado", async ({ page }) => {
  for (const kind of ["member", "admin"]) {
    await login(page, kind);
    if (kind === "admin") await page.goto("/admin");
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${kind} ${width}`).toBe(true);
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    const logout = page.getByRole("button", { name: "Cerrar sesión", exact: true });
    await logout.scrollIntoViewIfNeeded();
    await expect(logout).toBeInViewport();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    const nav = await openNavigation(page);
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Biblioteca", exact: true }).click();
    await expect(nav).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Biblioteca de bienestar");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Biblioteca de bienestar", exact: true })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar al contenido principal" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  }
});
