"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { dayKey, formatDate, formatTime } from "../dates";
import { SlotAvailability, type CalendarSlot } from "@/modules/reservations";
import type { CalendarData } from "../services/queries";

type Props = { range: CalendarData["range"]; slots: CalendarSlot[]; today: string; basePath?: string };
export function GymCalendar({ range, slots, today, basePath = "/gimnasio" }: Props) {
  const [selected, setSelected] = useState(today.startsWith(range.month) ? today : `${range.month}-01`);
  const first = new Date(range.start);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const selectedSlots = slots.filter((slot) => dayKey(slot.starts_at) === selected);
  const dates = new Set(slots.map((slot) => dayKey(slot.starts_at)));
  return <div>
    <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold first-letter:uppercase">{formatDate(range.start, { month: "long", year: "numeric" })}</h3><div className="flex gap-1"><Button asChild variant="ghost" size="icon"><Link href={`${basePath}?mes=${range.previous}`} aria-label="Mes anterior" scroll={false}><ChevronLeft aria-hidden="true" /></Link></Button><Button asChild variant="ghost" size="icon"><Link href={`${basePath}?mes=${range.next}`} aria-label="Mes siguiente" scroll={false}><ChevronRight aria-hidden="true" /></Link></Button></div></div>
    <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label="Selecciona un día del calendario">
      {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((day) => <span key={day} aria-hidden="true" className="pb-2 text-xs font-medium text-muted-foreground">{day}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`} aria-hidden="true" />)}
      {Array.from({ length: days }, (_, i) => {
        const key = `${range.month}-${String(i + 1).padStart(2, "0")}`;
        const hasSlots = dates.has(key);
        return <button key={key} type="button" onClick={() => setSelected(key)} aria-pressed={selected === key} aria-current={key === today ? "date" : undefined} aria-label={`${formatDate(`${key}T12:00:00-05:00`, { weekday: "long", day: "numeric", month: "long" })}${hasSlots ? ", con franjas publicadas" : ", sin franjas"}`} className={cn("relative flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg pb-1 text-sm tabular-nums transition-colors hover:bg-secondary", selected === key && "bg-primary text-white hover:bg-primary", selected !== key && key === today && "bg-secondary font-bold text-primary")}>
          {i + 1}{hasSlots && <span aria-hidden="true" className={cn("absolute bottom-1 size-1 rounded-full", selected === key ? "bg-white" : "bg-primary")} />}
        </button>;
      })}
    </div>
    <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />Días con franjas publicadas · hora de Colombia</p>
    <div className="mt-5 border-t pt-5" aria-live="polite" aria-atomic="true">
      <h3 className="mb-3 text-sm font-semibold first-letter:uppercase">{formatDate(`${selected}T12:00:00-05:00`, { weekday: "long", day: "numeric", month: "long" })}</h3>
      {selectedSlots.length === 0 ? <p className="text-sm leading-relaxed text-muted-foreground">No hay franjas publicadas para este día.</p> : <ul className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">{selectedSlots.map((slot) => <li key={slot.id} data-slot-id={slot.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-3"><div><p className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4 text-primary" aria-hidden="true" />{formatTime(slot.starts_at)} – {formatTime(slot.ends_at)}</p><p className="mt-1 text-xs text-muted-foreground">Capacidad total: {slot.capacity} {slot.capacity === 1 ? "persona" : "personas"}</p></div><Badge variant="outline">{slot.status === "open" ? "Abierta" : slot.status === "closed" ? "Cerrada" : "Cancelada"}</Badge><SlotAvailability slot={slot} /></li>)}</ul>}
    </div>
  </div>;
}
