import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
export async function runSecurityAuditTests({ client, root }) {
 const checks=[],admin="20000000-0000-4000-8000-000000000001";
 async function check(name,fn){try{await fn();checks.push({name,status:"passed"});console.log(`Auditoría: ${name}`);}catch(error){throw new Error(`${name}: ${error.message}`,{cause:error});}}
 async function asAdmin(sql,args=[]){await client.query("set local role authenticated");await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:admin,role:"authenticated"})]);const result=await client.query(sql,args);await client.query("reset role");return result.rows;}
 await check("Revisar una suspensión existente sin calendario futuro no la retira ni la vuelve a poner en cola",async()=>{
  await client.query("begin");try{
   const existing=(await client.query("select s.* from public.absence_sanctions s where s.user_id='20000000-0000-4000-8000-000000000115' and s.kind='suspension' and s.revoked_at is null order by s.created_at desc limit 1")).rows[0];assert.ok(existing,"La fixture debe tener una suspensión vigente o cumplida.");
   await client.query("delete from public.working_calendar where day>(clock_timestamp() at time zone 'America/Bogota')::date");
   await asAdmin("select public.admin_review_absence($1,'unjustified','evidence_confirmed',true)",[existing.case_id]);
   const actual=(await client.query("select id,kind from public.absence_sanctions where case_id=$1 and revoked_at is null",[existing.case_id])).rows[0];assert.deepEqual(actual,{id:existing.id,kind:"suspension"});
  }finally{await client.query("rollback");}
 });
 await check("Aceptar una justificación no reinicia desde hoy otra suspensión ya cumplida",async()=>{
  await client.query("begin");try{
   const rows=(await client.query("select s.*,r.starts_at from public.absence_sanctions s join public.absence_cases c on c.id=s.case_id left join public.gym_access_restrictions r on r.id=s.restriction_id where s.user_id='20000000-0000-4000-8000-000000000113' and s.revoked_at is null and activant_private.point_month(c.occurred_at)=activant_private.point_month(clock_timestamp()) order by s.ordinal")).rows;
   const warning=rows.find(s=>s.ordinal===1),suspension=rows.find(s=>s.ordinal===3&&s.kind==="suspension");assert.ok(warning&&suspension,"La fixture exige primera advertencia y tercera suspensión.");
   // Únicamente en el clúster descartable: simula una decisión ejecutada diez días atrás.
   await client.query("insert into public.working_calendar(day,is_working,verified_by) select d::date,true,$1 from generate_series((clock_timestamp() at time zone 'America/Bogota')::date-30,(clock_timestamp() at time zone 'America/Bogota')::date,interval '1 day') d on conflict do nothing",[admin]);
   const original=(await client.query("update public.gym_access_restrictions set starts_at=clock_timestamp()-interval '10 days',ends_at=clock_timestamp()-interval '1 day' where id=$1 returning starts_at",[suspension.restriction_id])).rows[0];
   await asAdmin("select public.admin_review_absence($1,'justified','insufficient_evidence',false)",[warning.case_id]);
   const actual=(await client.query("select s.ordinal,s.business_days,r.starts_at,r.ends_at from public.absence_sanctions s join public.gym_access_restrictions r on r.id=s.restriction_id where s.case_id=$1 and s.revoked_at is null",[suspension.case_id])).rows[0];assert.ok(actual);assert.equal(actual.ordinal,2);assert.equal(actual.business_days,3);assert.equal(actual.starts_at.toISOString(),original.starts_at.toISOString());assert.ok(actual.ends_at<new Date());
  }finally{await client.query("rollback");}
 });
 await check("Inventario completo: tablas públicas con RLS y funciones privilegiadas sin ejecución anónima",async()=>{
  assert.deepEqual((await client.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity")).rows,[]);
  assert.deepEqual((await client.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.prorettype<>'trigger'::regtype and has_function_privilege('anon',p.oid,'execute')")).rows,[]);
  assert.deepEqual((await client.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='activant_private' and has_function_privilege('authenticated',p.oid,'execute') and p.proname not in ('has_role','active_user','library_reader','can_read_wellness_asset','can_upload_wellness_asset')")).rows,[]);
 });
 await writeFile(path.join(root,".database-tests/security-audit-results.json"),JSON.stringify({passed:checks.length,checks},null,2)+"\n");
}
