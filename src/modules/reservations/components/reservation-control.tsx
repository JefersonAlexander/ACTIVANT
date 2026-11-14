"use client";
import { useActionState, useEffect, useId, useRef } from "react";
import { CalendarCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/modules/dashboard/dates";
import { mutateReservation } from "../actions";
import { initialReservationState } from "../messages";

type Props = { slotId?: string; reservationId: string | null; startsAt: string; endsAt: string; canBook?: boolean; canCancel: boolean; showTrigger?: boolean };
export function ReservationControl({ slotId, reservationId, startsAt, endsAt, canBook = false, canCancel, showTrigger = true }: Props) {
  const [state, action, pending] = useActionState(mutateReservation, initialReservationState);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reserved = !!reservationId;
  const allowed = reserved ? canCancel : canBook;
  useEffect(() => { if (state.status === "success") dialog.current?.close(); }, [state]);
  return <div className="w-full space-y-3">
    {showTrigger && <Button variant={reserved ? "outline" : "default"} className="w-full sm:w-auto" disabled={!allowed || pending} onClick={() => dialog.current?.showModal()}>
      {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <CalendarCheck aria-hidden="true" />}{reserved ? "Cancelar reserva" : "Reservar"}
    </Button>}
    {!pending && state.message && <p role={state.status === "error" ? "alert" : "status"} className={`text-sm leading-relaxed ${state.status === "error" ? "text-destructive" : "text-primary"}`}>{state.message}</p>}
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onClick={(event) => { if (event.target === event.currentTarget && !pending) dialog.current?.close(); }} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border bg-white p-0 text-foreground shadow-xl backdrop:bg-foreground/40">
      <div className="p-6"><h2 id={titleId} className="text-xl font-semibold">{reserved ? "¿Cancelar esta reserva?" : "Confirma tu reserva"}</h2>
        <p className="mt-4 text-sm font-medium first-letter:uppercase">{formatDate(startsAt, { weekday: "long", day: "numeric", month: "long" })}</p><p className="mt-1 text-sm text-muted-foreground">Gimnasio · {formatTime(startsAt)} – {formatTime(endsAt)} · hora de Colombia</p>
        <p id={descriptionId} className="my-5 text-sm leading-relaxed text-muted-foreground">{reserved ? "El cupo se liberará inmediatamente para que otra persona pueda reservarlo." : "Al confirmar verificaremos la habilitación, las restricciones y el cupo disponible en ese momento."}</p>
        {pending && <p role="status" className="mb-4 text-sm">Procesando tu solicitud…</p>}
        {state.status === "error" && !pending && <p role="alert" className="mb-4 text-sm text-destructive">{state.message}</p>}
        {!allowed && state.status !== "error" && !pending && <p role="status" className="mb-4 text-sm text-muted-foreground">La disponibilidad cambió. Vuelve al calendario para consultar el estado actual.</p>}
        <form action={action} aria-busy={pending} className="flex flex-wrap gap-3">
          <input type="hidden" name="operation" value={reserved ? "cancel" : "reserve"} /><input type="hidden" name="id" value={reservationId ?? slotId ?? ""} />
          <Button type="submit" disabled={pending || !allowed}>{pending ? "Procesando…" : reserved ? "Confirmar cancelación" : "Confirmar reserva"}</Button>
          <Button variant="outline" disabled={pending} onClick={() => dialog.current?.close()}>Volver</Button>
        </form>
      </div>
    </dialog>
  </div>;
}
