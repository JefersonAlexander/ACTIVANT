// Datos sintéticos exclusivamente de pruebas; jamás se importan desde src.
import { randomUUID } from "node:crypto";
const states=new Map();
const month=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota"}).format(new Date()).slice(0,7)+"-01";
const defaults={id:"94000000-0000-4000-8000-000000000001",effective_month:month,created_at:new Date().toISOString(),created_by:null,points_enabled:true,attendance_points:10,cancellation_points:3,cancellation_limit:2,cancellation_notice_minutes:60,first_bonus_count:8,first_bonus_points:20,second_bonus_count:12,second_bonus_points:30,absences_enabled:true,absence_period:"calendar_month",absence_window_days:90,second_absence_days:3,third_absence_days:5,closeout_delay_minutes:15};
function state(account){
 if(!states.has(account.kind)){
  const populated=account.kind.startsWith("program-")&&!account.kind.startsWith("program-empty")&&!account.kind.startsWith("program-error") || account.kind==="program-desktop" || account.kind==="program-mobile";
  const history=populated ? [...Array.from({length:8},(_,n)=>({id:randomUUID(),kind:"attendance",amount:10,reason:"validated_attendance",created_at:new Date().toISOString(),month_start:month,reservation_id:`95000000-0000-4000-8000-${String(n+1).padStart(12,"0")}`})),{id:randomUUID(),kind:"monthly_bonus",amount:20,reason:"monthly_bonus_change",created_at:new Date().toISOString(),month_start:month,reservation_id:null}] : [];
  const subject=account.kind.startsWith("program-admin")?"96000000-0000-4000-8000-000000000099":account.id;
  states.set(account.kind,{history,rules:[{...defaults}],calendar:[],cases:populated?[{id:"97000000-0000-4000-8000-000000000001",reservation_id:"95000000-0000-4000-8000-000000000011",user_id:subject,occurred_at:new Date().toISOString(),status:"pending_review",decision_reason:null,reviewed_at:null,absence_justifications:null,absence_sanctions:[]},{id:"97000000-0000-4000-8000-000000000002",reservation_id:"95000000-0000-4000-8000-000000000012",user_id:subject,occurred_at:new Date().toISOString(),status:"unjustified",decision_reason:"evidence_confirmed",reviewed_at:new Date().toISOString(),absence_justifications:null,absence_sanctions:[{kind:"warning",ordinal:1,business_days:0,revoked_at:null,gym_access_restrictions:null}]}]:[]});
 }
 return states.get(account.kind);
}
export function handleProgramFixture({account,table,url,body,send,counted,isAdmin,failed}){
 const current=state(account);const error=failed||account.kind.startsWith("program-error");
 const respond=(status,data)=>{send(status,data);return true;};
 if(table==="get_my_point_summary"){
  if(error)return respond(500,{message:"Fixture unavailable"});
  return respond(200,{balance:current.history.reduce((sum,row)=>sum+row.amount,0),month_start:month,monthly_attendances:current.history.filter(t=>t.kind==="attendance").length,qualifying_attendances:current.history.filter(t=>t.kind==="attendance").length,monthly_bonus:current.history.filter(t=>t.kind==="monthly_bonus").reduce((sum,t)=>sum+t.amount,0),attendance_points:10,cancellation_points:3,cancellation_limit:2,cancellation_notice_minutes:60,first_bonus_count:8,first_bonus_points:20,second_bonus_count:12,second_bonus_points:30,points_enabled:true});
 }
 if(["point_transactions","absence_cases","point_program_rules","working_calendar"].includes(table)){
  if(error)return respond(500,{message:"Fixture unavailable"});
  if(["point_transactions","absence_cases"].includes(table)&&!isAdmin&&url.searchParams.get("user_id")!==`eq.${account.id}`)return respond(403,{});
  const all=table==="point_transactions"?current.history:table==="absence_cases"?current.cases:table==="point_program_rules"?current.rules:current.calendar;
  const offset=Number(url.searchParams.get("offset")??0);const limit=Number(url.searchParams.get("limit")??100);counted(all.slice(offset,offset+limit),all.length);return true;
 }
 if(table==="gym_slots"&&url.searchParams.get("select")?.includes("gym_slot_closeouts")){
  if(error)return respond(500,{});
  counted(account.kind.startsWith("program-admin")?[{id:"98000000-0000-4000-8000-000000000001",starts_at:new Date(Date.now()-3*3600000).toISOString(),ends_at:new Date(Date.now()-2*3600000).toISOString(),gym_slot_closeouts:null}]:[]);return true;
 }
 if(table==="submit_absence_justification"){
  const row=current.cases.find(c=>c.id===body.p_case_id);if(!row)return respond(403,{});row.absence_justifications={reason:body.p_reason,submitted_at:new Date().toISOString()};return respond(200,null);
 }
 if(["admin_review_absence","admin_adjust_points","admin_invalidate_attendance","admin_set_working_calendar","admin_create_point_rules"].includes(table)&&!isAdmin)return respond(403,{code:"42501"});
 if(table==="admin_review_absence"){
  const row=current.cases.find(c=>c.id===body.p_case_id);if(!row)return respond(403,{});
  if(body.p_status==="unjustified"&&!body.p_evidence_confirmed)return respond(400,{code:"23514",details:"evidence_required"});
  row.status=body.p_status;row.decision_reason=body.p_reason;return respond(200,null);
 }
 if(table==="admin_adjust_points")return respond(200,randomUUID());
 if(table==="admin_invalidate_attendance")return respond(200,null);
 if(table==="admin_set_working_calendar"){
  current.calendar=[{day:body.p_start,is_working:true},{day:body.p_end,is_working:true}];return respond(200,null);
 }
 if(table==="admin_create_point_rules"){
  if(current.rules.some(r=>r.effective_month===body.p_effective_month))return respond(400,{code:"23505"});
  current.rules.unshift({...defaults,...body.p_rules,id:randomUUID(),effective_month:body.p_effective_month});return respond(200,randomUUID());
 }
 if(table==="staff_close_gym_slot")return isAdmin||account.kind==="staff" ? respond(200,1):respond(403,{code:"42501"});
 return false;
}
