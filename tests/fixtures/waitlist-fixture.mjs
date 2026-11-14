// Datos sintéticos SOLO del servidor HTTP de pruebas; no forman parte de src.
import { randomUUID } from "node:crypto";
const states=new Map();
const slot={id:"99000000-0000-4000-8000-000000000001",starts_at:new Date(Date.now()+2*3600000).toISOString(),ends_at:new Date(Date.now()+2.5*3600000).toISOString(),capacity:1,status:"open"};
const defaults={waitlist_offer_minutes:5,reservation_reminders_enabled:false,reservation_reminder_minutes:60};
function state(account){if(!states.has(account.kind))states.set(account.kind,{queue:[],notifications:[],history:[],rules:{...defaults}});return states.get(account.kind);}
function notification(current,kind,offer=null,reservation=null){const key=`${kind}:${offer?.offer_id??reservation?.id??randomUUID()}`;if(!current.notifications.some(n=>n.key===key))current.notifications.unshift({id:randomUUID(),key,kind,offer_id:offer?.offer_id??null,created_at:new Date().toISOString(),read_at:null,gym_slots:slot});}
export function waitlistInfo(){return slot;}
export function waitlistEvent(kind,event){const current=state({kind});const row=current.queue.find(q=>q.status==="waiting");if(!row)return false;if(event==="offer"){row.offer_id=randomUUID();row.offer_status="pending";row.expires_at=new Date(Date.now()+current.rules.waitlist_offer_minutes*60000).toISOString();notification(current,"waitlist_offer",row);}else if(event==="expire"){row.offer_status="expired";row.status="expired";row.expires_at=new Date(Date.now()-1000).toISOString();notification(current,"waitlist_expired",row);}else if(event!=="expire-on-accept")return false;else current.expireOnAccept=true;return true;}
export function handleWaitlistFixture({account,table,url,body,send,counted,isAdmin,failed,method}){
 const current=state(account);const enabled=account.kind.startsWith("waitlist-");const error=failed||account.kind.startsWith("waitlist-error");const respond=(code,data)=>{send(code,data);return true;};
 if(table==="get_my_gym_waitlist")return error?respond(500,{message:"Fixture unavailable"}):respond(200,current.queue.map(r=>({...r,observed_at:new Date().toISOString()})));
 if(table==="notifications"){
  if(error)return respond(500,{message:"Fixture unavailable"});
  if(url.searchParams.get("user_id")!==`eq.${account.id}`)return respond(403,{});
  const all=current.notifications.filter(n=>url.searchParams.get("read_at")!=="is.null"||!n.read_at);const offset=Number(url.searchParams.get("offset")??0),limit=Number(url.searchParams.get("limit")??20);counted(all.slice(offset,offset+limit),all.length);return true;
 }
 if(table==="app_settings"&&url.searchParams.get("select")?.includes("waitlist_offer_minutes"))return error?respond(500,{}):respond(200,current.rules);
 if(table==="admin_update_notification_rules"){if(!isAdmin)return respond(403,{code:"42501"});current.rules={waitlist_offer_minutes:body.p_offer_minutes,reservation_reminders_enabled:body.p_reminders_enabled,reservation_reminder_minutes:body.p_reminder_minutes};return respond(200,null);}
 if(!enabled)return false;
 if(table==="get_gym_slot_availability"){
  const own=current.history.find(r=>r.status==="confirmed");const waiting=current.queue.find(q=>q.status==="waiting");const reason=own?"already_reserved":waiting?.offer_status==="pending"?"offer_response_required":"slot_full";
  return respond(200,[{slot_id:slot.id,...slot,occupied:waiting?.offer_status==="pending"?0:1,available:0,booking_opens_at:new Date(Date.now()-3600000).toISOString(),can_book:false,blocking_reason:reason,reservation_id:own?.id??null,observed_at:new Date().toISOString(),total_matches:1}]);
 }
 if(table==="join_gym_waitlist"){
  if(error)return respond(400,{details:"access_restricted"});
  if(current.queue.some(q=>q.status==="waiting"))return respond(400,{code:"23505"});
  const id=randomUUID();current.queue.unshift({id,slot_id:slot.id,status:"waiting",joined_at:new Date().toISOString(),queue_position:1,starts_at:slot.starts_at,ends_at:slot.ends_at,offer_id:null,offer_status:null,expires_at:null,reservation_id:null});return respond(200,id);
 }
 if(table==="leave_gym_waitlist"){const row=current.queue.find(q=>q.id===body.p_waitlist_id);if(!row)return respond(403,{code:"42501"});row.status="cancelled";if(row.offer_status==="pending")row.offer_status="declined";return respond(200,null);}
 if(table==="respond_gym_waitlist_offer"){
  const row=current.queue.find(q=>q.offer_id===body.p_offer_id);if(!row)return respond(403,{code:"42501"});
  if(current.expireOnAccept){current.expireOnAccept=false;waitlistEvent(account.kind,"expire");}
  if(row.offer_status!=="pending")return respond(200,[{outcome:row.offer_status,reservation_id:row.reservation_id}]);
  row.offer_status=body.p_accept?"accepted":"declined";row.status=body.p_accept?"promoted":"cancelled";
  if(body.p_accept){const r={id:randomUUID(),status:"confirmed",created_at:new Date().toISOString(),gym_slots:slot,attendance:null};row.reservation_id=r.id;current.history.unshift(r);notification(current,"reservation_confirmed",null,r);}
  return respond(200,[{outcome:row.offer_status,reservation_id:row.reservation_id}]);
 }
 if(table==="mark_notification_read"){const row=current.notifications.find(n=>n.id===body.p_notification_id);if(!row)return respond(403,{code:"42501"});row.read_at??=new Date().toISOString();return respond(200,null);}
 if(table==="reservations"){
  if(method==="HEAD"){counted([],current.history.length);return true;}
  const active=url.searchParams.get("status")==="eq.confirmed";counted(current.history.filter(r=>!active||r.status==="confirmed"));return true;
 }
 if(table==="cancel_gym_reservation"){const row=current.history.find(r=>r.id===body.p_reservation_id);if(!row)return respond(403,{code:"42501"});row.status="cancelled";notification(current,"reservation_cancelled",null,row);return respond(200,null);}
 return false;
}
