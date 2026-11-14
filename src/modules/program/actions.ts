"use server";
import { revalidatePath } from "next/cache";
import { requirePermission,requireUser } from "@/modules/auth/server";
import { programMutationSchema,programError,type ProgramState } from "./contracts";
export async function mutateProgram(_state:ProgramState,form:FormData):Promise<ProgramState>{
 const {client}=await requireUser();
 const parsed=programMutationSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success)return {status:"error",message:"Revisa los campos, fechas y confirmaciones de la solicitud."};
 const value=parsed.data;
 await requirePermission(value.operation==="justify" ? "member" : value.operation==="closeout" ? "attendance" : "admin");
 const refresh=()=>{for(const path of ["/constancia","/admin/constancia","/dashboard","/asistencia","/control-asistencia","/admin","/gimnasio","/historial"])revalidatePath(path);};
 try {
  let error;let message="Operación registrada.";
  switch(value.operation){
   case "adjust":({error}=await client.rpc("admin_adjust_points",{p_user_id:value.userId,p_amount:value.amount,p_reason:value.reason,p_request_id:value.requestId}));message="Movimiento compensatorio registrado y auditado.";break;
   case "invalidate":({error}=await client.rpc("admin_invalidate_attendance",{p_reservation_id:value.reservationId,p_reason:value.reason}));message="Asistencia invalidada. Sus puntos y el bono mensual fueron conciliados.";break;
   case "justify":({error}=await client.rpc("submit_absence_justification",{p_case_id:value.caseId,p_reason:value.reason}));message="Justificación presentada para revisión administrativa.";break;
   case "review":({error}=await client.rpc("admin_review_absence",{p_case_id:value.caseId,p_status:value.status,p_reason:value.reason,p_evidence_confirmed:value.evidence==="yes"}));message="Caso revisado. Las advertencias y restricciones fueron conciliadas.";break;
   case "closeout":({error}=await client.rpc("staff_close_gym_slot",{p_slot_id:value.slotId,p_evidence_confirmed:true}));message="Cierre conciliado. Las posibles inasistencias quedan pendientes de revisión, sin sanción automática.";break;
   case "calendar":({error}=await client.rpc("admin_set_working_calendar",{p_start:value.start,p_end:value.end,p_non_working:value.nonWorking,p_verified:true}));message="Calendario verificado guardado. Vuelve a revisar los casos pendientes de calendario para aplicar la decisión.";break;
   case "rules":{
    const {operation:_,effectiveMonth,...rules}=value;void _;
    ({error}=await client.rpc("admin_create_point_rules",{p_effective_month:`${effectiveMonth}-01`,p_rules:rules}));message="Versión de reglas registrada para el mes indicado. Los periodos existentes conservan sus reglas.";break;
   }
  }
  refresh();return error ? {status:"error",message:programError(error)} : {status:"success",message};
 }catch{refresh();return {status:"error",message:programError({})};}
}
