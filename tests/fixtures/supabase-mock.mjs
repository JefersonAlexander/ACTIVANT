// Doble HTTP SOLO de pruebas: nunca se importa ni se usa en src/.
// El SDK real de Supabase realiza las solicitudes a este servidor aislado.
import { handleLibraryStorage, handleLibraryAdminFixture, reviseLibraryFixture } from "./library-admin-fixture.mjs";
import { createServer } from "node:http";
import { handleAttendanceFixture, attendanceInfo, resetAttendanceFixture } from "./attendance-fixture.mjs";
import { handleWaitlistFixture, waitlistInfo, waitlistEvent } from "./waitlist-fixture.mjs";
import { handleProgramFixture } from "./program-fixture.mjs";

const password = "test-only-passphrase-2026";
const accounts = ["active", "inactive", "missing", "disabled", "profile-error", "disabled-mobile", "member", "admin", "staff", "empty", "data-error", "roles-error", "admin-error", "booking-desktop", "booking-mobile", "booking-ineligible-desktop", "booking-ineligible-mobile", "booking-error-desktop", "booking-error-mobile", "booking-admin-desktop", "booking-admin-mobile", ...["library", "library-empty", "library-denied", "library-error", "management-publishing-admin", "management-users-admin", "management-reports-admin", "management-error-admin", "attendance", "attendance-staff", "attendance-errors", "attendance-camera", "program", "program-admin", "program-empty", "program-error", "waitlist", "waitlist-decline", "waitlist-expire", "waitlist-empty", "waitlist-error", "waitlist-admin"].flatMap(kind=>[`${kind}-desktop`,`${kind}-mobile`])].map((kind, index) => ({
  kind, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  email: `${kind}@activant.test`,
}));
const disabled = new Set();
const usedTokens = new Set();
const bookingStates = new Map();
const bookingStart = Math.ceil((Date.now() + 2 * 3600000) / 60000) * 60000;
const bookingSlots = [0, 2, 26].map((hours, i) => ({
  id: `70000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  starts_at: new Date(bookingStart + hours * 3600000).toISOString(),
  ends_at: new Date(bookingStart + (hours + .75) * 3600000).toISOString(),
  capacity: i === 1 ? 1 : 20, status: "open",
}));
function stateFor(kind) {
  if (!bookingStates.has(kind)) bookingStates.set(kind, { history: [], full: false, slots: [], rules: { booking_window_hours: 24, default_slot_capacity: 20, reservations_enabled: true } });
  return bookingStates.get(kind);
}

function jwt(account, expired = false) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: account.id, exp: Math.floor(Date.now() / 1000) + (expired ? -3600 : 3600), aud: "authenticated", role: "authenticated", fixture: account.kind })}.fixture-signature`;
}
function user(account) {
  return { id: account.id, email: account.email, aud: "authenticated", role: "authenticated", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", email_confirmed_at: "2026-01-01T00:00:00Z" };
}
function session(account) {
  return { access_token: jwt(account), refresh_token: `refresh-${account.kind}`, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(account) };
}
function fromToken(token) {
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url"));
    return token.endsWith(".fixture-signature") && claims.exp > Date.now() / 1000 ? accounts.find((a) => a.id === claims.sub) : null;
  } catch { return null; }
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:54322");
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3000");
  res.setHeader("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-upsert, cache-control");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("X-Supabase-Api-Version", "2024-01-01");
  res.setHeader("Content-Type", "application/json");
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method === "OPTIONS") return send(200, {});
  if (url.pathname === "/health") return send(200, { status: "test-fixture-only" });
  if (url.pathname === "/_test/attendance-info") return send(200, attendanceInfo());
  if (url.pathname === "/_test/waitlist-info") return send(200, waitlistInfo());
  if (url.pathname === "/_test/booking-info") return send(200, bookingSlots);
  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  const storageAccount = fromToken((req.headers.authorization ?? "").replace("Bearer ", ""));
  if(handleLibraryStorage({account:storageAccount,url,req,res,send,buffer:Buffer.concat(buffers)})) return;
  let body;
  try { body = JSON.parse(Buffer.concat(buffers).toString() || "{}"); } catch { return send(400, {}); }
  // Solo el doble HTTP local: cada prueba mutante reinicia su propia identidad.
  if (url.pathname === "/_test/attendance-reset" && req.method === "POST") {
    const target = accounts.find(candidate => candidate.kind === body.kind && candidate.kind.startsWith("attendance"));
    if (!target) return send(404, {});
    resetAttendanceFixture(target.id); return send(200, { reset: true });
  }
  if (url.pathname === "/_test/waitlist-event") return send(200, { updated: waitlistEvent(body.kind, body.event) });
  if (url.pathname === "/_test/library-revise") return send(200, { updated: reviseLibraryFixture(body.kind, body.id) });
  const account = fromToken((req.headers.authorization ?? "").replace("Bearer ", ""));
  if (url.pathname === "/_test/disable" && req.method === "POST") {
    disabled.add(body.id); return send(200, {});
  }
  if (url.pathname === "/auth/v1/invite") {
    if(req.headers.authorization !== "Bearer sb_secret_fixture_only_not_a_real_key") return send(403,{});
    return send(200,{id:"97000000-0000-4000-8000-000000000099",email:body.email,aud:"authenticated",role:"authenticated",created_at:new Date().toISOString(),app_metadata:{},user_metadata:{}});
  }
  if (url.pathname === "/auth/v1/token") {
    if (url.searchParams.get("grant_type") === "pkce") {
      return String(body.auth_code).startsWith("fixture-valid-code-") && body.code_verifier === "fixture-only-verifier"
        ? send(200, session(accounts[0])) : send(400, { code: "bad_code_verifier", msg: "Fixture verifier mismatch" });
    }
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const refreshed = accounts.find((a) => body.refresh_token === `refresh-${a.kind}`);
      return refreshed ? send(200, session(refreshed)) : send(400, { code: "refresh_token_not_found", msg: "Fixture revoked token" });
    }
    const found = accounts.find((a) => a.email === body.email);
    return found && body.password === password ? send(200, session(found)) : send(400, { code: "invalid_credentials", msg: "Fixture invalid credentials" });
  }
  if (url.pathname === "/auth/v1/user") {
    if (!account) return send(401, { code: "bad_jwt", msg: "Fixture invalid token" });
    return send(200, user(account));
  }
  if (url.pathname === "/auth/v1/logout") { res.statusCode = 204; return res.end(); }
  if (url.pathname === "/auth/v1/recover") return send(200, {});
  if (url.pathname === "/auth/v1/verify") {
    const valid = ["valid-recovery", "valid-invite-desktop", "valid-invite-mobile", "replay-recovery"].includes(body.token_hash) && ["recovery", "invite"].includes(body.type);
    if (!valid || usedTokens.has(body.token_hash)) return send(403, { code: "otp_expired", msg: "Fixture expired link" });
    usedTokens.add(body.token_hash);
    return send(200, session(body.type === "invite" ? accounts[1] : accounts[0]));
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    if (!account) return send(401, { message: "Fixture missing identity" });
    const table = url.pathname.split("/").at(-1);
    const isAdmin = account.kind.startsWith("management-") && account.kind.includes("admin") || ["admin", "admin-error"].includes(account.kind) || (account.kind.startsWith("booking-admin") || account.kind.startsWith("program-admin") || account.kind.startsWith("waitlist-admin"));
    const booking = account.kind.startsWith("booking-");
    const bookingState = stateFor(account.kind);
    const failed = ["data-error", "admin-error"].includes(account.kind);
    const counted = (rows, count = rows.length) => {
      res.setHeader("Content-Range", `0-${Math.max(0, rows.length - 1)}/${count}`);
      if (req.method === "HEAD") { res.statusCode = 200; return res.end(); }
      return send(200, rows);
    };
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
    const shifted = (delta) => new Date(new Date(`${day}T12:00:00-05:00`).getTime() + delta * 86400000).toISOString().slice(0, 10);
    const slot = (id, date, hour) => ({ id, starts_at: `${date}T${hour}:00-05:00`, ends_at: `${date}T${hour.slice(0, 2)}:45:00-05:00`, capacity: 20, status: "open" });
    const todaySlots = [slot("fixture-slot-morning", day, "08:00"), slot("fixture-slot-night", day, "23:00")];
    const future = slot("fixture-slot-future", shifted(1), "10:00");
    const past = slot("fixture-slot-past", shifted(-1), "09:00");
    const populated = ["member", "admin", "staff"].includes(account.kind) || booking || account.kind.startsWith("attendance");
    if(handleLibraryAdminFixture({account,table,url,body,method:req.method,send,counted,isAdmin})) return;
    if(handleWaitlistFixture({account,table,url,body,method:req.method,send,counted,isAdmin,failed})) return;
    if(handleProgramFixture({account,table,url,body,method:req.method,send,counted,isAdmin,failed})) return;
    const attendanceResponse=handleAttendanceFixture({account, table, url, body, method:req.method, send, counted, isAdmin});
    if(attendanceResponse) return;
    if (table === "app_settings") {
      return failed ? send(500, { message: "Fixture settings unavailable" }) : send(200, bookingState.rules);
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      if (failed) return send(500, { message: "Fixture RPC unavailable" });
      const eligible = !account.kind.startsWith("booking-ineligible");
      if (table === "get_gym_slot_availability") {
        const source = booking ? [...bookingSlots, ...bookingState.slots] : populated ? [...todaySlots, future, past] : [];
        const filtered = source.filter((s) => new Date(s.starts_at) >= new Date(body.p_start) && new Date(s.starts_at) < new Date(body.p_end));
        const rows = filtered.map((s) => {
          const own = bookingState.history.find((r) => r.status === "confirmed" && r.gym_slots.id === s.id);
          const occupied = isAdmin && !booking ? todaySlots.findIndex(t => t.id === s.id) + 1 : (booking && s.id === bookingSlots[1].id) || (bookingState.full && s.id === bookingSlots[0].id) ? s.capacity : own ? 1 : 0;
          const held = isAdmin && !booking && s.id === todaySlots[1].id ? 2 : 0;
          const opens = new Date(new Date(s.starts_at).getTime() - bookingState.rules.booking_window_hours * 3600000);
          const reason = !eligible ? "not_eligible" : own ? "already_reserved" : !bookingState.rules.reservations_enabled ? "bookings_paused" : new Date(s.starts_at) <= new Date() ? "slot_started" : opens > new Date() ? "window_not_open" : occupied >= s.capacity ? "slot_full" : null;
          return { slot_id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, capacity: s.capacity, status: s.status, occupied, available: s.capacity - occupied - held, booking_opens_at: opens.toISOString(), can_book: reason === null, blocking_reason: reason, reservation_id: own?.id ?? null, observed_at: new Date().toISOString(), total_matches: filtered.length };
        });
        return send(200, rows);
      }
      if (table === "reserve_gym_slot") {
        if (!eligible) return send(403, { code: "42501", details: "not_eligible", message: "Fixture denied" });
        if (account.kind.startsWith("booking-error")) { bookingState.full = true; return send(400, { code: "23514", details: "slot_full", message: "Fixture concurrent fill" }); }
        if (body.p_slot_id !== bookingSlots[0].id) return send(400, { code: "23514", details: "slot_full", message: "Fixture unavailable" });
        if (bookingState.history.some((r) => r.status === "confirmed" && r.gym_slots.id === body.p_slot_id)) return send(400, { code: "23505", details: "already_reserved", message: "Fixture duplicate" });
        const id = `80000000-0000-4000-8000-${String(bookingState.history.length + 1).padStart(12, "0")}`;
        bookingState.history.unshift({ id, status: "confirmed", created_at: new Date().toISOString(), gym_slots: bookingSlots[0], attendance: null });
        return send(200, id);
      }
      if (table === "cancel_gym_reservation") {
        const row = bookingState.history.find((r) => r.id === body.p_reservation_id);
        if (!row) return send(403, { code: "42501", message: "Fixture forbidden" });
        row.status = "cancelled"; return send(200, null);
      }
      if (table === "admin_update_booking_rules") {
        if (!isAdmin) return send(403, { code: "42501", message: "Fixture forbidden" });
        bookingState.rules = { booking_window_hours: body.p_window_hours, reservations_enabled: body.p_enabled, default_slot_capacity: body.p_default_capacity };
        return send(200, null);
      }
      if (["admin_create_gym_slot", "admin_update_gym_slot"].includes(table)) {
        if (!isAdmin) return send(403, { code: "42501", message: "Fixture forbidden" });
        const id = body.p_slot_id ?? `70000000-0000-4000-9000-${String(bookingState.slots.length + 1).padStart(12, "0")}`;
        const value = { id, starts_at: body.p_starts_at, ends_at: body.p_ends_at, capacity: body.p_capacity, status: body.p_status ?? "open" };
        const existing = bookingState.slots.findIndex((slot) => slot.id === id);
        if (existing < 0) bookingState.slots.push(value); else bookingState.slots[existing] = value;
        return send(200, body.p_slot_id ? null : id);
      }
    }
    if (table === "user_roles") {
      if (url.searchParams.get("user_id") !== `eq.${account.id}`) return send(403, { message: "Fixture requires ownership" });
      if (account.kind === "roles-error") return send(500, { message: "Fixture roles unavailable" });
      return send(200, [{ role: isAdmin ? "admin" : (account.kind === "staff" || account.kind.startsWith("attendance-staff")) ? "gym_staff" : "user" }]);
    }
    if (table === "profiles" && req.method === "HEAD") {
      if (!isAdmin) return send(403, {});
      return failed ? send(500, { message: "Fixture statistics unavailable" }) : counted([], 12);
    }
    if (table === "profiles" && url.searchParams.get("select")?.includes("affiliation")) {
      if (url.searchParams.get("id") !== `eq.${account.id}`) return send(403, {});
      return failed ? send(500, { message: "Fixture profile unavailable" }) : send(200, [{ affiliation_type: populated ? "servidor_planta" : null, affiliation_types: populated ? { label: "Servidor de planta", is_active: true } : null }]);
    }
    if (["gym_eligibility", "reservations", "gym_slots", "attendance"].includes(table)) {
      if (failed) return send(500, { message: "Fixture reads unavailable" });
      if (table === "gym_eligibility") {
        if (url.searchParams.get("user_id") !== `eq.${account.id}`) return send(403, {});
        return send(200, populated ? [{ is_eligible: !account.kind.startsWith("booking-ineligible"), valid_from: "2020-01-01T00:00:00Z", valid_until: null }] : []);
      }
      if (table === "reservations") {
        if (req.method === "HEAD") return isAdmin ? counted([], 3) : send(403, {});
        if (url.searchParams.get("user_id") !== `eq.${account.id}`) return send(403, { message: "Fixture requires explicit owner" });
        if (booking) {
          const activeOnly = url.searchParams.get("status") === "eq.confirmed";
          const historical = url.searchParams.get("gym_slots.ends_at")?.startsWith("lt.");
          const rows = bookingState.history.filter((r) => !historical && (!activeOnly || r.status === "confirmed"));
          const offset = Number(url.searchParams.get("offset") ?? 0);
          const limit = Number(url.searchParams.get("limit") ?? 50);
          return counted(rows.slice(offset, offset + limit), rows.length);
        }
        const historical = url.searchParams.get("gym_slots.ends_at")?.startsWith("lt.");
        return send(200, populated ? [{ id: historical ? "fixture-booking-past" : "fixture-booking-next", status: "confirmed", gym_slots: historical ? past : future, attendance: historical ? { checked_in_at: past.starts_at } : null }] : []);
      }
      if (table === "attendance") return isAdmin || account.kind === "staff" ? counted([], 2) : send(403, {});
      if (table === "gym_slots") {
        if (url.searchParams.get("select")?.includes("reservations(count)")) {
          if (!isAdmin) return send(403, {});
          return counted(todaySlots.map((s, i) => ({ ...s, reservations: [{ count: i + 1 }] })));
        }
        const ranges = url.searchParams.getAll("starts_at");
        const start = ranges.find((value) => value.startsWith("gte."))?.slice(4);
        const end = ranges.find((value) => value.startsWith("lt."))?.slice(3);
        return counted(populated ? (booking ? [...bookingSlots, ...bookingState.slots] : [...todaySlots, future, past]).filter((s) => (!start || new Date(s.starts_at) >= new Date(start)) && (!end || new Date(s.starts_at) < new Date(end))) : []);
      }
    }
  }
  if (url.pathname === "/rest/v1/profiles") {
    if (!account) return send(401, { message: "Fixture missing identity" });
    if (account.kind === "profile-error") return send(500, { code: "fixture_error", message: "Fixture database failure" });
    if (url.searchParams.get("id") !== `eq.${account.id}` || url.searchParams.get("is_active") !== "eq.true") return send(403, { message: "Fixture expected ownership and active filter" });
    const active = !["inactive", "missing"].includes(account.kind) && !disabled.has(account.id);
    return send(200, active ? [{ id: account.id, is_active: true }] : []);
  }
  return send(404, { message: "Unknown fixture endpoint" });
});
server.listen(54322, "127.0.0.1");
