import { z } from "zod";
const integer=(max:number,min=0)=>z.coerce.number().int().min(min).max(max);
const flag=z.enum(["true","false"]).transform(v=>v==="true");
export const rulesFields={
 points_enabled:flag,attendance_points:integer(10000),cancellation_points:integer(10000),cancellation_limit:integer(20),cancellation_notice_minutes:integer(10080),
 first_bonus_count:integer(100,1),first_bonus_points:integer(10000),second_bonus_count:integer(200,2),second_bonus_points:integer(10000),
 absences_enabled:flag,absence_period:z.enum(["calendar_month","rolling_days"]),absence_window_days:integer(365,1),second_absence_days:integer(30,1),third_absence_days:integer(60,1),closeout_delay_minutes:integer(1440),
};
const ruleSchema=z.object({operation:z.literal("rules"),effectiveMonth:z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),...rulesFields}).refine(v=>v.second_bonus_count>v.first_bonus_count && v.second_bonus_points>=v.first_bonus_points && v.third_absence_days>=v.second_absence_days);
export const programMutationSchema=z.discriminatedUnion("operation",[
 z.object({operation:z.literal("adjust"),userId:z.uuid(),amount:integer(1000000,-1000000).refine(v=>v!==0),reason:z.enum(["correction","appeal"]),requestId:z.uuid()}),
 z.object({operation:z.literal("invalidate"),reservationId:z.uuid(),reason:z.enum(["duplicate_evidence","incorrect_entry","verified_absence"])}),
 z.object({operation:z.literal("justify"),caseId:z.uuid(),reason:z.enum(["unforeseen_event","reservation_dispute","access_problem"])}),
 z.object({operation:z.literal("review"),caseId:z.uuid(),status:z.enum(["justified","unjustified"]),reason:z.enum(["evidence_confirmed","justification_accepted","insufficient_evidence"]),evidence:z.literal("yes").optional()}),
 z.object({operation:z.literal("closeout"),slotId:z.uuid(),evidence:z.literal("yes")}),
 z.object({operation:z.literal("calendar"),start:z.iso.date(),end:z.iso.date(),nonWorking:z.string().max(1100).transform(v=>v.split(/[\s,;]+/).filter(Boolean)).pipe(z.array(z.iso.date()).max(93)),verified:z.literal("yes")}).refine(v=>v.end>=v.start),
 ruleSchema,
]);
export type ProgramState={status:"idle"|"success"|"error";message:string};
export const movementLabels:Record<string,string>={attendance:"Asistencia validada",cancellation:"Cancelación oportuna",monthly_bonus:"Ajuste de bono mensual",reversal:"Reversión por asistencia invalidada",adjustment:"Ajuste administrativo"};
export const caseLabels:Record<string,string>={pending_review:"Pendiente de revisión",justified:"Justificada",unjustified:"Injustificada"};
export const sanctionLabels:Record<string,string>={warning:"Advertencia",suspension:"Suspensión",administrative_review:"Revisión administrativa",pending_calendar:"Pendiente de calendario verificado"};
export const justificationLabels:Record<string,string>={unforeseen_event:"Imprevisto",reservation_dispute:"Desacuerdo con la reserva",access_problem:"Problema de acceso"};
export function programError(error:{details?:string|null;code?:string|null}) {
 const messages:Record<string,string>={evidence_required:"Revisa la evidencia y confirma su conciliación antes de continuar.",insufficient_evidence:"La evidencia no permite confirmar una inasistencia. Revisa la reserva y la asistencia.",no_justification:"Este caso aún no tiene una justificación presentada.",future_rules_required:"Las reglas nuevas deben comenzar en un mes futuro.",idempotency_conflict:"Esta solicitud ya fue utilizada. Actualiza antes de registrar otro movimiento.",invalid_adjustment:"Revisa el usuario, el valor y el motivo. No puedes ajustar tu propio saldo.",no_attendance:"La reserva no tiene una asistencia validada.",closeout_too_early:"La franja no ha terminado o sigue dentro del plazo de conciliación.",invalid_closeout:"No puedes conciliar esta franja.",invalid_calendar:"Revisa el rango futuro, las fechas no hábiles y la verificación del calendario.",review_case_required:"La restricción debe revisarse desde el caso de inasistencia."};
 if(error.details && Object.hasOwn(messages,error.details))return messages[error.details]!;
 if(error.code==="42501")return "No tienes autorización para realizar esta operación.";
 if(error.code==="23505")return "El registro ya existe. Actualiza la página para consultar su estado.";
 return "No pudimos confirmar la operación. Actualiza y revisa los registros antes de intentar nuevamente.";
}
