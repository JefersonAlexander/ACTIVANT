import "server-only";
import { dayKey } from "@/modules/dashboard/dates";
import { cache } from "react";
import { requirePermission,requireUser } from "@/modules/auth/server";
import { read } from "@/lib/supabase/read";
export const getPointSummary=cache(async()=>{
 await requirePermission("member");const {client}=await requireUser();
 return read(client.rpc("get_my_point_summary").abortSignal(AbortSignal.timeout(10_000)).single());
});
export async function getPointHistory(page=1){
 const viewer=await requirePermission("member");const {client}=await requireUser();
 return {page,result:await read(client.from("point_transactions").select("id,kind,amount,reason,created_at,month_start,reservation_id",{count:"exact"}).eq("user_id",viewer.user.id).order("created_at",{ascending:false}).order("id").range((page-1)*10,page*10-1).abortSignal(AbortSignal.timeout(10_000)))};
}
function first<T>(relation:T|T[]|null):T|null{return Array.isArray(relation)?relation[0]??null:relation;}
export async function getAbsenceCases(page=1,admin=false){
 const viewer=await requirePermission(admin ? "admin":"member");const {client}=await requireUser();
 let query=client.from("absence_cases").select("id,reservation_id,user_id,occurred_at,status,decision_reason,reviewed_at,review_requested_at,absence_justifications(reason,submitted_at),absence_sanctions(kind,ordinal,business_days,revoked_at,gym_access_restrictions(starts_at,ends_at,revoked_at))",{count:"exact"});
 if(!admin)query=query.eq("user_id",viewer.user.id);
 else query=query.order("review_requested_at",{ascending:false,nullsFirst:false});
 const result=await read(query.order("occurred_at",{ascending:false}).order("id").range((page-1)*10,page*10-1).abortSignal(AbortSignal.timeout(10_000)));
 return {page,admin,result:{...result,data:result.data?.map(c=>({...c,justification:first(c.absence_justifications)}))??null}};
}
export async function getProgramAdmin(){
 await requirePermission("admin");const {client}=await requireUser();
 const [rules,calendar]=await Promise.all([
  read(client.from("point_program_rules").select("*").order("effective_month",{ascending:false}).limit(12).abortSignal(AbortSignal.timeout(10_000))),
  read(client.from("working_calendar").select("day,is_working",{count:"exact"}).gt("day",dayKey(new Date())).order("day").limit(93).abortSignal(AbortSignal.timeout(10_000))),
 ]);return {rules,calendar};
}
export async function getCloseoutSlots(){
 await requirePermission("attendance");const {client}=await requireUser();const now=new Date();
 return read(client.from("gym_slots").select("id,starts_at,ends_at,gym_slot_closeouts(closed_at)",{count:"exact"}).neq("status","cancelled").lte("ends_at",now.toISOString()).gte("ends_at",new Date(now.getTime()-7*86400000).toISOString()).order("ends_at",{ascending:false}).limit(30).abortSignal(AbortSignal.timeout(10_000)));
}
export type PointSummary=Awaited<ReturnType<typeof getPointSummary>>;
export type PointHistoryData=Awaited<ReturnType<typeof getPointHistory>>;
export type AbsenceCasesData=Awaited<ReturnType<typeof getAbsenceCases>>;
