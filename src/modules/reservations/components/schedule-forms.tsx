"use client";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBookingRules, saveGymSlot } from "../actions";
import { initialReservationState } from "../messages";
import { utcToLocalDateTime } from "../schemas";
import type { CalendarSlot } from "../types";
const selectClass = "min-h-12 w-full rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
function Feedback({ state }: { state: { status: string; message: string } }) {
  return state.message && <p role={state.status === "error" ? "alert" : "status"} className={`text-sm leading-relaxed ${state.status === "error" ? "text-destructive" : "text-primary"}`}>{state.message}</p>;
}
export function BookingRulesForm({ windowHours, defaultCapacity, enabled }: { windowHours: number; defaultCapacity: number; enabled: boolean }) {
  const [state, action, pending] = useActionState(saveBookingRules, initialReservationState);
  const id = useId();
  return <form action={action} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor={`${id}-window`}>Anticipación de apertura (horas)</Label><Input id={`${id}-window`} name="windowHours" type="number" required min={1} max={168} step={1} defaultValue={windowHours} /></div><div className="space-y-2"><Label htmlFor={`${id}-capacity`}>Capacidad predeterminada</Label><Input id={`${id}-capacity`} name="defaultCapacity" type="number" required min={1} max={2147483647} step={1} defaultValue={defaultCapacity} /></div></div>
    <div className="space-y-2"><Label htmlFor={`${id}-enabled`}>Estado de reservas</Label><select id={`${id}-enabled`} name="enabled" className={selectClass} defaultValue={enabled ? "enabled" : "paused"}><option value="enabled">Habilitadas</option><option value="paused">Pausadas</option></select></div>
    <p className="text-xs leading-relaxed text-muted-foreground">La capacidad predeterminada aplica solo a nuevas franjas. Las reservas existentes conservan su cupo al pausar la creación de reservas.</p>
    <Feedback state={state} /><Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar condiciones"}</Button>
  </form>;
}
export function GymSlotForm({ slot, defaultCapacity }: { slot?: CalendarSlot; defaultCapacity: number }) {
  const [state, action, pending] = useActionState(saveGymSlot, initialReservationState);
  const id = useId();
  return <form action={action} className="space-y-5">
    {slot && <input type="hidden" name="id" value={slot.id} />}
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor={`${id}-start`}>Inicio</Label><Input id={`${id}-start`} name="startsAt" type="datetime-local" required defaultValue={slot ? utcToLocalDateTime(slot.starts_at) : undefined} /></div><div className="space-y-2"><Label htmlFor={`${id}-end`}>Finalización</Label><Input id={`${id}-end`} name="endsAt" type="datetime-local" required defaultValue={slot ? utcToLocalDateTime(slot.ends_at) : undefined} /></div></div>
    <div className="space-y-2"><Label htmlFor={`${id}-capacity`}>Capacidad de la franja</Label><Input id={`${id}-capacity`} name="capacity" type="number" required min={1} max={2147483647} step={1} defaultValue={slot?.capacity ?? defaultCapacity} /></div>
    {slot && <div className="space-y-2"><Label htmlFor={`${id}-status`}>Estado de la franja</Label><select id={`${id}-status`} name="status" className={selectClass} defaultValue={slot.status}><option value="open">Abierta</option><option value="closed">Cerrada</option><option value="cancelled">Cancelada</option></select></div>}
    <p className="text-xs leading-relaxed text-muted-foreground">Fechas en hora de Colombia. No se permiten cruces de horarios, reducir la capacidad por debajo de la ocupación o cambiar las horas con historial de reservas.</p>
    <Feedback state={state} /><Button type="submit" disabled={pending}>{pending ? "Guardando…" : slot ? "Guardar franja" : "Publicar franja"}</Button>
  </form>;
}
