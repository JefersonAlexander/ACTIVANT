"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/modules/dashboard/dates";
import { ReservationControl } from "./reservation-control";
import { bookingReasons } from "../messages";
import type { CalendarSlot } from "../types";
import { WaitlistButton } from "@/modules/waitlist/components/waitlist-controls";
export function SlotAvailability({ slot }: { slot: CalendarSlot }) {
  const data = slot.availability;
  if (!data) return null;
  const reason = data.reason === "window_not_open"
    ? `Se habilita el ${formatDate(data.opensAt)} a las ${formatTime(data.opensAt)}.`
    : data.reason ? (Object.hasOwn(bookingReasons, data.reason) ? bookingReasons[data.reason] : "Esta franja no admite reservas.") : "Puedes reservar esta franja.";
  return <div className="w-full space-y-3 border-t pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{data.occupied} {data.occupied === 1 ? "ocupado" : "ocupados"} de {slot.capacity}</span><Badge variant="outline">{data.available} disponibles</Badge></div>
    {slot.capacity - data.occupied - data.available > 0 && <p className="text-xs text-muted-foreground">{slot.capacity - data.occupied - data.available} cupos retenidos por ofertas vigentes.</p>}
    <meter min={0} max={slot.capacity} value={data.occupied} aria-label={`Ocupación: ${data.occupied} de ${slot.capacity}`} className="gym-occupancy h-3 w-full accent-primary" />
    <p className="text-xs leading-relaxed text-muted-foreground">{reason}</p>
    {data.reservationId && <Badge>Tu reserva está confirmada</Badge>}
    {slot.waitlist ? <div className="space-y-2 text-sm"><p className="font-medium text-primary">En lista de espera · Posición {slot.waitlist.queue_position}</p><Link href="/notificaciones" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{slot.waitlist.offer_status === "pending" ? "Responder a mi oferta de cupo" : "Consultar mi solicitud"}</Link></div> : data.reason === "slot_full" && !data.reservationId && slot.waitlist !== undefined ? <WaitlistButton id={slot.id} operation="join">Unirse a la lista de espera</WaitlistButton> : null}
    <ReservationControl showTrigger={!slot.waitlist && !(data.reason === "slot_full" && !data.reservationId && slot.waitlist !== undefined)} slotId={slot.id} reservationId={data.reservationId} startsAt={slot.starts_at} endsAt={slot.ends_at} canBook={data.canBook} canCancel={new Date(slot.starts_at).getTime() > new Date(data.observedAt).getTime()} />
  </div>;
}
