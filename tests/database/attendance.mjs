import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
export async function runAttendanceTests({client,newClient,root}) {
 const checks=[];
 const user=n=>`20000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
 const res=n=>`41000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
 const slot="30000000-0000-4000-8000-000000000100";
 async function actor(n,sql,args=[],role="authenticated") {
  const c=await newClient();
  try {await c.query("begin");assert.ok(["authenticated","anon","service_role"].includes(role));await c.query(`set local role ${role}`);
   await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(n ? {sub:user(n),role} : {})]);
   const result=await c.query(sql,args);await c.query("commit");return result.rows;
  } catch(e){await c.query("rollback");throw e;}finally{await c.end();}
 }
 async function check(name,fn){try{await fn();checks.push({name,status:"passed"});console.log(`Asistencia: ${name}`);}catch(e){throw new Error(`${name}: ${e.message}`,{cause:e});}}
 const issue=async()=>{const row=(await actor(3,"select * from public.issue_gym_display_qr()"))[0];assert.equal(row.outcome,"ok");return row;};
 const scan=async(n,token)=>(await actor(n,"select * from public.check_in_gym_qr($1) /*attendance-scan*/",[token]))[0];
 const manual=async(n,id,reason="camera_unavailable")=>(await actor(n,"select * from public.record_gym_manual_attendance($1,$2)",[id,reason]))[0];
 // Carga de reservas preexistentes de la franja actual SOLO en clúster nuevo aislado.
 assert.match((await client.query("select current_database() as name")).rows[0].name,/^activant_dbtest_/);
 await client.query("alter table public.reservations disable trigger guard_reservation");
 try {
  for(const n of [6,7,80,81,82,83,84,85,86,87,88,89,90]) await client.query("insert into public.reservations(id,user_id,slot_id,status,cancelled_at,created_at) values($1,$2,$3,$4::public.reservation_status,case when $4::public.reservation_status='cancelled' then clock_timestamp() else null end,clock_timestamp()-interval '1 hour')",[res(n),user(n),slot,n===82 ? "cancelled" : "confirmed"]);
 }finally{await client.query("alter table public.reservations enable trigger guard_reservation");}
 let qr;
 await check("Personal autorizado genera QR de 15 segundos, sin datos personales y solo hash almacenado",async()=>{
  qr=await issue();assert.match(qr.token,/^[0-9a-f]{64}$/);
  const hash=createHash("sha256").update(qr.token).digest("hex");
  const stored=(await client.query("select token_hash,extract(epoch from expires_at-created_at)::int as ttl from activant_private.gym_display_challenges where token_hash=$1",[hash])).rows[0];
  assert.deepEqual(stored,{token_hash:hash,ttl:15});assert.notEqual(hash,qr.token);
  assert.equal(qr.slot_id,slot);
 });
 await check("QR válido registra asistencia del usuario con hora del servidor",async()=>{
  const before=(await client.query("select clock_timestamp() as time")).rows[0].time;
  const row=await scan(80,qr.token);assert.equal(row.outcome,"ok");assert.equal(row.reservation_id,res(80));assert.ok(row.checked_in_at>=before);
  const stored=(await client.query("select method,recorded_by,display_challenge_id from public.attendance where reservation_id=$1",[res(80)])).rows[0];
  assert.equal(stored.method,"qr");assert.equal(stored.recorded_by,user(80));assert.ok(stored.display_challenge_id);
 });
 await check("Mismo QR compartido admite a otra persona con reserva y no duplica al primero",async()=>{
  assert.equal((await scan(81,qr.token)).outcome,"ok");assert.equal((await scan(80,qr.token)).outcome,"already_recorded");
 });
 await check("QR manipulado o malformado no registra asistencia",async()=>{
  assert.equal((await scan(83,"0".repeat(64))).outcome,"invalid_qr");assert.equal((await scan(83,"javascript:alert(1)")).outcome,"invalid_qr");
 });
 await check("Usuario sin reserva y reserva cancelada se rechazan",async()=>{
  assert.equal((await scan(91,qr.token)).outcome,"no_reservation");assert.equal((await scan(82,qr.token)).outcome,"reservation_cancelled");
 });
 await check("Cuenta inactiva y habilitación revocada se rechazan",async()=>{
  assert.equal((await scan(6,qr.token)).outcome,"inactive_account");assert.equal((await scan(7,qr.token)).outcome,"not_eligible");
 });
 await check("Suspensión vigente impide asistencia incluso con reserva",async()=>{
  await actor(1,"select public.admin_add_gym_access_restriction($1,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour','suspension')",[user(84)]);
  assert.equal((await scan(84,qr.token)).outcome,"access_restricted");assert.equal((await manual(3,res(84))).outcome,"access_restricted");
 });
 await check("QR vencido se rechaza con reloj SQL, conservando el contador",async()=>{
  const expired=await issue();const hash=createHash("sha256").update(expired.token).digest("hex");
  await client.query("update activant_private.gym_display_challenges set created_at=statement_timestamp()-interval '30 seconds',expires_at=statement_timestamp()-interval '15 seconds' where token_hash=$1",[hash]);
  assert.equal((await scan(83,expired.token)).outcome,"expired_qr");
 });
 await check("Una baja del emisor invalida sus QR aunque no hayan expirado",async()=>{
  await client.query("update public.profiles set is_active=false where id=$1",[user(3)]);
  assert.equal((await scan(83,qr.token)).outcome,"expired_qr");
  await client.query("update public.profiles set is_active=true where id=$1",[user(3)]);
 });
 await check("Dos solicitudes simultáneas registran exactamente una asistencia",async()=>{
  const fresh=await issue();
  // Barrera: los dos clientes se encolan en el mismo contador antes de liberarlo.
  const barrier=await newClient();await barrier.query("begin");
  await barrier.query("insert into activant_private.attendance_rate_limits values($1,'scan',date_trunc('minute',clock_timestamp()),0,date_trunc('hour',clock_timestamp()),0) on conflict do nothing",[user(85)]);
  await barrier.query("select 1 from activant_private.attendance_rate_limits where user_id=$1 and operation='scan' for update",[user(85)]);
  const pending=Promise.all([scan(85,fresh.token),scan(85,fresh.token)]);
  try {
   const deadline=Date.now()+5000;let waiting=0;
   while(Date.now()<deadline){waiting=(await client.query("select count(*)::int as n from pg_stat_activity where query like '%/*attendance-scan*/%' and wait_event_type='Lock'")).rows[0].n;if(waiting>=2)break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(waiting,2);
  }finally{await barrier.query("commit");await barrier.end();}
  const outcomes=(await pending).map(r=>r.outcome).sort();assert.deepEqual(outcomes,["already_recorded","ok"]);
  assert.equal((await client.query("select count(*)::int as n from public.attendance where reservation_id=$1",[res(85)])).rows[0].n,1);
 });
 await check("Registro manual exige personal autorizado y motivo válido",async()=>{
  await assert.rejects(manual(86,res(86)),e=>e.code==="42501");
  assert.equal((await manual(3,res(86),"diagnóstico privado")).outcome,"invalid_reason");
  assert.equal((await manual(3,res(86))).outcome,"ok");
  assert.equal((await manual(3,res(86))).outcome,"already_recorded");
 });
 await check("Auditoría manual incluye actor, reserva y motivo sin texto médico",async()=>{
  const row=(await client.query("select actor_id,new_values from public.audit_logs where entity_table='attendance' and new_values->>'reservation_id'=$1",[res(86)])).rows[0];
  assert.equal(row.actor_id,user(3));assert.equal(row.new_values.manual_reason,"camera_unavailable");assert.ok(row.new_values.checked_in_at);
  assert.equal((await client.query("select count(*)::int as n from public.audit_logs where new_values::text like '%'||$1||'%'",[qr.token])).rows[0].n,0);
 });
 await check("Ingreso manual fuera de horario y asistencia sin reserva se rechazan",async()=>{
  const future=(await client.query("select id from public.reservations where user_id=$1 and slot_id<>$2 and status='confirmed' limit 1",[user(4),slot])).rows[0].id;
  assert.equal((await manual(3,future)).outcome,"outside_window");assert.equal((await manual(3,res(99))).outcome,"no_reservation");
 });
 await check("Límite SQL persiste tras códigos inválidos y rechaza el intento once",async()=>{
  // Una conexión y una sentencia evitan que once aperturas de conexión crucen el minuto.
  const rows=await actor(87,"select attempt,r.outcome from generate_series(1,11) attempt cross join lateral public.check_in_gym_qr(repeat('0',64+attempt-attempt)) r order by attempt");
  assert.deepEqual(rows.slice(0,10).map(r=>r.outcome),Array(10).fill("invalid_qr"));
  assert.equal(rows[10].outcome,"rate_limited");
  assert.equal((await client.query("select minute_count from activant_private.attendance_rate_limits where user_id=$1 and operation='scan'",[user(87)])).rows[0].minute_count,11);
 });
 await check("Límite horario no se elude esperando otro minuto",async()=>{
  await client.query("insert into activant_private.attendance_rate_limits values($1,'scan',date_trunc('minute',clock_timestamp())-interval '1 minute',0,date_trunc('hour',clock_timestamp()),60)",[user(88)]);
  assert.equal((await scan(88,qr.token)).outcome,"rate_limited");
 });
 await check("Límites de emisión y registro manual independientes",async()=>{
  await client.query("update activant_private.attendance_rate_limits set minute_start=date_trunc('minute',clock_timestamp()),minute_count=8 where user_id=$1 and operation='issue'",[user(3)]);
  assert.equal((await actor(3,"select * from public.issue_gym_display_qr()"))[0].outcome,"rate_limited");
  assert.equal((await manual(3,res(89),"accessibility")).outcome,"ok");
 });
 await check("No se exponen tokens, hashes ni contadores mediante RLS o acceso al esquema privado",async()=>{
  for(const table of ["gym_display_challenges","attendance_rate_limits"]){
   assert.equal((await client.query("select relrowsecurity from pg_class where oid=$1::regclass",[`activant_private.${table}`])).rows[0].relrowsecurity,true);
   for(const n of [1,3,80])await assert.rejects(actor(n,`select * from activant_private.${table}`),e=>e.code==="42501");
  }
 });
 await check("Usuario no ve asistencia ajena ni puede alterar evidencias",async()=>{
  const rows=await actor(80,"select reservation_id from public.attendance");assert.deepEqual(rows,[{reservation_id:res(80)}]);
  await assert.rejects(actor(80,"update public.attendance set manual_reason='accessibility'"),e=>e.code==="42501");
  await assert.rejects(actor(1,"insert into public.attendance(reservation_id,recorded_by,method) values($1,$2,'staff')",[res(90),user(1)]),e=>e.code==="42501");
 });
 await check("Sin autorización no se emite QR, no se registra y no se invocan helpers",async()=>{
  await assert.rejects(actor(80,"select * from public.issue_gym_display_qr()"),e=>e.code==="42501");
  for(const role of ["anon","service_role"])await assert.rejects(actor(null,"select * from public.check_in_gym_qr($1)",[qr.token],role),e=>e.code==="42501");
  assert.equal((await scan(null,qr.token)).outcome,"inactive_account");
  await assert.rejects(actor(80,"select activant_private.attendance_attempt('scan',999,999)"),e=>e.code==="42501");
 });
 await writeFile(path.join(root,".database-tests/attendance-results.json"),JSON.stringify({engine:"PostgreSQL 17",passed:checks.length,checks},null,2)+"\n","utf8");
 console.log(`${checks.length} comprobaciones de asistencia correctas.`);
}
