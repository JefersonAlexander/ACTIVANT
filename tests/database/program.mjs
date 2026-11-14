import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
export async function runProgramTests({client,newClient,root}) {
 const checks=[];const user=n=>`20000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
 const slot=n=>`91000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
 const res=(u,n)=>`92000000-0000-4000-${String(u).padStart(4,"0")}-${String(n).padStart(12,"0")}`;
 async function actor(n,sql,args=[],role="authenticated") {const c=await newClient();try{await c.query("begin");assert.ok(["authenticated","anon"].includes(role));await c.query(`set local role ${role}`);await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(n?{sub:user(n),role}:{})]);const result=await c.query(sql,args);await c.query("commit");return result.rows;}catch(e){await c.query("rollback");throw e;}finally{await c.end();}}
 async function check(name,fn){try{await fn();checks.push({name,status:"passed"});console.log(`Programa: ${name}`);}catch(e){throw new Error(`${name}: ${e.message}`,{cause:e});}}
 const summary=async n=>(await actor(n,"select * from public.get_my_point_summary()"))[0];
 const invalidate=n=>actor(1,"select public.admin_invalidate_attendance($1,'incorrect_entry')",[res(110,n)]);
 assert.match((await client.query("select current_database() as name")).rows[0].name,/^activant_dbtest_/);
 await check("Asistencia QR validada genera exactamente +10 automáticamente",async()=>{assert.equal(Number((await summary(80)).balance),10);assert.equal((await summary(80)).monthly_attendances,1);});
 // Solo fixtures del clúster: datos históricos validados, sin esperar doce días.
 // La API de asistencia ya se prueba con guardas reales en attendance.mjs.
 const month=(await client.query("select date_trunc('month',clock_timestamp() at time zone 'America/Bogota')::date as month")).rows[0].month;
 await client.query("alter table public.point_program_rules disable trigger immutable");
 try{await client.query("update public.point_program_rules set created_at=effective_month::timestamp at time zone 'America/Bogota'");}finally{await client.query("alter table public.point_program_rules enable trigger immutable");}
 for(let n=1;n<=12;n++)await client.query("insert into public.gym_slots(id,starts_at,ends_at) values($1,($2::date::timestamp at time zone 'America/Bogota')+make_interval(mins=>$3),($2::date::timestamp at time zone 'America/Bogota')+make_interval(mins=>$3)+interval '20 minutes')",[slot(n),month,n*30]);
 await client.query("alter table public.reservations disable trigger guard_reservation");
 try{for(const u of [110,113])for(let n=1;n<=(u===110?12:4);n++)await client.query("insert into public.reservations(id,user_id,slot_id,created_at) values($1,$2,$3,($4::date::timestamp at time zone 'America/Bogota')-interval '1 day')",[res(u,n),user(u),slot(n),month]);}finally{await client.query("alter table public.reservations enable trigger guard_reservation");}
 async function historicalAttendance(n){await client.query("alter table public.attendance disable trigger guard_attendance");try{await client.query("insert into public.attendance(reservation_id,recorded_by,method,manual_reason,checked_in_at) select $1,$2,'staff','camera_unavailable',starts_at+interval '5 minutes' from public.gym_slots where id=$3",[res(110,n),user(3),slot(n)]);}finally{await client.query("alter table public.attendance enable trigger guard_attendance");}}
 await check("Siete asistencias suman 70, sin bono prematuro",async()=>{for(let n=1;n<=7;n++)await historicalAttendance(n);const s=await summary(110);assert.equal(Number(s.balance),70);assert.equal(s.monthly_bonus,0);});
 await check("La octava asistencia otorga bono +20 una sola vez",async()=>{await historicalAttendance(8);const s=await summary(110);assert.equal(Number(s.balance),100);assert.equal(s.monthly_bonus,20);});
 await check("Pasar de 8 a 12 sustituye el bono: total 30, incremento +10",async()=>{for(let n=9;n<=12;n++)await historicalAttendance(n);const s=await summary(110);assert.equal(Number(s.balance),150);assert.equal(s.monthly_bonus,30);assert.deepEqual((await client.query("select amount from public.point_transactions where user_id=$1 and kind='monthly_bonus' order by created_at",[user(110)])).rows.map(r=>r.amount),[20,10]);});
 await check("Invalidar la asistencia doce revierte +10 y reduce el bono de 30 a 20",async()=>{await invalidate(12);const s=await summary(110);assert.equal(Number(s.balance),130);assert.equal(s.monthly_attendances,11);assert.equal(s.monthly_bonus,20);});
 await check("Invalidación repetida es idempotente y no borra la evidencia original",async()=>{await invalidate(12);assert.equal(Number((await summary(110)).balance),130);assert.equal((await client.query("select count(*)::int as n from public.attendance where reservation_id=$1",[res(110,12)])).rows[0].n,1);assert.equal((await client.query("select count(*)::int as n from public.point_transactions where event_key=$1",['attendance-reversal:'+res(110,12)])).rows[0].n,1);});
 await check("Al bajar de 8 asistencias desaparece el bono mediante movimiento compensatorio",async()=>{for(const n of [1,2,3,4])await invalidate(n);const s=await summary(110);assert.equal(s.monthly_attendances,7);assert.equal(s.monthly_bonus,0);assert.equal(Number(s.balance),70);});
 await check("Ajuste administrativo idempotente y compensación preservan saldo desde el libro",async()=>{
  const id="93000000-0000-4000-8000-000000000001";const sql="select public.admin_adjust_points($1,$2,'correction',$3) as id";
  const outcomes=await Promise.all([actor(1,sql,[user(110),15,id]),actor(1,sql,[user(110),15,id])]);assert.equal(outcomes[0][0].id,outcomes[1][0].id);assert.equal(Number((await summary(110)).balance),85);
  await assert.rejects(actor(1,sql,[user(110),16,id]),e=>e.detail==="idempotency_conflict");
  await actor(1,sql,[user(110),-15,"93000000-0000-4000-8000-000000000002"]);assert.equal(Number((await summary(110)).balance),70);
 });
 await check("Meses de Colombia no se confunden con meses UTC",async()=>{
  const rows=(await client.query("select activant_private.point_month('2026-12-01 04:59:59+00') as before,activant_private.point_month('2026-12-01 05:00:00+00') as after")).rows[0];
  assert.equal(rows.before.toISOString().slice(0,10),"2026-11-01");assert.equal(rows.after.toISOString().slice(0,10),"2026-12-01");
 });
 await check("Tres cancelaciones concurrentes otorgan máximo dos movimientos de +3",async()=>{
  const ids=[];for(const n of [1,3,4])ids.push((await actor(111,"select public.reserve_gym_slot($1) as id",[`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`]))[0].id);
  await Promise.all(ids.map(id=>actor(111,"select public.cancel_gym_reservation($1)",[id])));assert.equal(Number((await summary(111)).balance),6);
  await actor(111,"select public.cancel_gym_reservation($1)",[ids[0]]);assert.equal(Number((await summary(111)).balance),6);
 });
 await check("Cancelación fuera de una hora y cancelación por administrador no otorgan puntos",async()=>{
  const id=(await actor(112,"select public.reserve_gym_slot($1) as id",['30000000-0000-4000-8000-000000000001']))[0].id;
  // Fixture de frontera temporal: instante de cancelación 59 minutos antes del inicio.
  await client.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user(112),role:"authenticated"})]);
  try{await client.query("update public.reservations r set status='cancelled',cancelled_at=s.starts_at-interval '59 minutes' from public.gym_slots s where r.id=$1 and s.id=r.slot_id",[id]);}finally{await client.query("select set_config('request.jwt.claims','{}',false)");}
  assert.equal(Number((await summary(112)).balance),0);
  const other=(await actor(112,"select public.reserve_gym_slot($1) as id",['30000000-0000-4000-8000-000000000003']))[0].id;await actor(1,"select public.cancel_gym_reservation($1)",[other]);assert.equal(Number((await summary(112)).balance),0);
 });
 await check("Cierre conciliado crea casos pendientes, nunca sanciones automáticas",async()=>{
  for(let n=1;n<=4;n++)await actor(3,"select public.staff_close_gym_slot($1,true)",[slot(n)]);
  assert.equal((await client.query("select count(*)::int as n from public.absence_cases where user_id=$1 and status='pending_review'",[user(113)])).rows[0].n,4);
  assert.equal((await client.query("select count(*)::int as n from public.absence_sanctions where user_id=$1",[user(113)])).rows[0].n,0);
 });
 const cases=(await client.query("select id from public.absence_cases where user_id=$1 order by occurred_at,id",[user(113)])).rows.map(r=>r.id);
 const review=(id,status="unjustified",reason="evidence_confirmed",evidence=true)=>actor(1,"select public.admin_review_absence($1,$2,$3,$4)",[id,status,reason,evidence]);
 await check("Sin evidencia suficiente no se puede confirmar inasistencia",async()=>{await assert.rejects(review(cases[0],"unjustified","evidence_confirmed",false),e=>e.detail==="evidence_required");await assert.rejects(actor(3,"select public.admin_review_absence($1,'unjustified','evidence_confirmed',true)",[cases[0]]),e=>e.code==="42501");});
 await check("Primera inasistencia advierte; segunda/tercera esperan calendario; cuarta exige revisión",async()=>{
  for(const id of cases)await review(id);
  const rows=(await client.query("select ordinal,kind,business_days from public.absence_sanctions where user_id=$1 and revoked_at is null order by ordinal",[user(113)])).rows;
  assert.deepEqual(rows,[{ordinal:1,kind:"warning",business_days:0},{ordinal:2,kind:"pending_calendar",business_days:3},{ordinal:3,kind:"pending_calendar",business_days:5},{ordinal:4,kind:"administrative_review",business_days:0}]);
 });
 await check("Calendario verificado excluye fines de semana y excepciones, aplica 3/5 días hábiles",async()=>{
  const dates=(await client.query("select (clock_timestamp() at time zone 'America/Bogota')::date+1 as first,(clock_timestamp() at time zone 'America/Bogota')::date+30 as last")).rows[0];
  const holiday=(await client.query("select d::date as day from generate_series($1::date::timestamp,$2::date::timestamp,interval '1 day') d where extract(isodow from d)<6 limit 1",[dates.first,dates.last])).rows[0].day;
  await actor(1,"select public.admin_set_working_calendar($1,$2,$3,true)",[dates.first,dates.last,[holiday]]);await review(cases[1]);
  for(const days of [3,5]){
   const expected=(await client.query("select ((day+1)::timestamp at time zone 'America/Bogota') as time from public.working_calendar where day> (clock_timestamp() at time zone 'America/Bogota')::date and is_working order by day offset $1 limit 1",[days-1])).rows[0].time;
   const row=(await client.query("select r.ends_at from public.absence_sanctions a join public.gym_access_restrictions r on r.id=a.restriction_id where a.user_id=$1 and a.revoked_at is null and a.business_days=$2",[user(113),days])).rows[0];assert.equal(row.ends_at.toISOString(),expected.toISOString());
  }
 });
 await check("Repetir revisión no duplica sanciones ni extiende la suspensión",async()=>{
  const before=(await client.query("select count(*)::int as n from public.absence_sanctions where user_id=$1",[user(113)])).rows[0].n;await review(cases[1]);assert.equal((await client.query("select count(*)::int as n from public.absence_sanctions where user_id=$1",[user(113)])).rows[0].n,before);
 });
 await check("Justificación propia solicita revisión; aceptarla revoca y recalcula restricciones",async()=>{
  const original=(await client.query("select restriction_id from public.absence_sanctions where case_id=$1 and revoked_at is null",[cases[1]])).rows[0].restriction_id;
  await actor(113,"select public.submit_absence_justification($1,'access_problem')",[cases[0]]);
  assert.equal((await client.query("select revoked_at from public.gym_access_restrictions where id=$1",[original])).rows[0].revoked_at,null);
  await review(cases[0],"justified","justification_accepted");
  assert.ok((await client.query("select revoked_at from public.gym_access_restrictions where id=$1",[original])).rows[0].revoked_at);
  const row=(await client.query("select ordinal,kind from public.absence_sanctions where case_id=$1 and revoked_at is null",[cases[1]])).rows[0];assert.deepEqual(row,{ordinal:1,kind:"warning"});
 });
 await check("No se revoca una sanción por un atajo ajeno al caso",async()=>{
  const id=(await client.query("select restriction_id from public.absence_sanctions where user_id=$1 and kind='suspension' and revoked_at is null limit 1",[user(113)])).rows[0].restriction_id;
  await assert.rejects(actor(1,"select public.admin_revoke_gym_access_restriction($1)",[id]),e=>e.detail==="review_case_required");
 });
 await check("Dos asistencias concurrentes al cruzar ocho no duplican el bono",async()=>{
  await client.query("alter table public.reservations disable trigger guard_reservation");
  try{for(let n=1;n<=9;n++)await client.query("insert into public.reservations(id,user_id,slot_id) values($1,$2,$3)",[res(114,n),user(114),slot(n)]);}finally{await client.query("alter table public.reservations enable trigger guard_reservation");}
  const insert="insert into public.attendance(reservation_id,recorded_by,method,manual_reason,checked_in_at) select $1,$2,'staff','camera_unavailable',starts_at+interval '5 minutes' from public.gym_slots where id=$3 /*bonus-threshold*/";
  await client.query("alter table public.attendance disable trigger guard_attendance");
  try{
   for(let n=1;n<=7;n++)await client.query(insert,[res(114,n),user(3),slot(n)]);
   const barrier=await newClient();await barrier.query("begin");await barrier.query("select 1 from public.point_periods where user_id=$1 for update",[user(114)]);
   const trustedInsert=async(n)=>{const fixtureClient=await newClient();try{await fixtureClient.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user(3),role:"authenticated"})]);return await fixtureClient.query(insert,[res(114,n),user(3),slot(n)]);}finally{await fixtureClient.end();}};
   const pending=Promise.all([trustedInsert(8),trustedInsert(9)]);void pending.catch(()=>{});
   try{let waiting=0;const deadline=Date.now()+5000;while(Date.now()<deadline){waiting=(await client.query("select count(*)::int as n from pg_stat_activity where query like '%/*bonus-threshold*/%' and wait_event_type='Lock'")).rows[0].n;if(waiting>=2)break;await new Promise(r=>setTimeout(r,20));}assert.equal(waiting,2);}finally{await barrier.query("commit");await barrier.end();}
   await pending;
  }finally{await client.query("alter table public.attendance enable trigger guard_attendance");}
  const s=await summary(114);assert.equal(s.monthly_attendances,9);assert.equal(s.monthly_bonus,20);assert.equal(Number(s.balance),110);
 });
 await check("Reglas futuras configurables no alteran periodos ya abiertos",async()=>{
  const cfg=(await client.query("select to_jsonb(r)-array['id','effective_month','created_at','created_by'] as value from public.point_program_rules r order by effective_month limit 1")).rows[0].value;
  const next=(await client.query("select (date_trunc('month',clock_timestamp() at time zone 'America/Bogota')+interval '1 month')::date as day")).rows[0].day;
  cfg.attendance_points=15;cfg.absence_period="rolling_days";cfg.absence_window_days=30;
  await actor(1,"select public.admin_create_point_rules($1,$2)",[next,cfg]);assert.equal((await summary(110)).attendance_points,10);
  await assert.rejects(actor(1,"select public.admin_create_point_rules($1,$2)",[month,cfg]),e=>e.detail==="future_rules_required");
 });
 // Versiones históricas SOLO de fixture: comprueban cambio de mes y periodo móvil.
 await client.query("insert into public.point_program_rules(effective_month,absence_period,created_at) select (date_trunc('month',clock_timestamp() at time zone 'America/Bogota')-interval '2 months')::date,'calendar_month',(date_trunc('month',clock_timestamp() at time zone 'America/Bogota')-interval '2 months') at time zone 'America/Bogota'");
 await client.query("insert into public.point_program_rules(effective_month,absence_period,created_at) select (date_trunc('month',clock_timestamp() at time zone 'America/Bogota')-interval '1 month')::date,'rolling_days',(date_trunc('month',clock_timestamp() at time zone 'America/Bogota')-interval '1 month') at time zone 'America/Bogota'");
 for(const n of [21,22])await client.query("insert into public.gym_slots(id,starts_at,ends_at) select $1,t,t+interval '20 minutes' from (select ((date_trunc('month',clock_timestamp() at time zone 'America/Bogota')-interval '1 month') at time zone 'America/Bogota')+make_interval(days=>$2)+interval '12 hours' t) q",[slot(n),n===21?-1:0]);
 await client.query("alter table public.reservations disable trigger guard_reservation");
 try{for(const [u,n] of [[115,21],[115,22],[113,22]])await client.query("insert into public.reservations(id,user_id,slot_id) values($1,$2,$3)",[res(u,n),user(u),slot(n)]);}finally{await client.query("alter table public.reservations enable trigger guard_reservation");}
 for(const n of [21,22])await actor(3,"select public.staff_close_gym_slot($1,true)",[slot(n)]);
 await check("Mes calendario no arrastra inasistencias del mes anterior",async()=>{
  const previous=(await client.query("select id from public.absence_cases where reservation_id=$1",[res(113,22)])).rows[0].id;await review(previous);
  const current=(await client.query("select ordinal from public.absence_sanctions where case_id=$1 and revoked_at is null",[cases[1]])).rows[0];assert.equal(current.ordinal,1);
 });
 await check("Periodo móvil configurable cuenta eventos que cruzan el cambio de mes",async()=>{
  const records=(await client.query("select id from public.absence_cases where user_id=$1 order by occurred_at,id",[user(115)])).rows;
  for(const record of records)await review(record.id);
  const row=(await client.query("select ordinal,kind,business_days from public.absence_sanctions where case_id=$1 and revoked_at is null",[records[1].id])).rows[0];assert.deepEqual(row,{ordinal:2,kind:"suspension",business_days:3});
 });
 await check("Cancelación administrativa y decisión simultáneas no sancionan reservas canceladas",async()=>{
  const barrier=await newClient();await barrier.query("begin");await barrier.query("select 1 from public.profiles where id=$1 for update",[user(113)]);
  const pending=Promise.allSettled([
   actor(1,"select public.admin_review_absence($1,'unjustified','evidence_confirmed',true) /*absence-cancel-race*/",[cases[0]]),
   actor(1,"select public.cancel_gym_reservation($1) /*absence-cancel-race*/",[res(113,1)])
  ]);
  try{let waiting=0;const deadline=Date.now()+5000;while(Date.now()<deadline){waiting=(await client.query("select count(*)::int as n from pg_stat_activity where query like '%/*absence-cancel-race*/%' and wait_event_type='Lock'")).rows[0].n;if(waiting>=2)break;await new Promise(r=>setTimeout(r,20));}assert.equal(waiting,2);}finally{await barrier.query("commit");await barrier.end();}
  const outcomes=await pending;assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.filter(r=>r.status==='rejected'&&['case_review_required','insufficient_evidence'].includes(r.reason.detail)).length,1);
  const row=(await client.query("select r.status as reservation_status,c.status as case_status from public.reservations r join public.absence_cases c on c.reservation_id=r.id where r.id=$1",[res(113,1)])).rows[0];
  assert.ok(row.reservation_status!=="cancelled"||row.case_status!=="unjustified");
 });
 await check("RLS protege movimientos, casos y justificaciones; no hay DML directo",async()=>{
  for(const table of ["point_program_rules","point_periods","point_transactions","attendance_invalidations","gym_slot_closeouts","absence_cases","absence_justifications","working_calendar","absence_sanctions"]){
   assert.equal((await client.query("select relrowsecurity from pg_class where oid=$1::regclass",['public.'+table])).rows[0].relrowsecurity,true);
   await assert.rejects(actor(null,`select * from public.${table}`,[],"anon"),e=>e.code==="42501");
   await assert.rejects(actor(1,`delete from public.${table}`),e=>e.code==="42501");
  }
  assert.ok((await actor(110,"select user_id from public.point_transactions")).every(r=>r.user_id===user(110)));
  assert.equal((await actor(114,"select * from public.absence_cases")).length,0);
  await assert.rejects(actor(114,"select public.submit_absence_justification($1,'access_problem')",[cases[0]]),e=>e.code==="42501");
 });
 await check("Libro e invalidaciones son inmutables, ajustes no permiten autoasignación",async()=>{
  await assert.rejects(client.query("update public.point_transactions set amount=amount"),e=>e.code==="42501");
  await assert.rejects(client.query("delete from public.attendance_invalidations"),e=>e.code==="42501");
  await assert.rejects(actor(1,"select public.admin_adjust_points($1,10,'correction',gen_random_uuid())",[user(1)]),e=>e.detail==="invalid_adjustment");
  await assert.rejects(actor(3,"select public.admin_adjust_points($1,10,'correction',gen_random_uuid())",[user(110)]),e=>e.code==="42501");
 });
 await check("Reversiones, decisiones y restricciones dejan trazabilidad auditada",async()=>{
  for(const table of ["point_transactions","attendance_invalidations","absence_cases","absence_justifications","absence_sanctions","working_calendar"]){assert.ok((await client.query("select count(*)::int as n from public.audit_logs where entity_table=$1",[table])).rows[0].n>0);}
  assert.ok((await client.query("select actor_id from public.audit_logs where entity_table='attendance_invalidations' limit 1")).rows[0].actor_id);
  assert.equal((await client.query("select count(*)::int as n from pg_trigger where tgname in ('guard_reservation','guard_attendance','immutable') and tgenabled<>'O'")).rows[0].n,0);
 });
 await writeFile(path.join(root,".database-tests/program-results.json"),JSON.stringify({engine:"PostgreSQL 17",passed:checks.length,checks},null,2)+"\n","utf8");console.log(`${checks.length} comprobaciones de puntos y constancia correctas.`);
}
