import Link from "next/link";
import { ClipboardList,History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel,QuietEmpty,ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { formatDate,formatTime } from "@/modules/dashboard/dates";
import { caseLabels,justificationLabels,movementLabels,sanctionLabels } from "../contracts";
import type { AbsenceCasesData,PointHistoryData } from "../services/queries";
import { JustificationForm,ReviewForm } from "./program-forms";
function Pager({page,count,base,parameter,label}:{page:number;count:number|null;base:string;parameter:string;label:string}){
 return <nav aria-label={label} className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><span>Página {page} · {count??0} registros</span><div className="flex gap-2">{page>1 && <Button asChild variant="outline"><Link href={`${base}?${parameter}=${page-1}`}>Anterior</Link></Button>}{page*10<(count??0) && <Button asChild variant="outline"><Link href={`${base}?${parameter}=${page+1}`}>Siguiente</Link></Button>}</div></nav>;
}
export function PointHistory({data}:{data:PointHistoryData}){
 return <Panel title="Movimientos de puntos" description="Abonos, bonos y compensaciones. No se editan ni borran movimientos.">{data.result.error ? <ReadError message={data.result.error}/> : data.result.data?.length ? <ul className="divide-y">{data.result.data.map(t=><li key={t.id} className="flex items-start justify-between gap-3 py-4 first:pt-0"><div className="min-w-0"><p className="text-sm font-semibold">{movementLabels[t.kind]??"Movimiento"}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(t.created_at)} · {formatTime(t.created_at)}</p>{t.reservation_id && <p className="mt-1 break-all text-xs text-muted-foreground">Reserva: {t.reservation_id}</p>}</div><span className={`shrink-0 text-lg font-semibold tabular-nums ${t.amount<0?"text-foreground":"text-primary"}`}>{t.amount>0?"+":""}{t.amount}</span></li>)}</ul> : <QuietEmpty icon={History} title="Sin movimientos registrados" description="Los puntos aparecerán después de una asistencia validada o un evento que cumpla las reglas."/>}{!data.result.error && <Pager page={data.page} count={data.result.count} base="/constancia" parameter="movimientos" label="Páginas de movimientos"/>}</Panel>;
}
export function AbsenceCases({data}:{data:AbsenceCasesData}){
 const {result,page,admin}=data;
 return <Panel title={admin?"Casos para revisión":"Advertencias y revisiones"} description={admin?"Solo confirmar con evidencia suficiente. Cada decisión queda auditada.":"Puedes consultar las decisiones y solicitar revisión sin adjuntar información médica."}>
 {result.error ? <ReadError message={result.error}/> : result.data?.length ? <ul className="divide-y">{result.data.map(c=>{
  const sanction=c.absence_sanctions.find(s=>s.revoked_at===null);const restriction=sanction?.gym_access_restrictions;
  const justification=c.justification;
  return <li key={c.id} data-case-id={c.id} className="space-y-3 py-5 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{formatDate(c.occurred_at)} · {formatTime(c.occurred_at)}</p><Badge variant="outline">{caseLabels[c.status]??c.status}</Badge></div><p className="break-all text-xs text-muted-foreground">Reserva: {c.reservation_id}</p>{c.review_requested_at && c.status!=="pending_review" && <p className="text-sm font-medium text-primary">Revisión solicitada · pendiente de decisión.</p>}{admin && <p className="break-all text-xs text-muted-foreground">Usuario: {c.user_id}</p>}{sanction && <div className="rounded-lg border bg-secondary/50 p-3 text-sm leading-relaxed"><p className="font-medium">{sanctionLabels[sanction.kind]??sanction.kind} · caso {sanction.ordinal}</p>{sanction.business_days>0 && <p>{sanction.business_days} días hábiles completos.</p>}{restriction && <p className="mt-1">{restriction.revoked_at ? "Restricción revocada" : `Vigencia: ${formatDate(restriction.starts_at)} ${formatTime(restriction.starts_at)} hasta ${formatDate(restriction.ends_at)} ${formatTime(restriction.ends_at)}`}</p>}{sanction.kind==="pending_calendar" && <p>Sin suspensión aplicada hasta verificar el calendario y revisar el caso.</p>}</div>}{justification && <p className="text-sm leading-relaxed">Solicitud presentada: {justificationLabels[justification.reason]??"Revisión solicitada"}.</p>}{admin ? <ReviewForm caseId={c.id} hasJustification={!!justification}/> : c.status!=="justified" && !justification ? <JustificationForm caseId={c.id}/> : null}</li>;
 })}</ul> : <QuietEmpty icon={ClipboardList} title={admin?"Sin casos de inasistencia":"Sin advertencias ni revisiones"} description={admin?"Los cierres conciliados del personal generarán casos pendientes cuando corresponda.":"Las reservas y asistencias verificadas determinarán si hace falta una revisión."}/>}
 {!result.error && <Pager page={page} count={result.count} base={admin?"/admin/constancia":"/constancia"} parameter="casos" label="Páginas de revisiones"/>}
 </Panel>;
}
