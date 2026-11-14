"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { manualReasons } from "../contracts";
import { registerManualAttendance } from "../actions";
export function ManualAttendance() {
 const [state,action,pending]=useActionState(registerManualAttendance,{status:"idle",message:""});
 return <form action={action} className="space-y-5">
 <p className="text-sm leading-relaxed text-muted-foreground">Verifica con la persona su reserva en ACTIVANT. El ingreso conserva las mismas validaciones de cuenta, habilitación y horario.</p>
 <div className="space-y-2"><Label htmlFor="manual-reservation">Código de reserva</Label><Input id="manual-reservation" name="reservationId" required maxLength={36} autoComplete="off" placeholder="UUID de la reserva"/><p className="text-xs text-muted-foreground">Disponible en Mis reservas y en la lista de la franja en curso.</p></div>
 <div className="space-y-2"><Label htmlFor="manual-reason">Motivo de excepción</Label><select id="manual-reason" name="reason" required defaultValue="" className="min-h-12 w-full min-w-0 rounded-lg border bg-white px-3 text-sm"><option value="" disabled>Selecciona un motivo</option>{Object.entries(manualReasons).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
 <p className="text-xs leading-relaxed text-muted-foreground">Quedarán registrados tu usuario, el motivo y la hora del servidor. No ingreses información médica.</p>
 <Button disabled={pending} type="submit">{pending ? "Registrando…" : "Confirmar ingreso manual"}</Button>
 {state.message && <p role={state.status==="error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${state.status==="error" ? "text-destructive" : "bg-secondary"}`}>{state.message}</p>}
 </form>;
}
