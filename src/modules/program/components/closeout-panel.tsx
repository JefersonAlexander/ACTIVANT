import { CalendarDays } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Panel,QuietEmpty,ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { formatDate,formatTime } from "@/modules/dashboard/dates";
import { getCloseoutSlots } from "../services/queries";
import { ProgramForm } from "./program-forms";
export async function CloseoutPanel(){
 const slots=await getCloseoutSlots();
 return <Panel title="Conciliar cierre de franja" description="Revisa registros QR, ingresos manuales e incidencias antes de reportar ausencias.">{slots.error ? <ReadError message={slots.error}/> : slots.data?.length ? <ProgramForm operation="closeout" label="Conciliar y enviar a revisión"><div className="space-y-2"><Label htmlFor="closeout-slot">Franja finalizada</Label><select id="closeout-slot" name="slotId" required defaultValue="" className="min-h-12 w-full min-w-0 rounded-lg border bg-white px-3 text-sm"><option value="" disabled>Selecciona una franja</option>{slots.data.map(s=><option key={s.id} value={s.id}>{formatDate(s.starts_at)} · {formatTime(s.starts_at)} – {formatTime(s.ends_at)}{s.gym_slot_closeouts?" · conciliada":""}</option>)}</select></div><label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed"><input type="checkbox" name="evidence" value="yes" required className="mt-1 size-4 shrink-0 accent-primary"/>Concilié los registros e incidencias de acceso. No quedan ingresos pendientes de registrar.</label><p className="text-xs leading-relaxed text-muted-foreground">Se muestran hasta 30 franjas de los últimos siete días. El servidor exige el plazo de conciliación configurado. Un posible caso queda pendiente; este cierre no aplica sanciones.</p></ProgramForm> : <QuietEmpty icon={CalendarDays} title="Sin franjas finalizadas por conciliar" description="Los horarios recientes aparecerán cuando hayan terminado."/>}</Panel>;
}
