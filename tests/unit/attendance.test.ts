import test from "node:test";
import assert from "node:assert/strict";
import { qrPayloadSchema, manualAttendanceSchema, attendanceMessage } from "../../src/modules/attendance/contracts.ts";
test("el lector acepta solo el protocolo QR de ACTIVANT, sin enlaces ni identidad",()=>{
 const valid=`ACTIVANT:GYM:1:${"a".repeat(64)}`;assert.ok(qrPayloadSchema.safeParse(valid).success);
 for(const input of ["https://attacker.invalid/"+valid,valid+"?user=123",valid.slice(0,-1),valid.replace(":1:",":2:"),"javascript:alert(1)"])assert.equal(qrPayloadSchema.safeParse(input).success,false);
});
test("ingreso manual rechaza motivos libres y referencias manipuladas",()=>{
 const input={reservationId:"81000000-0000-4000-8000-000000000001",reason:"camera_unavailable"};
 assert.ok(manualAttendanceSchema.safeParse(input).success);
 assert.equal(manualAttendanceSchema.safeParse({...input,reason:"información médica"}).success,false);
 assert.equal(manualAttendanceSchema.safeParse({...input,reservationId:"someone-else"}).success,false);
 assert.match(attendanceMessage("__proto__"),/No pudimos/);assert.match(attendanceMessage("expired_qr"),/expiró/);
});
