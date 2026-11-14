"use client";
import { useActionState, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatTime } from "@/modules/dashboard/dates";
import { mutateWaitlist, saveNotificationRules } from "../actions";
import { initialWaitlistState, type WaitlistActionState } from "../contracts";
import type { WaitlistEntry } from "../types";
function Feedback({ state, pending }: { state: WaitlistActionState; pending: boolean }) {
  if (pending) return <p role="status" className="text-sm text-muted-foreground">Procesando solicitud…</p>;
  return state.message && <p role={state.status === "error" ? "alert" : "status"} className={`text-sm leading-relaxed ${state.status === "error" ? "text-destructive" : "text-primary"}`}>{state.message}</p>;
}
export function WaitlistButton({ id, operation, children, completed = false }: { id: string; operation: "join" | "leave" | "read"; children: React.ReactNode; completed?: boolean }) {
  const [state, action, pending] = useActionState(mutateWaitlist, initialWaitlistState);
  return <div className="space-y-2">{!completed && <form action={action} aria-busy={pending}><input type="hidden" name="operation" value={operation} /><input type="hidden" name="id" value={id} /><Button variant="outline" type="submit" disabled={pending}>{children}</Button></form>}<Feedback state={state} pending={pending} /></div>;
}
export function OfferResponse({ entry }: { entry: WaitlistEntry }) {
  const [state, action, pending] = useActionState(mutateWaitlist, initialWaitlistState);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const description = useId();
  useEffect(() => { if (state.status !== "idle") dialog.current?.close(); }, [state]);
  if (!entry.offer_id) return null;
  return <div className="space-y-3"><div className="flex flex-wrap gap-2"><Button onClick={() => dialog.current?.showModal()} disabled={pending}>Aceptar cupo</Button><form action={action} aria-busy={pending}><input type="hidden" name="operation" value="decline" /><input type="hidden" name="id" value={entry.offer_id} /><Button type="submit" variant="outline" disabled={pending}>Rechazar cupo</Button></form></div><Feedback state={state} pending={pending} />
    <dialog ref={dialog} aria-labelledby={title} aria-describedby={description} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border bg-white p-6 text-foreground shadow-xl backdrop:bg-foreground/40">
      <h2 id={title} className="text-xl font-semibold">Confirma tu cupo</h2><p className="mt-4 text-sm font-medium">{formatDate(entry.starts_at)} · {formatTime(entry.starts_at)} – {formatTime(entry.ends_at)}</p><p id={description} className="my-5 text-sm leading-relaxed text-muted-foreground">Se creará tu reserva en el gimnasio si la oferta sigue vigente y conservas la habilitación. La hora y la disponibilidad se verifican en el servidor.</p>
      <form action={action} aria-busy={pending} className="flex flex-wrap gap-3"><input type="hidden" name="operation" value="accept" /><input type="hidden" name="id" value={entry.offer_id} /><Button type="submit" disabled={pending}>Confirmar reserva</Button><Button variant="outline" disabled={pending} onClick={() => dialog.current?.close()}>Volver</Button></form>
    </dialog></div>;
}
export function NotificationRulesForm({ offerMinutes, reminders, reminderMinutes }: { offerMinutes: number; reminders: boolean; reminderMinutes: number }) {
  const [state, action, pending] = useActionState(saveNotificationRules, initialWaitlistState);
  const id = useId();
  return <form action={action} aria-busy={pending} className="space-y-4"><div className="space-y-2"><Label htmlFor={`${id}-offer`}>Tiempo para aceptar el cupo (minutos)</Label><Input id={`${id}-offer`} name="offerMinutes" type="number" min={1} max={30} defaultValue={offerMinutes} required /></div>
    <div className="space-y-2"><Label htmlFor={`${id}-reminders`}>Recordatorios dentro de ACTIVANT</Label><select id={`${id}-reminders`} name="reminders" defaultValue={reminders ? "enabled" : "disabled"} className="min-h-12 w-full rounded-lg border bg-white px-3 text-sm"><option value="disabled">Desactivados</option><option value="enabled">Activados</option></select></div>
    <div className="space-y-2"><Label htmlFor={`${id}-minutes`}>Anticipación del recordatorio (minutos)</Label><Input id={`${id}-minutes`} name="reminderMinutes" type="number" min={5} max={1440} defaultValue={reminderMinutes} required /></div><p className="text-sm leading-relaxed text-muted-foreground">El nuevo plazo aplica a ofertas futuras. Los avisos se consultan aquí; no se envían por correo ni por mensajes al celular.</p><Button type="submit" disabled={pending}>Guardar notificaciones</Button><Feedback state={state} pending={pending} /></form>;
}
