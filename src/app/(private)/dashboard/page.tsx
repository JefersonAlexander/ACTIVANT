import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCalendar, getMemberOverview } from "@/modules/dashboard/services/queries";
import { dayKey, formatDate } from "@/modules/dashboard/dates";
import { DestinationLink, ModuleNotice, PageHeading, Panel, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { EligibilityPanel, NextReservation, ReservationList } from "@/modules/dashboard/components/member-panels";
import { getPointSummary } from "@/modules/program/services/queries";
import { PointSummaryCard } from "@/modules/program/components/point-summary";
import { GymCalendar } from "@/modules/dashboard/components/gym-calendar";
export const metadata: Metadata = { title: "Mi bienestar" };
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ mes?: string; estado?: string }> }) {
  const params = await searchParams;
  const [overview, calendar, points] = await Promise.all([getMemberOverview(), getCalendar(params.mes), getPointSummary()]);
  const now = new Date();
  return <>
    {params.estado === "sin-permiso" && <div role="alert" className="mb-6 rounded-xl border bg-white p-4 text-sm">No tienes permisos para acceder a esa sección.</div>}
    <PageHeading eyebrow={`Hola, ${overview.viewer.user.email?.split("@")[0] ?? "te damos la bienvenida"}.`} title="Tu espacio de bienestar" description="Haz una pausa, muévete y encuentra un momento para ti." action={<Button asChild><Link href="/gimnasio"><Dumbbell aria-hidden="true" />Reservar gimnasio<ArrowRight aria-hidden="true" /></Link></Button>} />
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p className="capitalize">{formatDate(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p><p>Tu bienestar, paso a paso.</p></div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
      <div className="space-y-5"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><EligibilityPanel overview={overview} /><NextReservation result={overview.next} /></div>
        <Panel title="Tus últimas actividades" description="Hasta cinco reservas anteriores." action={<Link className="inline-flex min-h-11 items-center gap-2 rounded text-sm font-semibold text-primary" href="/historial">Ver historial<ArrowRight className="size-4" aria-hidden="true" /></Link>}>{overview.history.error ? <ReadError message={overview.history.error} /> : <ReservationList items={overview.history.data ?? []} />}</Panel>
      </div>
      <Panel title="Encuentra tu momento" description="Consulta el calendario del gimnasio.">{calendar.slots.error ? <ReadError message={calendar.slots.error} /> : <><GymCalendar key={calendar.range.month} range={calendar.range} slots={calendar.slots.data ?? []} today={dayKey(now)} basePath="/dashboard" />{(calendar.slots.count ?? 0) > (calendar.slots.data?.length ?? 0) && <p className="mt-3 text-xs text-muted-foreground">Se muestran las primeras 500 franjas del mes.</p>}</>}</Panel>
    </div>
    <div className="mt-6"><PointSummaryCard result={points} compact /></div>
    <section aria-labelledby="more-wellbeing" className="mt-8"><h2 id="more-wellbeing" className="mb-4 text-lg font-semibold">Más para tu bienestar</h2><div className="grid gap-4 sm:grid-cols-2"><DestinationLink href="/biblioteca" description="Rutinas, movilidad y actividades autorizadas para tu bienestar." /><DestinationLink href="/perfil" description="Consulta tu vinculación y la información de tu cuenta." /></div></section>
    <div className="mt-6"><ModuleNotice>Los puntos no habilitan canjes ni recompensas sin aprobación institucional.</ModuleNotice></div>
  </>;
}
