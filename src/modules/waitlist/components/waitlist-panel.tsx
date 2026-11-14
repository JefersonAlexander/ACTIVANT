import Link from "next/link";
import { Clock3, TicketCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/modules/dashboard/dates";
import { Panel, QuietEmpty, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import type { ReadResult } from "@/lib/supabase/read";
import type { WaitlistEntry } from "../types";
import { OfferResponse, WaitlistButton } from "./waitlist-controls";
const states: Record<string, string> = { waiting: "En espera", promoted: "Reserva confirmada", cancelled: "Solicitud retirada", expired: "Solicitud finalizada" };
const offers: Record<string, string> = { pending: "Cupo ofrecido", accepted: "Oferta aceptada", declined: "Oferta rechazada", expired: "Oferta vencida", revoked: "Oferta retirada" };
export function WaitlistPanel({ result, history = false }: { result: ReadResult<WaitlistEntry[]>; history?: boolean }) {
  const active = result.data?.filter(e => e.status === "waiting") ?? [];
  const past = result.data?.filter(e => e.status !== "waiting") ?? [];
  return <Panel title="Tu lista de espera" description="Los cupos se ofrecen por orden de ingreso. Debes aceptar antes del vencimiento.">
    {result.error ? <ReadError message={result.error} /> : <>
      {active.length ? <ul className="space-y-4">{active.map(entry => {
        const offered = entry.offer_status === "pending" && entry.expires_at && entry.expires_at > entry.observed_at;
        return <li key={entry.id} data-waitlist-id={entry.id} className={`rounded-xl border p-4 ${offered ? "border-primary/30 bg-secondary/40" : "bg-white"}`}>
          <div className="flex flex-wrap items-center gap-2"><Badge variant={offered ? "default" : "outline"}>{offered ? <><TicketCheck className="mr-1 size-3.5" aria-hidden="true" />Tienes un cupo</> : <><Clock3 className="mr-1 size-3.5" aria-hidden="true" />En espera</>}</Badge><span className="text-sm font-medium">Posición {entry.queue_position}</span></div>
          <p className="mt-3 text-sm font-semibold">{formatDate(entry.starts_at)} · {formatTime(entry.starts_at)} – {formatTime(entry.ends_at)}</p>
          {offered ? <><p className="my-3 text-sm leading-relaxed text-muted-foreground">Acepta antes de las {formatTime(entry.expires_at!)} del {formatDate(entry.expires_at!)} (Colombia). Si vence, el cupo pasa a la siguiente persona.</p><OfferResponse entry={entry} /></> : <div className="mt-3"><p className="mb-3 text-sm leading-relaxed text-muted-foreground">{entry.offer_status === "pending" ? "El plazo de tu oferta terminó. El sistema actualizará la solicitud automáticamente." : "Te avisaremos en ACTIVANT cuando te corresponda un cupo. Estar en espera todavía no es una reserva."}</p><WaitlistButton id={entry.id} operation="leave">Salir de la lista</WaitlistButton></div>}
        </li>;
      })}</ul> : <QuietEmpty icon={Clock3} title="Sin solicitudes en espera" description="Puedes unirte desde el calendario cuando una franja esté completa." />}
      <Button asChild variant="outline" className="mt-4"><Link href="/gimnasio">Consultar franjas</Link></Button>
      {history && past.length > 0 && <details className="mt-5 border-t pt-3"><summary className="min-h-11 cursor-pointer rounded-lg py-3 text-sm font-semibold">Historial de solicitudes y ofertas</summary><ul className="divide-y">{past.map(e => <li key={e.id} className="space-y-1 py-3 text-sm"><p className="font-medium">{formatDate(e.starts_at)} · {formatTime(e.starts_at)} – {formatTime(e.ends_at)}</p><p className="text-muted-foreground">{states[e.status]}{e.offer_status ? ` · ${offers[e.offer_status] ?? "Oferta finalizada"}` : ""}</p>{e.reservation_id && <Link href="/historial" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver mi reserva</Link>}</li>)}</ul></details>}
      {result.data?.length === 100 && <p className="mt-4 text-sm text-muted-foreground">Se muestran hasta 100 solicitudes, con prioridad para las activas.</p>}
    </>}
  </Panel>;
}
