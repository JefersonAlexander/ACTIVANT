// Doble HTTP solo de pruebas, sin datos de respaldo en src/.
import { randomUUID } from "node:crypto";
export const fixturePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
const coverId="97000000-0000-4000-8000-000000000001",contentId="97000000-0000-4000-8000-000000000002",slotId="97000000-0000-4000-8000-000000000003",reservationId="97000000-0000-4000-8000-000000000004",targetId="97000000-0000-4000-8000-000000000005";
const states=new Map();
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota"}).format(new Date());
const slot=()=>({id:slotId,starts_at:`${today()}T10:00:00-05:00`,ends_at:`${today()}T11:00:00-05:00`,capacity:20,status:"open"});
export function reviseLibraryFixture(kind,id){const content=states.get(kind)?.contents.find(c=>c.id===id);if(!content)return false;content.title="Edición concurrente de prueba";content.revision+=1;content.updated_at=new Date().toISOString();return true;}
function stateFor(account){if(!states.has(account.kind)) states.set(account.kind,{contents:[{id:contentId,title:"Movilidad de prueba",description:"Recurso sintético para verificar la biblioteca. No es material institucional publicado.",category:"movilidad",duration_minutes:10,cover_asset_id:coverId,video_asset_id:null,external_url:"https://example.invalid/actividad",status:"published",created_by:account.id,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),published_at:new Date().toISOString(),authorized_by:account.id,authorized_at:new Date().toISOString(),revision:1}],assets:[{id:coverId,kind:"cover",mime_type:"image/png",size_bytes:fixturePng.length,object_path:`${account.id}/${coverId}.png`,status:"ready",created_at:new Date().toISOString(),uploaded:true}],users:[{id:account.id,email:account.email,is_active:true,affiliation_type:"servidor_planta",roles:["user","admin"],is_eligible:true,valid_from:"2026-01-01T00:00:00Z",valid_until:null,total_matches:2},{id:targetId,email:"gestion-prueba@fixture.invalid",is_active:false,affiliation_type:null,roles:["user"],is_eligible:false,valid_from:"2026-01-01T00:00:00Z",valid_until:null,total_matches:2}],invites:[],audit:[],reservation:{id:reservationId,user_id:targetId,status:"confirmed",created_at:new Date().toISOString(),cancelled_at:null,gym_slots:slot(),attendance:null}});return states.get(account.kind);}
export function handleLibraryStorage({account,url,req,res,send,buffer}){
 if(!url.pathname.startsWith("/storage/v1/"))return false;
 if(!account){send(401,{message:"Fixture unauthenticated"});return true;}
 const state=stateFor(account),isAdmin=account.kind.includes("admin");
 if(req.method==="POST"&&url.pathname.startsWith("/storage/v1/object/activant-wellness/")){
  const path=decodeURIComponent(url.pathname.slice("/storage/v1/object/activant-wellness/".length));const asset=state.assets.find(a=>a.object_path===path&&a.status==="pending");
  if(!isAdmin||!asset||!buffer.length){send(403,{message:"Fixture denied upload"});return true;}asset.uploaded=true;send(200,{Id:asset.id,Key:`activant-wellness/${path}`});return true;
 }
 if(req.method==="GET"&&url.pathname.startsWith("/storage/v1/object/authenticated/activant-wellness/")){
  const path=decodeURIComponent(url.pathname.slice("/storage/v1/object/authenticated/activant-wellness/".length)),a=state.assets.find(a=>a.object_path===path);
  const visible=a&&a.status==="ready"&&(isAdmin||state.contents.some(c=>c.status==="published"&&(c.cover_asset_id===a.id||c.video_asset_id===a.id)));
  if(!visible||account.kind.startsWith("library-denied")){send(404,{});return true;}
  res.setHeader("Content-Type",a.mime_type);res.setHeader("Accept-Ranges","bytes");
  const start=Number(/^bytes=(\d+)-/.exec(req.headers.range??"")?.[1]??0),end=Math.min(Number(/-(\d+)$/.exec(req.headers.range??"")?.[1]??fixturePng.length-1),fixturePng.length-1);
  if(start> end){res.statusCode=416;res.end();return true;}
  const bytes=fixturePng.subarray(start,end+1);res.statusCode=req.headers.range?206:200;if(req.headers.range)res.setHeader("Content-Range",`bytes ${start}-${end}/${fixturePng.length}`);res.setHeader("Content-Length",bytes.length);res.end(bytes);return true;
 }
 send(403,{message:"Fixture disallows public and signed paths"});return true;
}
export function handleLibraryAdminFixture({account,table,url,body,send,counted,isAdmin}){
 const library=account.kind.startsWith("library-"),management=account.kind.startsWith("management-");const failed=account.kind.includes("library-error")||account.kind.includes("management-error");
 if(table==="get_wellness_library_access"){send(failed?500:200,failed?{}:!account.kind.startsWith("library-denied"));return true;}
 if(["wellness_contents","wellness_assets"].includes(table)){
  if(failed){send(500,{message:"Fixture unavailable"});return true;}
  if(!library&&!management){counted([]);return true;}
  const s=stateFor(account);let rows=table==="wellness_contents"?s.contents:s.assets;
  if(account.kind.startsWith("library-empty")||account.kind.startsWith("library-denied"))rows=[];
  if(table==="wellness_contents"&&!isAdmin)rows=rows.filter(r=>r.status==="published");
  for(const key of ["status","category","id"])if(url.searchParams.get(key)?.startsWith("eq.")) rows=rows.filter(r=>r[key]===url.searchParams.get(key).slice(3));
  if(url.searchParams.has("title")){const needle=url.searchParams.get("title").slice(7,-1).toLowerCase();rows=rows.filter(r=>r.title.toLowerCase().includes(needle));}
  counted(rows);return true;
 }
 if(!management)return false;
 const s=stateFor(account);
 const adminTables=["admin_list_activant_users","admin_get_gym_report","admin_read_audit","admin_record_export","admin_set_profile_access","admin_set_user_role","admin_set_gym_eligibility","admin_prepare_wellness_asset","admin_finalize_wellness_asset","admin_save_wellness_content","admin_begin_invitation","admin_finish_invitation","admin_invitation_requests","affiliation_types"];
 if(adminTables.includes(table)&&!isAdmin){send(403,{code:"42501"});return true;}
 if(failed&&adminTables.includes(table)){send(500,{message:"Fixture unavailable"});return true;}
 const log=(entity,id)=>s.audit.unshift({id:s.audit.length+1,occurred_at:new Date().toISOString(),actor_id:account.id,database_actor:"authenticator",operation:"UPDATE",entity_table:entity,entity_key:{id},total_matches:s.audit.length+1});
 if(table==="admin_prepare_wellness_asset"){const id=randomUUID(),a={id,object_path:`${account.id}/${id}.${body.p_kind==="cover"?"png":"mp4"}`,kind:body.p_kind,mime_type:body.p_mime_type,size_bytes:body.p_size_bytes,status:"pending",created_at:new Date().toISOString()};s.assets.push(a);send(200,[{id:a.id,object_path:a.object_path}]);return true;}
 if(table==="admin_finalize_wellness_asset"){const a=s.assets.find(a=>a.id===body.p_asset_id);if(!a?.uploaded){send(400,{code:"23514",details:"upload_incomplete"});return true;}a.status="ready";send(200,null);return true;}
 if(table==="admin_save_wellness_content"){
  const old=s.contents.find(c=>c.id===body.p_id);if(old&&old.revision!==body.p_revision){send(400,{code:"23514",details:"content_conflict"});return true;}
  const c={id:body.p_id??randomUUID(),title:body.p_title,description:body.p_description,category:body.p_category,duration_minutes:body.p_duration_minutes,cover_asset_id:body.p_cover_asset_id,video_asset_id:body.p_video_asset_id,external_url:body.p_external_url,status:body.p_status,revision:(old?.revision??0)+1,created_by:account.id,created_at:old?.created_at??new Date().toISOString(),updated_at:new Date().toISOString(),published_at:new Date().toISOString(),authorized_by:body.p_authorized?account.id:null,authorized_at:body.p_authorized?new Date().toISOString():null};if(old)Object.assign(old,c);else s.contents.unshift(c);log("wellness_contents",c.id);send(200,c.id);return true;
 }
 if(table==="affiliation_types"){send(200,[{code:"servidor_planta",label:"Servidor de planta",is_active:true},{code:"contratista",label:"Contratista",is_active:true},{code:"practicante",label:"Practicante",is_active:true}]);return true;}
 if(table==="admin_list_activant_users"){send(200,s.users.filter(u=>!body.p_search||u.email.includes(body.p_search)));return true;}
 if(["admin_set_profile_access","admin_set_user_role","admin_set_gym_eligibility"].includes(table)){
  const u=s.users.find(u=>u.id===body.p_user_id);if(!u||u.id===account.id){send(403,{code:"42501"});return true;}
  if(table==="admin_set_profile_access")Object.assign(u,{is_active:body.p_is_active,affiliation_type:body.p_affiliation_type});
  if(table==="admin_set_user_role")u.roles=body.p_enabled?[...new Set([...u.roles,body.p_role])]:u.roles.filter(r=>r!==body.p_role);
  if(table==="admin_set_gym_eligibility")Object.assign(u,{is_eligible:body.p_is_eligible,valid_from:body.p_valid_from,valid_until:body.p_valid_until??null});
  log(table,u.id);send(200,null);return true;
 }
 if(table==="admin_invitation_requests"){counted(s.invites);return true;}
 if(table==="admin_begin_invitation"){if(s.invites.some(i=>i.id===body.p_request_id)){send(200,false);return true;}s.invites.unshift({id:body.p_request_id,email:body.p_email,status:"pending",created_at:new Date().toISOString(),user_id:null});send(200,true);return true;}
 if(table==="admin_finish_invitation"){const r=s.invites.find(i=>i.id===body.p_request_id);if(r)Object.assign(r,{status:body.p_status,user_id:body.p_user_id??null});log("admin_invitation_requests",body.p_request_id);send(200,null);return true;}
 if(table==="gym_slots"&&!url.searchParams.get("select")?.includes("reservations(count)")){counted([slot()]);return true;}
 if(table==="reservations"&&url.searchParams.get("select")?.includes("user_id,status")){counted([s.reservation]);return true;}
 if(table==="cancel_gym_reservation"&&body.p_reservation_id===reservationId){s.reservation.status="cancelled";s.reservation.cancelled_at=new Date().toISOString();log("reservations",reservationId);send(200,null);return true;}
 if(table==="admin_get_gym_report"){
  const f={...slot(),report_day:today(),confirmed:4,cancelled:1,effective_attendances:3,absences:1,pending_reviews:2,demand:7,held:1,occupancy_percent:20,utilization_percent:15};
  const included=body.p_start<=today()&&body.p_end>=today()&&(!body.p_slot_id||body.p_slot_id===slotId);
  send(200,{observed_at:new Date().toISOString(),total_slots:included?1:0,summary:included?{reservations:4,cancellations:1,attendances:3,absences:1,pending_reviews:2,demand:7,capacity:20,utilization_percent:15,participants:2,recurrent_users:1}:{reservations:0,cancellations:0,attendances:0,absences:0,pending_reviews:0,demand:0,capacity:0,utilization_percent:null,participants:0,recurrent_users:0},slots:included?[f]:[],daily:included?[{report_day:today(),attendances:3,cancellations:1,participants:2}]:[],hourly:included?[{start_time:"10:00",slots:1,demand:7,attendances:3}]:[]});return true;
 }
 if(table==="admin_record_export"){log("administrative_exports",randomUUID());send(200,null);return true;}
 if(table==="admin_read_audit"){send(200,s.audit.slice(0,body.p_limit??30).map(r=>({...r,total_matches:s.audit.length})));return true;}
 return false;
}
