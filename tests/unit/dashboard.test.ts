import test from "node:test";
import assert from "node:assert/strict";
import { canAccess } from "../../src/modules/auth/permissions.ts";
import { getNavigation, isPrivatePath } from "../../src/config/navigation.ts";
import { dayRange, monthRange } from "../../src/modules/dashboard/dates.ts";

test("el personal de gimnasio no obtiene privilegios administrativos", () => {
  assert.equal(canAccess(["gym_staff"], "admin"), false);
  assert.equal(canAccess(["gym_staff"], "attendance"), true);
  assert.equal(canAccess(["user"], "attendance"), false);
  assert.equal(canAccess(["admin"], "attendance"), true);
  assert.deepEqual(getNavigation([]).map((item) => item.href), ["/dashboard", "/gimnasio", "/historial", "/notificaciones", "/constancia", "/asistencia", "/biblioteca", "/perfil"]);
  for (const item of getNavigation(["admin"])) assert.equal(isPrivatePath(`${item.href}/interno`), true);
  assert.equal(isPrivatePath("/administrator"), false);
});
test("los indicadores del día respetan Bogotá al cambiar de fecha UTC", () => {
  assert.deepEqual(dayRange(new Date("2026-11-14T02:00:00Z")), { start: "2026-11-13T05:00:00.000Z", end: "2026-11-14T05:00:00.000Z" });
  assert.equal(monthRange("2028-02").end, "2028-03-01T05:00:00.000Z");
  assert.equal(monthRange("2026-12").next, "2027-01");
  assert.equal(monthRange("2027-01").previous, "2026-12");
  assert.notEqual(monthRange("2026-13").month, "2026-13");
});
