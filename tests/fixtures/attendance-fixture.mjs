// Contrato HTTP sintético del módulo de asistencia. Solo pruebas de navegador.
import { randomBytes } from "node:crypto";
const start=new Date(Date.now()-5*60000).toISOString();
const end=new Date(Date.now()+60*60000).toISOString();
const slotId="71000000-0000-4000-8000-000000000001";
const tokens=new Map();const histories=new Map();
export function resetAttendanceFixture(accountId){histories.delete(accountId);}
const reservationId=account=>`81000000-0000-4000-8000-${account.id.slice(-12)}`;
function create(outcome="ok") {const token=randomBytes(32).toString("hex");tokens.set(token,{outcome,expires:Date.now()+15000});return token;}
export function attendanceInfo(){
 const kinds=["ok","expired_qr","no_reservation","reservation_cancelled","already_recorded","outside_window","rate_limited"];
 return Object.fromEntries(kinds.map(kind=>[kind,`ACTIVANT:GYM:1:${create(kind)}`]));
}
export function handleAttendanceFixture({account,table,url,body,method,send,counted,isAdmin=false}){
 const staff=isAdmin || account.kind==="staff" || account.kind==="admin" || account.kind.startsWith("attendance-staff");
 const attendanceAccount=account.kind.startsWith("attendance");
 if(!histories.has(account.id))histories.set(account.id,[]);
 const history=histories.get(account.id);
 const respond=(status,value)=>{send(status,value);return true;};
 if(table==="issue_gym_display_qr"){
  if(!staff)return respond(403,{code:"42501",message:"Fixture denied"});
  const token=create();return respond(200,[{outcome:"ok",token,expires_at:new Date(tokens.get(token).expires).toISOString(),server_now:new Date().toISOString(),slot_id:slotId,starts_at:start,ends_at:end}]);
 }
 if(table==="check_in_gym_qr"){
  const token=tokens.get(body.p_token);let outcome=!token ? "invalid_qr" : token.expires<=Date.now() ? "expired_qr" : token.outcome;
  if(outcome==="ok" && history.length)outcome="already_recorded";
  if(outcome!=="ok")return respond(200,[{outcome,reservation_id:null,checked_in_at:null}]);
  const checked=new Date().toISOString();history.push({reservation_id:reservationId(account),checked_in_at:checked,method:"qr",manual_reason:null,reservations:{user_id:account.id,gym_slots:{starts_at:start,ends_at:end}}});
  return respond(200,[{outcome:"ok",reservation_id:reservationId(account),checked_in_at:checked}]);
 }
 if(table==="record_gym_manual_attendance"){
  if(!staff)return respond(403,{code:"42501",message:"Fixture denied"});
  if(body.p_reservation_id!==reservationId(account))return respond(200,[{outcome:"no_reservation",reservation_id:null,checked_in_at:null}]);
  if(history.length)return respond(200,[{outcome:"already_recorded",reservation_id:null,checked_in_at:null}]);
  const checked=new Date().toISOString();history.push({reservation_id:reservationId(account),checked_in_at:checked,method:"staff",manual_reason:body.p_reason,reservations:{user_id:account.id,gym_slots:{starts_at:start,ends_at:end}}});
  return respond(200,[{outcome:"ok",reservation_id:reservationId(account),checked_in_at:checked}]);
 }
 if(table==="attendance" && method!=="HEAD"){
  if(!staff && url.searchParams.get("reservations.user_id")!==`eq.${account.id}`)return respond(403,{});
  counted(attendanceAccount?history:[]);return true;
 }
 if(table==="attendance" && method==="HEAD" && attendanceAccount && staff){counted([],history.length);return true;}
 if(table==="reservations" && url.searchParams.get("gym_slots.starts_at")?.startsWith("lte.")){
  if(!staff)return respond(403,{});
  counted(attendanceAccount?[{id:reservationId(account),gym_slots:{starts_at:start,ends_at:end},attendance:history.length?{checked_in_at:history[0].checked_in_at}:null}]:[]);return true;
 }
 return false;
}
