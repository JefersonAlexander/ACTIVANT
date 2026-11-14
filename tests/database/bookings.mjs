import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runBookingTests({ client, newClient, root }) {
  const checks = [];
  const user = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  async function actor(n, sql, values = [], role = "authenticated") {
    const c = await newClient();
    try {
      await c.query("begin");
      assert.ok(["authenticated", "anon"].includes(role));
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(n ? { sub: user(n), role } : {})]);
      const result = await c.query(sql, values);
      await c.query("commit");
      return result.rows;
    } catch (error) { await c.query("rollback"); throw error; }
    finally { await c.end(); }
  }
  async function check(name, fn) {
    try { await fn(); checks.push({ name, status: "passed" }); console.log(`Reserva: ${name}`); }
    catch (error) { throw new Error(`Reserva: ${name}: ${error.message}`, { cause: error }); }
  }
  const reserve = async (n, id) => (await actor(n, "select public.reserve_gym_slot($1) as id /*booking-final-seat*/", [id]))[0].id;
  const cancel = (n, id) => actor(n, "select public.cancel_gym_reservation($1)", [id]);
  const makeSlot = async (hours, capacity = 20) => (await actor(1, "select public.admin_create_gym_slot(clock_timestamp()+make_interval(hours=>$1),clock_timestamp()+make_interval(hours=>$1)+interval '30 minutes',$2) as id", [hours, capacity]))[0].id;
  const availability = async (n, id) => (await actor(n, "select a.* from public.get_gym_slot_availability(clock_timestamp()-interval '1 day',clock_timestamp()+interval '2 days') a where slot_id=$1", [id]))[0];
  const normal = await makeSlot(18);
  const lastSeat = await makeSlot(20, 1);
  const outside = await makeSlot(26);
  const started = await makeSlot(-2);
  let first;
  await check("1. Usuario habilitado reserva dentro de la ventana y ve ocupación real", async () => {
    const before = await availability(60, normal);
    assert.equal(before.can_book, true); assert.equal(before.occupied, 0); assert.equal(before.available, 20);
    first = await reserve(60, normal);
    const after = await availability(60, normal);
    assert.equal(after.occupied, 1); assert.equal(after.available, 19); assert.equal(after.reservation_id, first);
    assert.equal(after.blocking_reason, "already_reserved");
  });
  await check("2. Sin habilitación no puede reservar", () => assert.rejects(reserve(7, normal), (e) => e.code === "42501"));
  await check("3. La misma persona no duplica reserva", () => assert.rejects(reserve(60, normal), (e) => e.code === "23505"));
  let winner;
  await check("5. Dos usuarios disputan simultáneamente el último cupo: solo uno gana", async () => {
    const blocker = await newClient();
    let pending;
    try {
      await blocker.query("begin");
      await blocker.query("select id from public.gym_slots where id=$1 for update", [lastSeat]);
      pending = Promise.allSettled([reserve(61, lastSeat), reserve(62, lastSeat)]);
      let waiting = 0;
      for (let attempt = 0; attempt < 100; attempt++) {
        waiting = (await client.query("select count(*)::int as n from pg_stat_activity where query like '%/*booking-final-seat*/%' and wait_event_type='Lock' and pid<>pg_backend_pid()")).rows[0].n;
        if (waiting >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(waiting, 2, "Ambas solicitudes deben estar bloqueadas al mismo tiempo antes de competir.");
      await blocker.query("commit");
      const outcomes = await pending;
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(outcomes.filter((r) => r.status === "rejected" && r.reason.detail === "slot_full").length, 1);
      const rows = (await client.query("select id,user_id from public.reservations where slot_id=$1 and status='confirmed'", [lastSeat])).rows;
      assert.equal(rows.length, 1); winner = rows[0];
      assert.equal((await availability(63, lastSeat)).available, 0);
    } finally {
      await blocker.query("rollback"); await blocker.end();
      await pending;
    }
  });
  await check("4. Una franja llena rechaza nuevos intentos", () => assert.rejects(reserve(63, lastSeat), (e) => e.detail === "slot_full"));
  await check("6. Cancelar libera el cupo inmediatamente y es idempotente", async () => {
    const winnerNumber = Number(winner.user_id.slice(-12));
    await cancel(winnerNumber, winner.id);
    const timestamp = (await client.query("select cancelled_at from public.reservations where id=$1", [winner.id])).rows[0].cancelled_at;
    await cancel(winnerNumber, winner.id);
    assert.equal((await availability(63, lastSeat)).available, 1);
    assert.equal((await client.query("select cancelled_at from public.reservations where id=$1", [winner.id])).rows[0].cancelled_at.toISOString(), timestamp.toISOString());
    await reserve(63, lastSeat);
    assert.equal((await availability(63, lastSeat)).available, 0);
  });
  await check("7. Antes de las 24 horas no permite reservar", async () => {
    assert.equal((await availability(64, outside)).blocking_reason, "window_not_open");
    await assert.rejects(reserve(64, outside), (e) => e.detail === "window_not_open");
  });
  await check("8. Suspensión vigente impide reservar aunque la franja sea posterior", async () => {
    await actor(1, "select public.admin_add_gym_access_restriction($1,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour','suspension')", [user(64)]);
    assert.equal((await availability(64, normal)).blocking_reason, "access_restricted");
    await assert.rejects(reserve(64, normal), (e) => e.code === "42501" && e.detail === "access_restricted");
  });
  await check("Restricción futura que cruza la franja también bloquea", async () => {
    const [restriction] = await actor(1, "select public.admin_add_gym_access_restriction($1,s.starts_at,s.ends_at,'restriction') as id from public.gym_slots s where id=$2", [user(65), normal]);
    await assert.rejects(reserve(65, normal), (e) => e.detail === "access_restricted");
    await actor(1, "select public.admin_revoke_gym_access_restriction($1)", [restriction.id]);
    await reserve(65, normal);
  });
  await check("Una restricción expirada no bloquea", async () => {
    await actor(1, "select public.admin_add_gym_access_restriction($1,clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day')", [user(66)]);
    await reserve(66, normal);
  });
  await check("Franja iniciada no admite reservas", () => assert.rejects(reserve(67, started), (e) => e.detail === "slot_started"));
  await check("Cancelación ajena rechazada incluso si ya se canceló", () => assert.rejects(cancel(67, winner.id), (e) => e.code === "42501"));
  await check("Usuario no puede escribir reservas o restricciones directamente", async () => {
    await assert.rejects(actor(67, "update public.reservations set status='cancelled',cancelled_at=clock_timestamp() where id=$1", [first]), (e) => e.code === "42501");
    await assert.rejects(actor(67, "insert into public.gym_access_restrictions(user_id,starts_at,ends_at,created_by) values($1,clock_timestamp(),clock_timestamp()+interval '1 hour',$1)", [user(67)]), (e) => e.code === "42501");
    assert.equal((await actor(67, "select * from public.gym_access_restrictions")).length, 0);
    assert.equal((await actor(64, "select * from public.gym_access_restrictions")).length, 1);
    assert.equal((await client.query("select relrowsecurity from pg_class where oid='public.gym_access_restrictions'::regclass")).rows[0].relrowsecurity, true);
  });
  await check("Reglas administrables, pausa global y cupos configurables", async () => {
    await assert.rejects(actor(67, "select public.admin_update_booking_rules(48,true,25)"), (e) => e.code === "42501");
    await actor(1, "select public.admin_update_booking_rules(48,true,25)");
    await reserve(67, outside);
    await actor(1, "select public.admin_update_booking_rules(24,false,20)");
    await assert.rejects(reserve(68, normal), (e) => e.detail === "bookings_paused");
    const [reserved] = await actor(63, "select id from public.reservations where slot_id=$1 and status='confirmed'", [lastSeat]);
    await cancel(63, reserved.id);
    const paused = await availability(68, lastSeat);
    assert.equal(paused.available, 1); assert.equal(paused.can_book, false);
    await actor(1, "select public.admin_update_booking_rules(24,true,20)");
    await reserve(68, lastSeat);
  });
  await check("Agregados no exponen identidades ajenas ni permiten consultas anónimas", async () => {
    const row = await availability(68, normal);
    assert.equal(row.reservation_id, null); assert.ok(row.occupied >= 1);
    assert.equal("user_id" in row, false);
    await assert.rejects(actor(null, "select * from public.get_gym_slot_availability(now(),now()+interval '1 day')", [], "anon"), (e) => e.code === "42501");
    await assert.rejects(actor(6, "select * from public.get_gym_slot_availability(now(),now()+interval '1 day')"), (e) => e.code === "42501");
    await assert.rejects(actor(68, "select * from public.get_gym_slot_availability(now(),now()+interval '33 days')"), (e) => e.code === "22023");
  });
  await check("Sin identidad no reserva ni cancela", async () => {
    await assert.rejects(reserve(null, normal), (e) => e.code === "42501");
    await assert.rejects(cancel(null, first), (e) => e.code === "42501");
  });
  await check("Dos cancelaciones simultáneas liberan exactamente un cupo y generan un solo cambio", async () => {
    const before = await availability(69, normal);
    await Promise.all([cancel(60, first), cancel(60, first)]);
    assert.equal((await availability(69, normal)).available, before.available + 1);
    assert.equal((await client.query("select count(*)::int as n from public.audit_logs where entity_table='reservations' and operation='UPDATE' and new_values->>'id'=$1", [first])).rows[0].n, 1);
  });
  await check("El borde de apertura de 24 horas admite una reserva", async () => {
    const boundary = await makeSlot(24, 1);
    assert.equal((await availability(70, boundary)).can_book, true);
    await reserve(70, boundary);
  });
  await check("Operaciones administrativas nuevas dejan auditoría", async () => {
    for (const table of ["gym_access_restrictions", "app_settings"]) {
      assert.ok((await client.query("select count(*)::int as n from public.audit_logs where entity_table=$1 and actor_id=$2", [table, user(1)])).rows[0].n > 0);
    }
  });
  await writeFile(path.join(root, ".database-tests/booking-results.json"), JSON.stringify({ engine: "PostgreSQL 17", passed: checks.length, checks }, null, 2) + "\n", "utf8");
  console.log(`${checks.length} comprobaciones de reservas correctas.`);
}
