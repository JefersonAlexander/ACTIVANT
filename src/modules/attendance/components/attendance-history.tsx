import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, QuietEmpty, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { formatDate, formatTime } from "@/modules/dashboard/dates";
import type { AttendanceHistoryData } from "../services/queries";
export function AttendanceHistory({ data }: { data: AttendanceHistoryData }) {
 const { result, page, staff }=data;
 const href=staff ? "/control-asistencia" : "/asistencia";
 return <Panel title={staff ? "Asistencias de hoy" : "Historial de asistencias"} description={staff ? "Registros del día en hora de Colombia. Diez por página." : "Tus ingresos registrados al gimnasio. Diez por página."}>
 {result.error ? <ReadError message={result.error}/> : result.data?.length ? <ul className="divide-y">{result.data.map(item=><li key={item.reservation_id} className="space-y-2 py-4 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{formatDate(item.checked_in_at)} · {formatTime(item.checked_in_at)}</p><Badge variant="outline">{item.attendance_invalidations ? "Asistencia invalidada" : item.method==="qr" ? "Código QR" : "Ingreso manual"}</Badge></div><p className="text-sm text-muted-foreground">Franja: {formatTime(item.reservations.gym_slots.starts_at)} – {formatTime(item.reservations.gym_slots.ends_at)}</p><p className="break-all text-xs text-muted-foreground">Reserva: {item.reservation_id}</p></li>)}</ul> : <QuietEmpty icon={ClipboardCheck} title="Sin asistencias registradas" description={staff ? "Los ingresos confirmados aparecerán aquí." : "Después de registrar tu asistencia, podrás consultarla aquí."}/>}
 {!result.error && <nav aria-label="Páginas de asistencias" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><span>Página {page} · {result.count ?? 0} registros</span><div className="flex gap-2">{page>1 && <Button variant="outline" asChild><Link href={`${href}?pagina=${page-1}`}>Anterior</Link></Button>}{page*10<(result.count ?? 0) && <Button variant="outline" asChild><Link href={`${href}?pagina=${page+1}`}>Siguiente</Link></Button>}</div></nav>}
 </Panel>;
}
