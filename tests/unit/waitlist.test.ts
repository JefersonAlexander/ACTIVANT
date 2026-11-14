import test from "node:test";
import assert from "node:assert/strict";
import { notificationRulesSchema, waitlistMutationSchema, waitlistError } from "../../src/modules/waitlist/contracts.ts";
const id="99000000-0000-4000-8000-000000000001";
test("lista de espera solo acepta operaciones y UUID permitidos, sin identidad ni hora del cliente",()=>{
 for(const operation of ["join","leave","accept","decline","read"]){const parsed=waitlistMutationSchema.safeParse({operation,id,user_id:"otro",expires_at:"2099-01-01"});assert.ok(parsed.success);assert.deepEqual(parsed.data,{operation,id});}
 for(const patch of [{operation:"promote",id},{operation:"accept",id:"123"},{operation:"join"}])assert.equal(waitlistMutationSchema.safeParse(patch).success,false);
});
test("plazos de notificación acotados y errores internos no se muestran",()=>{
 assert.ok(notificationRulesSchema.safeParse({offerMinutes:"5",reminders:"disabled",reminderMinutes:"60"}).success);
 for(const patch of [{offerMinutes:0},{offerMinutes:31},{offerMinutes:1.5},{reminderMinutes:4},{reminderMinutes:1441},{reminders:"true"}])assert.equal(notificationRulesSchema.safeParse({offerMinutes:5,reminders:"enabled",reminderMinutes:60,...patch}).success,false);
 assert.match(waitlistError({details:"__proto__"}),/No pudimos/);assert.match(waitlistError({details:"access_restricted"}),/suspensión/);assert.match(waitlistError({code:"23505"}),/Ya tienes una solicitud/);
});
