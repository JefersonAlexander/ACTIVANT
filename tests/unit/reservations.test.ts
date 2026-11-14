import test from "node:test";
import assert from "node:assert/strict";
import { reservationMutationSchema, bookingRulesSchema, gymSlotSchema, localDateTimeToUtc, utcToLocalDateTime } from "../../src/modules/reservations/schemas.ts";
import { reservationError } from "../../src/modules/reservations/messages.ts";
test("las operaciones solo aceptan identificadores UUID y operaciones conocidas", () => {
  assert.equal(reservationMutationSchema.safeParse({ operation: "reserve", id: "user-supplied-string" }).success, false);
  assert.equal(reservationMutationSchema.safeParse({ operation: "admin", id: "00000000-0000-4000-8000-000000000001" }).success, false);
  assert.deepEqual(reservationMutationSchema.parse({ operation: "cancel", id: "00000000-0000-4000-8000-000000000001", user_id: "forged-user" }), { operation: "cancel", id: "00000000-0000-4000-8000-000000000001" });
});
test("configuración y horarios rechazan fechas inválidas, cruces y capacidades no enteras", () => {
  assert.equal(bookingRulesSchema.safeParse({ windowHours: 0, defaultCapacity: 20, enabled: "enabled" }).success, false);
  assert.equal(bookingRulesSchema.safeParse({ windowHours: 24, defaultCapacity: 2.5, enabled: "enabled" }).success, false);
  assert.equal(gymSlotSchema.safeParse({ startsAt: "2026-02-30T10:00", endsAt: "2026-03-01T10:00", capacity: 20 }).success, false);
  assert.equal(gymSlotSchema.safeParse({ startsAt: "2026-11-13T10:00", endsAt: "2026-11-13T09:00", capacity: 20 }).success, false);
  assert.equal(gymSlotSchema.safeParse({ startsAt: "2026-11-13T10:00", endsAt: "2026-11-13T11:00", capacity: "20" }).success, true);
  assert.equal(gymSlotSchema.safeParse({ startsAt: "2026-11-13T10:00Z", endsAt: "2026-11-13T11:00Z", capacity: 20 }).success, false);
  assert.equal(localDateTimeToUtc("2026-11-13T23:30"), "2026-11-14T04:30:00.000Z");
  assert.equal(utcToLocalDateTime("2026-11-14T04:30:00.000Z"), "2026-11-13T23:30");
});
test("errores públicos distinguen cupos, ventana y restricciones sin filtrar detalles internos", () => {
  assert.match(reservationError({ details: "slot_full" }), /completa/);
  assert.match(reservationError({ details: "window_not_open" }), /ventana/);
  assert.match(reservationError({ details: "access_restricted" }), /restricción/);
  assert.equal(typeof reservationError({ details: "constructor" }), "string");
  assert.equal(typeof reservationError({ details: "__proto__" }), "string");
  assert.equal(reservationError({ code: "XX000", details: "private-stack-or-token" }).includes("private-stack-or-token"), false);
});
