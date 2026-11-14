import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function runDatabaseTests({ client, newClient, root }) {
  const checks = [];
  const user = (n) => `20000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  const slot = (n) => `30000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  const reservation = (n) => `40000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  const asRole = async (role, sub, sql, params = []) => {
    assert.ok(["anon","authenticated","service_role"].includes(role));
    const c = await newClient();
    try {
      await c.query("begin");
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(sub ? { sub, role: "authenticated", user_metadata: { role: "admin", is_active: true } } : {})]);
      const result = await c.query(sql,params);
      await c.query("commit");
      return result;
    } catch(error) { await c.query("rollback"); throw error; }
    finally { await c.end(); }
  };
  const asUser = (n,sql,params) => asRole("authenticated",n === null ? null : user(n),sql,params);
  const check = async (name, fn) => {
    try { await fn(); checks.push({name,status:"passed"}); }
    catch(error) { throw new Error(`Prueba fallida: ${name}: ${error.message}`,{cause:error}); }
    if(checks.length % 10 === 0) console.log(`${checks.length} comprobaciones SQL correctas…`);
  };
  const denied = async (name,n,sql,params=[],code="42501") => check(name,()=>assert.rejects(asUser(n,sql,params),(e)=>e.code===code));
  const scalar = async (n,sql,params=[]) => (await asUser(n,sql,params)).rows[0];
  await client.query("select set_config('activant.fixture_mode','on',false)");
  await client.query(await readFile(path.join(root,"supabase/fixtures/local.sql"),"utf8"));

  await check("Migración conserva el perfil activo preexistente", async()=>{
    assert.deepEqual((await client.query("select is_active,affiliation_type from public.profiles where id=$1",[user(900)])).rows[0],{is_active:true,affiliation_type:null});
  });
  const tables=["affiliation_types","profiles","user_roles","gym_eligibility","gym_slots","reservations","attendance","waitlist","qr_challenges","app_settings","audit_logs"];
  for(const table of tables) {
    await check(`RLS habilitado: ${table}`,async()=>assert.equal((await client.query("select relrowsecurity from pg_class where oid=$1::regclass",[`public.${table}`])).rows[0].relrowsecurity,true));
    await check(`Anon no consulta ${table}`,()=>assert.rejects(asRole("anon",null,`select * from public.${table}`),(e)=>e.code==="42501"));
  }
  await check("Usuario solo consulta su perfil",async()=>assert.deepEqual((await asUser(4,"select id from public.profiles")).rows.map(r=>r.id),[user(4)]));
  await check("Usuario solo consulta su habilitación",async()=>assert.deepEqual((await asUser(4,"select user_id from public.gym_eligibility")).rows.map(r=>r.user_id),[user(4)]));
  await check("Usuario solo consulta sus roles reales, sin confiar en metadata",async()=>assert.deepEqual((await asUser(4,"select user_id,role from public.user_roles")).rows,[{user_id:user(4),role:"user"}]));
  await check("Admin activo consulta perfiles de usuarios",async()=>assert.equal((await asUser(1,"select count(*)::int as n from public.profiles")).rows[0].n,131));
  await check("Staff no consulta perfiles ajenos",async()=>assert.deepEqual((await asUser(3,"select id from public.profiles")).rows.map(r=>r.id),[user(3)]));
  await check("Usuario solo consulta sus reservas",async()=>assert.deepEqual((await asUser(4,"select user_id from public.reservations")).rows.map(r=>r.user_id),[user(4)]));
  await check("Staff consulta datos operativos de reservas",async()=>assert.equal((await asUser(3,"select count(*)::int as n from public.reservations")).rows[0].n,4));
  await check("Usuario no consulta auditoría",async()=>assert.equal((await asUser(4,"select count(*)::int as n from public.audit_logs")).rows[0].n,0));
  await check("Staff no consulta auditoría",async()=>assert.equal((await asUser(3,"select count(*)::int as n from public.audit_logs")).rows[0].n,0));
  await check("Admin consulta auditoría",async()=>assert.ok((await asUser(1,"select count(*)::int as n from public.audit_logs")).rows[0].n>0));
  await check("Perfil inactivo no consulta agenda",async()=>assert.equal((await asUser(6,"select count(*)::int as n from public.gym_slots")).rows[0].n,0));

  await check("Nueva identidad no hereda permisos desde metadata",async()=>{
    await client.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'new@fixture.invalid','{\"role\":\"admin\",\"is_active\":true}')",[user(901)]);
    assert.deepEqual((await client.query("select is_active,affiliation_type from public.profiles where id=$1",[user(901)])).rows[0],{is_active:false,affiliation_type:null});
    assert.deepEqual((await client.query("select role from public.user_roles where user_id=$1",[user(901)])).rows,[{role:"user"}]);
    assert.equal((await client.query("select is_eligible from public.gym_eligibility where user_id=$1",[user(901)])).rows[0].is_eligible,false);
  });
  const direct=[
    ["profiles","is_active=true"],["user_roles","role='admin'"],["gym_eligibility","is_eligible=true"],
    ["gym_slots","capacity=999"],["reservations","status='cancelled'"],["attendance","checked_in_at=clock_timestamp()"],
    ["waitlist","status='promoted'"],["qr_challenges","consumed_at=null"],["app_settings","default_slot_capacity=999"],["audit_logs","operation='DELETE'"]
  ];
  for(const [table,set] of direct) {
    await denied(`Usuario no actualiza directamente ${table}`,4,`update public.${table} set ${set}`);
    await denied(`Admin usa RPC, no UPDATE directo de ${table}`,1,`update public.${table} set ${set}`);
  }
  await denied("Usuario no inserta asistencia arbitraria",4,"insert into public.attendance(reservation_id,recorded_by,method) values($1,$2,'staff')",[reservation(4),user(4)]);
  await denied("Usuario no inserta reservas arbitrarias",4,"insert into public.reservations(user_id,slot_id) values($1,$2)",[user(5),slot(1)]);
  await denied("Usuario no invoca helpers privilegiados internos",4,"select activant_private.lock_eligible_user($1)",[user(4)]);
  await check("Anon no ejecuta reserva RPC",()=>assert.rejects(asRole("anon",null,"select public.reserve_gym_slot($1)",[slot(1)]),(e)=>e.code==="42501"));
  await denied("JWT sin identidad no reserva",null,"select public.reserve_gym_slot($1)",[slot(1)]);
  await denied("Usuario no se promociona a admin",4,"select public.admin_set_user_role($1,'admin',true)",[user(4)]);
  await denied("Staff no administra roles",3,"select public.admin_set_user_role($1,'admin',true)",[user(4)]);
  await denied("Admin no modifica sus propios roles",1,"select public.admin_set_user_role($1,'admin',false)",[user(1)]);
  await denied("Admin no modifica su propia habilitación",1,"select public.admin_set_gym_eligibility($1,true,clock_timestamp(),null)",[user(1)]);
  await denied("Admin no modifica su propio perfil de acceso",1,"select public.admin_set_profile_access($1,true,'servidor_planta')",[user(1)]);
  await check("Admin gestiona rol ajeno y se registra auditoría",async()=>{
    await asUser(1,"select public.admin_set_user_role($1,'gym_staff',true)",[user(15)]);
    assert.equal((await client.query("select count(*)::int as n from public.audit_logs where actor_id=$1 and entity_table='user_roles' and operation='INSERT'",[user(1)])).rows[0].n,1);
    await asUser(1,"select public.admin_set_user_role($1,'gym_staff',false)",[user(15)]);
  });
  await check("Admin administra perfil ajeno",async()=>{
    await asUser(1,"select public.admin_set_profile_access($1,false,'contratista')",[user(14)]);
    assert.deepEqual((await client.query("select is_active,affiliation_type from public.profiles where id=$1",[user(14)])).rows[0],{is_active:false,affiliation_type:"contratista"});
  });
  await check("Vinculación se extiende sin cambiar enum o roles",async()=>{
    await asUser(1,"select public.admin_upsert_affiliation_type('categoria_autorizada','Otra categoría autorizada',true)");
    assert.equal((await client.query("select count(*)::int as n from public.affiliation_types where code='categoria_autorizada'")).rows[0].n,1);
  });
  let adminManagedReservation;
  await check("Admin habilita a otro usuario para reservar mediante RPC",async()=>{
    await asUser(1,"select public.admin_set_profile_access($1,true,'contratista')",[user(14)]);
    await asUser(1,"select public.admin_set_gym_eligibility($1,true,clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days')",[user(14)]);
    adminManagedReservation=(await scalar(14,"select public.reserve_gym_slot($1) as id",[slot(4)])).id;
    assert.equal((await client.query("select authorized_by from public.gym_eligibility where user_id=$1",[user(14)])).rows[0].authorized_by,user(1));
  });
  await check("Admin cancela reserva ajena y conserva su historia",async()=>{
    await asUser(1,"select public.cancel_gym_reservation($1)",[adminManagedReservation]);
    assert.equal((await client.query("select status from public.reservations where id=$1",[adminManagedReservation])).rows[0].status,"cancelled");
  });
  await denied("FK rechaza vinculación inexistente",1,"select public.admin_set_profile_access($1,true,'no_existe')",[user(14)],"23503");
  await check("Admin inactivo pierde permisos aunque retenga rol",async()=>{
    await client.query("update public.profiles set is_active=false where id=$1",[user(2)]);
    await assert.rejects(asUser(2,"select public.admin_update_app_settings(20,120)"),(e)=>e.code==="42501");
    await client.query("update public.profiles set is_active=true where id=$1",[user(2)]);
  });
  await check("Defaults de capacidad inicial: 20",async()=>{
    assert.equal((await client.query("select default_slot_capacity from public.app_settings")).rows[0].default_slot_capacity,20);
    const value=await scalar(1,"select public.admin_create_gym_slot(clock_timestamp()+interval '7 days',clock_timestamp()+interval '7 days 1 hour') as id");
    assert.equal((await client.query("select capacity from public.gym_slots where id=$1",[value.id])).rows[0].capacity,20);
  });
  await check("Configuración administrativa aplica a nuevas franjas, sin reescribir las existentes",async()=>{
    await asUser(1,"select public.admin_update_app_settings(25,90)");
    const result=await scalar(1,"select public.admin_create_gym_slot(clock_timestamp()+interval '10 days',clock_timestamp()+interval '10 days 1 hour') as id");
    assert.equal((await client.query("select capacity from public.gym_slots where id=$1",[result.id])).rows[0].capacity,25);
    assert.equal((await client.query("select capacity from public.gym_slots where id=$1",[slot(1)])).rows[0].capacity,20);
    await asUser(1,"select public.admin_update_app_settings(20,120)");
  });
  await check("Admin actualiza capacidad y estado de una franja mediante RPC",async()=>{
    await asUser(1,"select public.admin_update_gym_slot(id,starts_at,ends_at,22,'closed') from public.gym_slots where id=$1",[slot(4)]);
    assert.deepEqual((await client.query("select capacity,status from public.gym_slots where id=$1",[slot(4)])).rows[0],{capacity:22,status:"closed"});
    await asUser(1,"select public.admin_update_gym_slot(id,starts_at,ends_at,20,'open') from public.gym_slots where id=$1",[slot(4)]);
  });
  await denied("Capacidad no puede ser cero",1,"select public.admin_create_gym_slot(clock_timestamp()+interval '8 days',clock_timestamp()+interval '8 days 1 hour',0)",[],"23514");
  await denied("Inicio debe ser anterior al fin",1,"select public.admin_create_gym_slot(clock_timestamp()+interval '8 days',clock_timestamp()+interval '7 days',20)",[],"23514");
  await denied("Franjas activas no se solapan",1,"select public.admin_create_gym_slot(starts_at,ends_at,20) from public.gym_slots where id=$1",[slot(1)],"23P01");

  for(const n of [6,7,8,9,10,13]) await denied(`No reserva usuario no habilitado ${n}`,n,"select public.reserve_gym_slot($1)",[slot(1)]);
  const first=(await scalar(4,"select public.reserve_gym_slot($1) as id",[slot(1)])).id;
  await check("Usuario activo y habilitado reserva",async()=>assert.equal((await client.query("select user_id from public.reservations where id=$1",[first])).rows[0].user_id,user(4)));
  await denied("No duplica reserva activa",4,"select public.reserve_gym_slot($1)",[slot(1)],"23505");
  await denied("No cancela reserva de otro usuario",5,"select public.cancel_gym_reservation($1)",[first]);
  await denied("No cambia horario con historia",1,"select public.admin_update_gym_slot(id,starts_at+interval '1 minute',ends_at+interval '1 minute',capacity,status) from public.gym_slots where id=$1",[slot(1)],"23514");
  await check("Cancelación conserva la historia y libera unicidad",async()=>{
    await asUser(4,"select public.cancel_gym_reservation($1)",[first]);
    const next=(await scalar(4,"select public.reserve_gym_slot($1) as id",[slot(1)])).id;
    assert.notEqual(first,next);
    assert.equal((await client.query("select status from public.reservations where id=$1",[first])).rows[0].status,"cancelled");
  });
  const full=(await scalar(4,"select public.reserve_gym_slot($1) as id",[slot(2)])).id;
  await denied("Franja llena impide reserva",5,"select public.reserve_gym_slot($1)",[slot(2)],"23514");
  const queued=(await scalar(5,"select public.join_gym_waitlist($1) as id",[slot(2)])).id;
  await check("Lista de espera solo visible al propietario",async()=>assert.equal((await asUser(4,"select count(*)::int as n from public.waitlist")).rows[0].n,0));
  await check("Propietario abandona su lista de espera mediante RPC",async()=>{
    const entry=(await scalar(17,"select public.join_gym_waitlist($1) as id",[slot(2)])).id;
    await asUser(17,"select public.leave_gym_waitlist($1)",[entry]);
    assert.equal((await client.query("select status from public.waitlist where id=$1",[entry])).rows[0].status,"cancelled");
  });
  await denied("No duplica entrada de espera",5,"select public.join_gym_waitlist($1)",[slot(2)],"23505");
  await denied("No abandona espera ajena",4,"select public.leave_gym_waitlist($1)",[queued]);
  await check("Oferta aceptada vincula y promociona entrada propia",async()=>{
    await asUser(4,"select public.cancel_gym_reservation($1)",[full]);
    const offer=(await scalar(5,"select offer_id from public.get_my_gym_waitlist() where id=$1",[queued])).offer_id;
    const id=(await scalar(5,"select reservation_id as id from public.respond_gym_waitlist_offer($1,true)",[offer])).id;
    assert.deepEqual((await client.query("select status,reservation_id from public.waitlist where id=$1",[queued])).rows[0],{status:"promoted",reservation_id:id});
  });

  await check("21 reservas concurrentes no superan 20 cupos",async()=>{
    const results=await Promise.allSettled(Array.from({length:21},(_,i)=>asUser(100+i,"select public.reserve_gym_slot($1)",[slot(5)])));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,20);
    assert.equal(results.filter(r=>r.status==="rejected" && r.reason.code==="23514").length,1);
    assert.equal((await client.query("select count(*)::int as n from public.reservations where slot_id=$1 and status='confirmed'",[slot(5)])).rows[0].n,20);
  });
  await denied("No reduce capacidad por debajo de ocupación",1,"select public.admin_update_gym_slot(id,starts_at,ends_at,19,status) from public.gym_slots where id=$1",[slot(5)],"23514");
  await check("Un aislamiento no admitido falla cerrado antes de modificar cupos",async()=>{
    for(const [actor,sql] of [[18,"select public.reserve_gym_slot($1)"],[1,"select public.admin_update_gym_slot(id,starts_at,ends_at,capacity,status) from public.gym_slots where id=$1"]]) {
      const c=await newClient();
      try {
        await c.query("begin isolation level repeatable read");
        await c.query("set local role authenticated");
        await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user(actor),role:"authenticated"})]);
        await assert.rejects(c.query(sql,[slot(1)]),(error)=>error.code==="0A000");
      } finally { await c.query("rollback"); await c.end(); }
    }
  });
  await check("Dos peticiones simultáneas no duplican una reserva",async()=>{
    const results=await Promise.allSettled([asUser(16,"select public.reserve_gym_slot($1)",[slot(3)]),asUser(16,"select public.reserve_gym_slot($1)",[slot(3)])]);
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(results.filter(r=>r.status==="rejected" && r.reason.code==="23505").length,1);
  });
  // La API personal preliminar queda inaccesible; las filas históricas se conservan.
  await denied("API de asistencia sin motivo queda retirada",3,"select public.record_gym_attendance($1)",[reservation(5)]);
  await denied("API de QR personal queda retirada",4,"select * from public.issue_gym_qr_challenge($1)",[reservation(4)]);
  await denied("API de consumo preliminar queda retirada",3,"select public.consume_gym_qr_challenge($1)",["0".repeat(64)]);
  await denied("Usuario no emite QR del gimnasio",4,"select * from public.issue_gym_display_qr()");
  await denied("Usuario no registra ingreso manual",4,"select * from public.record_gym_manual_attendance($1,'camera_unavailable')",[reservation(4)]);
  await check("Staff registra asistencia actual con motivo e identidad",async()=>{
    const row=(await asUser(3,"select * from public.record_gym_manual_attendance($1,'camera_unavailable')",[reservation(5)])).rows[0];
    assert.equal(row.outcome,"ok");
    assert.equal((await client.query("select recorded_by from public.attendance where reservation_id=$1",[reservation(5)])).rows[0].recorded_by,user(3));
  });
  await check("Usuario solo ve su asistencia",async()=>{
    assert.equal((await asUser(4,"select count(*)::int as n from public.attendance")).rows[0].n,0);
    assert.equal((await asUser(5,"select count(*)::int as n from public.attendance")).rows[0].n,1);
  });
  await check("Asistencia es inmutable incluso para mantenimiento SQL",()=>assert.rejects(client.query("update public.attendance set checked_in_at=checked_in_at"),(e)=>e.code==="42501"));
  await denied("Ni usuario ni admin leen hashes QR personales desde API",1,"select token_hash from public.qr_challenges");
  await check("Auditoría no permite reescritura",()=>assert.rejects(client.query("update public.audit_logs set database_actor=database_actor"),(e)=>e.code==="42501"));
  await check("Definer functions fijan search_path y excluyen anon",async()=>{
    const fns=(await client.query("select p.oid::regprocedure::text as signature,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','activant_private') and prosecdef")).rows;
    for(const fn of fns) {
      assert.ok(fn.proconfig?.includes('search_path=""'),fn.signature);
      assert.equal((await client.query("select has_function_privilege('anon',$1,'execute') as allowed",[fn.signature])).rows[0].allowed,false,fn.signature);
    }
  });
  await check("Servicio sin identidad no modifica tablas ni roles mediante RPC",()=>assert.rejects(asRole("service_role",null,"select public.admin_set_user_role($1,'admin',true)",[user(4)]),(e)=>e.code==="42501"));
  await check("Triggers de integridad se restauraron tras cargar fixtures",async()=>assert.equal((await client.query("select tgenabled from pg_trigger where tgname='guard_reservation'")).rows[0].tgenabled,"O"));
  await writeFile(path.join(root,".database-tests/results.json"),JSON.stringify({engine:"PostgreSQL 17",passed:checks.length,checks},null,2)+"\n","utf8");
  console.log(`${checks.length} comprobaciones de RLS, integridad, auditoría y concurrencia correctas.`);
}
