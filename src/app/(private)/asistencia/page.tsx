import { PageHeading, ModuleNotice } from "@/modules/dashboard/components/dashboard-ui";
import { AttendanceScanner } from "@/modules/attendance/components/attendance-scanner";
import { AttendanceHistory } from "@/modules/attendance/components/attendance-history";
import { getAttendanceHistory } from "@/modules/attendance/services/queries";
export const metadata={title:"Registrar asistencia"};
export default async function AttendancePage({searchParams}:{searchParams:Promise<{pagina?:string}>}) {
 const params=await searchParams; const value=Number(params.pagina); const page=Number.isSafeInteger(value)&&value>0&&value<=10000 ? value : 1;
 const history=await getAttendanceHistory(page);
 return <><PageHeading eyebrow="Tu espacio" title="Registrar asistencia" description="Ya estás en el gimnasio. Escanea el código de la pantalla para confirmar tu ingreso."/><div className="grid items-start gap-6 xl:grid-cols-2"><div className="space-y-5"><AttendanceScanner/><ModuleNotice>Si no puedes usar la cámara, solicita al personal autorizado un ingreso manual con el código de tu reserva.</ModuleNotice></div><AttendanceHistory data={history}/></div></>;
}
