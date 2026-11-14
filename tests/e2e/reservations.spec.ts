import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.setTimeout(90_000);
type FixtureSlot = { id: string; starts_at: string; ends_at: string };
async function login(page: Page, kind: string, project: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(`${kind}-${project}@activant.test`);
  await page.getByLabel("Contraseña", { exact: true }).fill("test-only-passphrase-2026");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tu espacio de bienestar", exact: true })).toBeVisible();
}
async function fixtureSlots(request: APIRequestContext) {
  return await (await request.get("http://127.0.0.1:54322/_test/booking-info")).json() as FixtureSlot[];
}
function dateKey(value: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(value)); }
async function selectSlot(page: Page, slot: FixtureSlot) {
  await page.goto(`/gimnasio?mes=${dateKey(slot.starts_at).slice(0, 7)}`);
  const label = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" }).format(new Date(slot.starts_at));
  await page.getByRole("group", { name: "Selecciona un día del calendario" }).getByRole("button", { name: `${label}, con franjas publicadas`, exact: true }).click();
  const card = page.locator(`[data-slot-id="${slot.id}"]`);
  await expect(card).toBeVisible();
  return card;
}

test("reserva, confirma, persiste y cancela liberando el cupo en la interfaz", async ({ page, request }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "booking", info.project.name);
  const [slot] = await fixtureSlots(request);
  const card = await selectSlot(page, slot!);
  await expect(card.getByRole("meter")).toHaveAttribute("value", "0");
  await card.getByRole("button", { name: "Reservar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Confirma tu reserva", exact: true });
  await expect(dialog).toBeVisible();
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("confirmar-reserva.png") });
  await dialog.getByRole("button", { name: "Confirmar reserva", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card.getByRole("meter")).toHaveAttribute("value", "1");
  await expect(card.getByRole("status")).toContainText("quedó confirmada");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("gimnasio-reserva-confirmada.png"), fullPage: true });
  await page.reload();
  const label = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" }).format(new Date(slot!.starts_at));
  await page.getByRole("group", { name: "Selecciona un día del calendario" }).getByRole("button", { name: `${label}, con franjas publicadas`, exact: true }).click();
  await expect(card.getByText("Tu reserva está confirmada", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Cancelar reserva", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar cancelación", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card.getByRole("meter")).toHaveAttribute("value", "0");
  await expect(card.getByRole("status")).toContainText("cupo ya está disponible");
  await page.goto("/historial");
  await expect(page.getByRole("heading", { name: "Mis reservas", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText("Cancelada", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("habilitación pendiente, franja llena y ventana cerrada tienen estados claros", async ({ page, request }, info) => {
  const slots = await fixtureSlots(request);
  await login(page, "booking-ineligible", info.project.name);
  let card = await selectSlot(page, slots[0]!);
  await expect(card.getByRole("button", { name: "Reservar", exact: true })).toBeDisabled();
  await expect(card).toContainText("Tu habilitación no está vigente");
  await login(page, "booking", info.project.name);
  card = await selectSlot(page, slots[1]!);
  await expect(card.getByRole("button", { name: "Unirse a la lista de espera", exact: true })).toBeEnabled();
  await expect(card).toContainText("completa");
  card = await selectSlot(page, slots[2]!);
  await expect(card.getByRole("button", { name: "Reservar", exact: true })).toBeDisabled();
  await expect(card).toContainText("Se habilita el");
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("un cupo que se agota durante la confirmación informa y actualiza ocupación", async ({ page, request }, info) => {
  await login(page, "booking-error", info.project.name);
  const slots = await fixtureSlots(request);
  const card = await selectSlot(page, slots[0]!);
  await card.getByRole("button", { name: "Reservar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar reserva", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("completa");
  await page.getByRole("dialog").getByRole("button", { name: "Volver", exact: true }).click();
  await expect(card.getByRole("meter")).toHaveAttribute("value", "20");
  await expect(card.getByRole("button", { name: "Unirse a la lista de espera", exact: true })).toBeEnabled();
});

test("administrador configura condiciones, publica y edita una franja", async ({ page }, info) => {
  await login(page, "booking-admin", info.project.name);
  const start = new Date(Date.now() + 3 * 86400000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 3600000);
  const local = (date: Date) => new Date(date.getTime() - 5 * 3600000).toISOString().slice(0, 16);
  await page.goto(`/admin/horarios?mes=${dateKey(start.toISOString()).slice(0, 7)}`);
  const rules = page.getByRole("region", { name: "Condiciones de reserva", exact: true });
  await rules.getByLabel("Anticipación de apertura (horas)", { exact: true }).fill("24");
  await rules.getByLabel("Capacidad predeterminada", { exact: true }).fill("22");
  await rules.getByRole("button", { name: "Guardar condiciones", exact: true }).click();
  await expect(rules.getByRole("status")).toContainText("actualizadas");
  const create = page.getByRole("region", { name: "Nueva franja", exact: true });
  await create.getByLabel("Inicio", { exact: true }).fill(local(start));
  await create.getByLabel("Finalización", { exact: true }).fill(local(end));
  await create.getByLabel("Capacidad de la franja", { exact: true }).fill("25");
  await create.getByRole("button", { name: "Publicar franja", exact: true }).click();
  await expect(create.getByRole("status")).toContainText("creada y publicada");
  const detail = page.locator("details").filter({ has: page.locator("summary", { hasText: "capacidad 25" }) });
  await detail.locator("summary").click();
  const id = await detail.locator('input[name="id"]').inputValue();
  const edit = page.locator("details").filter({ has: page.locator(`input[name="id"][value="${id}"]`) });
  await edit.getByLabel("Capacidad de la franja", { exact: true }).fill("24");
  await edit.getByRole("button", { name: "Guardar franja", exact: true }).click();
  await expect(edit.getByRole("status")).toContainText("actualizada");
  await expect(edit.locator("summary")).toContainText("capacidad 24");
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(audit.violations).toEqual([]);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize(info.project.name === "desktop" ? { width: 1440, height: 1000 } : { width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("administrar-horarios.png"), fullPage: true });
});
