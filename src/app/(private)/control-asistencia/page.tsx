import Link from "next/link";
import { CloseoutPanel } from "@/modules/program/components/closeout-panel";
import { ClipboardCheck, CalendarDays, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAttendanceOverview } from "@/modules/dashboard/services/queries";
import { formatDate, formatTime } from "@/modules/dashboard/dates";
import { MetricCard, Panel, PageHeading, QuietEmpty, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { RefreshButton } from "@/modules/dashboard/components/refresh-button";
import { AttendanceHistory } from "@/modules/attendance/components/attendance-history";
import { ManualAttendance } from "@/modules/attendance/components/manual-attendance";
import { getAttendanceHistory, getCurrentReservations } from "@/modules/attendance/services/queries";
export const metadata={title:"Control de asistencia"};
export default async function StaffAttendancePage({searchParams}:{searchParams:Promise<{pagina?:string}>}) {
 const value=Number((await searchParams).pagina); const page=Number.isSafeInteger(value)&&value>0&&value<=10000 ? value : 1;
 const [overview,history,reservations]=await Promise.all([getAttendanceOverview(),getAttendanceHistory(page,true),getCurrentReservations()]);
 return <><PageHeading eyebrow="Equipo de gimnasio" title="Control de asistencia" description={`Ingresos del ${formatDate(new Date())}, en hora de Colombia.`} action={<RefreshButton/>}/>
 <div className="mb-6 grid items-stretch gap-5 md:grid-cols-2"><MetricCard label="Asistencias registradas" value={overview.count} error={overview.error} icon={ClipboardCheck} description="Registros realizados durante el día"/><Panel title="Punto de acceso" description="Muestra el código dinámico para que cada persona registre su ingreso."><Button asChild><Link href="/control-asistencia/qr"><QrCode aria-hidden="true"/>Mostrar QR del gimnasio</Link></Button></Panel></div>
 <div className="grid items-start gap-6 xl:grid-cols-2"><div className="space-y-6"><Panel title="Reservas de la franja en curso" description="Usa el código de la reserva para verificar un ingreso excepcional.">{reservations.error ? <ReadError message={reservations.error}/> : reservations.data?.length ? <ul className="divide-y">{reservations.data.map(r=><li key={r.id} className="space-y-2 py-4 first:pt-0"><p className="text-sm font-medium">{formatTime(r.gym_slots.starts_at)} – {formatTime(r.gym_slots.ends_at)} · {r.attendance?.attendance_invalidations ? "Ingreso invalidado" : r.attendance ? "Ingreso registrado" : "Ingreso pendiente"}</p><p className="break-all font-mono text-xs text-muted-foreground">{r.id}</p></li>)}</ul> : <QuietEmpty icon={CalendarDays} title="Sin reservas en curso" description="Aquí aparecerán las reservas confirmadas de la franja actual."/>}{!reservations.error && (reservations.count??0)>100 && <p className="mt-4 text-sm text-muted-foreground">Se muestran las primeras 100 reservas. Puedes ingresar el código completo en el registro manual.</p>}</Panel><AttendanceHistory data={history}/><CloseoutPanel/></div><Panel title="Ingreso manual excepcional" description="Exclusivo para personal autorizado. Cada operación queda auditada."><ManualAttendance/></Panel></div></>;
}
