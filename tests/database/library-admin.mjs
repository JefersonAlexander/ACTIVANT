import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
export async function runLibraryAdminTests({ client, newClient, root }) {
 const checks=[], user=n=>`20000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
 async function actor(n,sql,args=[],operation="storage.object.get_authenticated",role="authenticated") {
  const c=await newClient();try { await c.query("begin");await c.query(`set local role ${role}`);await c.query("select set_config('request.jwt.claims',$1,true),set_config('test.storage_operation',$2,true)",[JSON.stringify(n?{sub:user(n),role}:{}),operation]);const r=await c.query(sql,args);await c.query("commit");return r.rows; }catch(e){await c.query("rollback");throw e;}finally{await c.end();}
 }
 async function check(name,fn){try{await fn();checks.push({name,status:"passed"});console.log(`Biblioteca/admin: ${name}`);}catch(e){throw new Error(`${name}: ${e.message}`,{cause:e});}}
 const count=async(n,table,id)=>(await actor(n,`select count(*)::int n from public.${table} where id=$1`,[id]))[0].n;
 const prepare=async(n=1,kind="cover",mime="image/png",size=100)=>(await actor(n,"select * from public.admin_prepare_wellness_asset($1,$2,$3)",[kind,mime,size]))[0];
 const upload=(n,a,mime="image/png",size=100)=>actor(n,"insert into storage.objects(bucket_id,name,metadata) values('activant-wellness',$1,$2)",[a.object_path,{size,mimetype:mime}],"storage.object.upload");
 const finalize=(n,a)=>actor(n,"select public.admin_finalize_wellness_asset($1)",[a.id]);
 const save=async({n=1,id=null,revision=0,title="Movilidad de prueba",cover=null,video=null,url=null,status="draft",authorized=false,category="movilidad"}={})=>(await actor(n,"select public.admin_save_wellness_content($1,$2,$3,'Descripción sintética para pruebas de seguridad',$4,10,$5,$6,$7,$8,$9) id",[id,revision,title,category,cover,video,url,status,authorized]))[0].id;
 const readFile=async(n,a,op="storage.object.get_authenticated",role="authenticated")=>(await actor(n,"select count(*)::int n from storage.objects where bucket_id='activant-wellness' and name=$1",[a.object_path],op,role))[0].n;
 let cover,draft,published,video;
 await check("Bucket privado y tablas con RLS, sin DML ni privilegios de servicio",async()=>{
  assert.equal((await client.query("select public from storage.buckets where id='activant-wellness'")).rows[0].public,false);
  for(const table of ["wellness_contents","wellness_assets","wellness_categories","admin_invitation_requests"]){assert.equal((await client.query("select relrowsecurity from pg_class where oid=$1::regclass",[`public.${table}`])).rows[0].relrowsecurity,true);await assert.rejects(actor(1,`delete from public.${table}`),e=>e.code==="42501");}
  await assert.rejects(actor(null,"select public.get_wellness_library_access()",[],"", "anon"),e=>e.code==="42501");
  await assert.rejects(actor(1,"select public.admin_get_gym_report(current_date,current_date)",[],"","service_role"),e=>e.code==="42501");
 });
 await check("Solo administradores preparan archivos, formatos y tamaños restringidos",async()=>{
  await assert.rejects(prepare(3),e=>e.code==="42501");await assert.rejects(prepare(121),e=>e.code==="42501");
  await assert.rejects(prepare(1,"cover","image/svg+xml"),e=>e.code==="23514");await assert.rejects(prepare(1,"cover","image/png",5242881),e=>e.code==="23514");
  cover=await prepare();assert.ok(cover.object_path.startsWith(user(1)+"/"));
 });
 await check("Carga exige manifiesto del actor; no puede suplantarse ni finalizar antes de tiempo",async()=>{
  await assert.rejects(upload(121,cover),e=>e.code==="42501");await assert.rejects(upload(2,cover),e=>e.code==="42501");
  await assert.rejects(upload(1,{object_path:user(1)+"/../otra.png"}),e=>e.code==="42501");
  await assert.rejects(finalize(1,cover),e=>e.code==="23514"&&e.detail==="upload_incomplete");
  await upload(1,cover);await finalize(1,cover);await finalize(1,cover);assert.equal((await client.query("select status from public.wellness_assets where id=$1",[cover.id])).rows[0].status,"ready");
 });
 await check("Finalización contrasta tamaño y MIME reales del objeto, no el nombre del cliente",async()=>{
  const a=await prepare();await upload(1,a,"image/jpeg",101);await assert.rejects(finalize(1,a),e=>e.code==="23514"&&e.detail==="invalid_media");
  await assert.rejects(finalize(2,a),e=>e.code==="42501");
 });
 await check("Borradores y archivos no publicados solo para administradores",async()=>{
  draft=await save();assert.equal(await count(1,"wellness_contents",draft),1);assert.equal(await count(121,"wellness_contents",draft),0);assert.equal(await readFile(121,cover),0);assert.equal(await readFile(1,cover),1);
 });
 await check("Publicar requiere portada lista, recurso y confirmación explícita",async()=>{
  await assert.rejects(save({status:"published",cover:cover.id,url:"https://example.invalid/video"}),e=>e.code==="23514"&&e.detail==="authorization_required");
  await assert.rejects(save({status:"published",authorized:true,url:"https://example.invalid/"}),e=>e.code==="23514");
  await assert.rejects(save({status:"published",authorized:true,cover:cover.id,url:"javascript:alert(1)"}),e=>e.code==="23514");
  published=await save({status:"published",authorized:true,cover:cover.id,url:"https://example.invalid/video"});
 });
 await check("Lectura con cuenta y vinculación activas, independiente de habilitación de gimnasio",async()=>{
  // Tres vinculaciones iniciales y un usuario sin habilitación de gimnasio.
  for(const n of [4,5,7,121]){assert.equal(await count(n,"wellness_contents",published),1);assert.equal(await readFile(n,cover),1);}
  for(const n of [6,10]){assert.equal(await count(n,"wellness_contents",published),0);assert.equal(await readFile(n,cover),0);}
 });
 await check("No se pueden listar objetos ni emitir URLs firmadas, incluso como administrador",async()=>{
  for(const n of [1,121]) for(const op of ["storage.object.list","storage.object.create_signed_url",""]) assert.equal(await readFile(n,cover,op),0);
  assert.equal(await readFile(null,cover,"storage.object.get_authenticated","anon"),0);
 });
 await check("Políticas permisivas ajenas no abren el bucket ni permiten sobrescribir o borrar",async()=>{
  await client.query("create policy fixture_broad on storage.objects for all to authenticated,anon using(true) with check(true)");
  try {assert.equal(await readFile(121,cover,"storage.object.list"),0);assert.equal(await readFile(null,cover,"","anon"),0);
   await client.query("insert into storage.buckets(id,name) values('fixture-other','fixture-other'); insert into storage.objects(bucket_id,name) values('fixture-other','visible.png')");
   assert.equal((await actor(null,"select count(*)::int n from storage.objects where bucket_id='fixture-other'",[],"","anon"))[0].n,1);
   assert.equal((await actor(1,"update storage.objects set metadata='{}' where name=$1 returning id",[cover.object_path])).length,0);
   assert.equal((await actor(1,"delete from storage.objects where name=$1 returning id",[cover.object_path])).length,0);
   await assert.rejects(upload(121,{object_path:"fuera-de-manifiesto.png"}),e=>e.code==="42501");
  }finally{await client.query("drop policy fixture_broad on storage.objects");}
 });
 await check("Archivado revoca la lectura de contenido y archivo, conserva auditoría",async()=>{
  await save({id:published,revision:1,status:"archived",cover:cover.id,url:"https://example.invalid/video"});assert.equal(await count(121,"wellness_contents",published),0);assert.equal(await readFile(121,cover),0);
  assert.equal((await client.query("select count(*)::int n from public.audit_logs where entity_table='wellness_contents' and entity_key->>'id'=$1",[published])).rows[0].n,2);
 });
 await check("Dos editores con la misma revisión solo producen un cambio",async()=>{
  const results=await Promise.allSettled([save({id:draft,revision:1,title:"Versión A de prueba"}),save({n:2,id:draft,revision:1,title:"Versión B de prueba"})]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(results.find(r=>r.status==="rejected").reason.detail,"content_conflict");
 });
 await check("Video privado válido; tipo de recurso, categoría y URL inseguros rechazados",async()=>{
  video=await prepare(1,"video","video/mp4",200);await upload(1,video,"video/mp4",200);await finalize(1,video);
  await assert.rejects(save({cover:video.id}),e=>e.detail==="cover_required");await assert.rejects(save({category:"sin_categoria"}),e=>e.code==="23503");
  await assert.rejects(save({cover:cover.id,video:video.id,url:"https://example.invalid/"}),e=>e.code==="23514");
  const id=await save({cover:cover.id,video:video.id,status:"published",authorized:true});assert.equal(await count(121,"wellness_contents",id),1);assert.equal(await readFile(121,video),1);
 });
 await check("Consultas de usuarios, indicadores, exportaciones y auditoría requieren admin real",async()=>{
  for(const n of [3,121,6]) for(const sql of ["select public.admin_list_activant_users()","select public.admin_get_gym_report(current_date,current_date)","select public.admin_read_audit(current_date,current_date)","select public.admin_record_export('franjas',current_date,current_date)"]) await assert.rejects(actor(n,sql),e=>e.code==="42501");
  const rows=await actor(1,"select * from public.admin_list_activant_users($1,1)",["fixture.invalid"]);assert.ok(rows.length>0);assert.ok(rows.every(r=>r.email.includes("fixture.invalid")));
 });
 await check("No se puede cambiar el propio acceso o rol, y los cambios a terceros se auditan",async()=>{
  await assert.rejects(actor(1,"select public.admin_set_profile_access($1,false,null)",[user(1)]),e=>e.code==="42501");
  await assert.rejects(actor(1,"select public.admin_set_user_role($1,'admin',false)",[user(1)]),e=>e.code==="42501");
  await actor(1,"select public.admin_set_profile_access($1,true,'contratista')",[user(130)]);
  assert.ok((await client.query("select count(*)::int n from public.audit_logs where entity_table='profiles' and actor_id=$1 and entity_key->>'id'=$2",[user(1),user(130)])).rows[0].n>0);
 });
 await check("Reportes usan Bogotá, límites inclusivos y no cuentan ausencia sin revisión",async()=>{
  await assert.rejects(actor(1,"select public.admin_get_gym_report('2026-01-01','2026-04-04')"),e=>e.code==="22023");
  await assert.rejects(actor(1,"select public.admin_read_audit('infinity','infinity')"),e=>e.code==="22023");
  const today=(await client.query("select (clock_timestamp() at time zone 'America/Bogota')::date::text d")).rows[0].d;
  const report=(await actor(1,"select public.admin_get_gym_report($1,$1) r",[today]))[0].r;
  assert.equal(report.summary.attendances,(await client.query("select count(*)::int n from public.attendance a join public.reservations r on r.id=a.reservation_id join public.gym_slots s on s.id=r.slot_id left join public.attendance_invalidations i on i.reservation_id=r.id where (s.starts_at at time zone 'America/Bogota')::date=$1 and i.reservation_id is null",[today])).rows[0].n);
  assert.equal(report.summary.absences,(await client.query("select count(*)::int n from public.absence_cases a join public.gym_slots s on s.id=a.slot_id where (s.starts_at at time zone 'America/Bogota')::date=$1 and a.status='unjustified'",[today])).rows[0].n);
  assert.equal(report.summary.recurrent_users,(await client.query("select count(*)::int n from(select r.user_id from public.reservations r join public.attendance a on a.reservation_id=r.id join public.gym_slots s on s.id=r.slot_id left join public.attendance_invalidations i on i.reservation_id=r.id where (s.starts_at at time zone 'America/Bogota')::date=$1 and i.reservation_id is null group by r.user_id having count(*)>=2) t",[today])).rows[0].n);
  assert.equal(report.slots.reduce((a,s)=>a+s.demand,0),report.summary.demand);assert.equal(report.daily.reduce((a,d)=>a+d.attendances,0),report.summary.attendances);
  assert.equal(report.hourly.reduce((a,h)=>a+h.demand,0),report.summary.demand);
 });
 await check("Consulta vacía conserva aprovechamiento desconocido; filtrado por franja coherente",async()=>{
  const report=(await actor(1,"select public.admin_get_gym_report('2001-01-01','2001-01-01') r"))[0].r;assert.equal(report.total_slots,0);assert.equal(report.summary.utilization_percent,null);assert.deepEqual(report.slots,[]);
  const slot=(await client.query("select id,(starts_at at time zone 'America/Bogota')::date::text d from public.gym_slots order by starts_at desc limit 1")).rows[0];
  const one=(await actor(1,"select public.admin_get_gym_report($1,$1,$2) r",[slot.d,slot.id]))[0].r;assert.equal(one.total_slots,1);assert.equal(one.slots[0].id,slot.id);assert.equal(one.slots[0].occupancy_percent,Math.round(10000*one.slots[0].confirmed/one.slots[0].capacity)/100);
 });
 await check("Exportación registra actor y filtros, auditoría omite datos y motivos privados",async()=>{
  const today=(await client.query("select (clock_timestamp() at time zone 'America/Bogota')::date::text d")).rows[0].d;
  await actor(1,"select public.admin_record_export('franjas',$1,$1)",[today]);
  const row=(await actor(1,"select * from public.admin_read_audit($1,$1,null,1,1)",[today]))[0];assert.equal(row.entity_table,"administrative_exports");assert.equal(row.actor_id,user(1));assert.equal("new_values" in row,false);assert.equal("old_values" in row,false);
  await assert.rejects(actor(1,"select public.admin_record_export('medicina',$1,$1)",[today]),e=>e.code==="22023");
 });
 await check("Invitaciones admin idempotentes, limitadas y nunca activan perfiles",async()=>{
  const id="98000000-0000-4000-8000-000000000001",email="invitacion-sintetica@fixture.invalid";
  await assert.rejects(actor(121,"select public.admin_begin_invitation($1,$2)",[id,email]),e=>e.code==="42501");
  const results=await Promise.all([actor(1,"select public.admin_begin_invitation($1,$2) ok",[id,email]),actor(1,"select public.admin_begin_invitation($1,$2) ok",[id,email])]);assert.equal(results.filter(r=>r[0].ok).length,1);
  await assert.rejects(actor(1,"select public.admin_begin_invitation(gen_random_uuid(),$1)",[email]),e=>e.detail==="invitation_limit");
  await assert.rejects(actor(1,"select public.admin_finish_invitation($1,'sent',$2)",[id,user(121)]),e=>e.code==="23514");
  const uid="98000000-0000-4000-8000-000000000002";await client.query("insert into auth.users(id,email) values($1,$2)",[uid,email]);await actor(1,"select public.admin_finish_invitation($1,'sent',$2)",[id,uid]);
  assert.equal((await client.query("select is_active from public.profiles where id=$1",[uid])).rows[0].is_active,false);
  assert.equal((await client.query("select role::text from public.user_roles where user_id=$1",[uid])).rows[0].role,"user");
 });
 await writeFile(path.join(root,".database-tests/library-admin-results.json"),JSON.stringify({checks,passed:checks.length},null,2));console.log(`${checks.length} comprobaciones de biblioteca y administración correctas.`);
}
