import { PageHeading,ModuleNotice } from "@/modules/dashboard/components/dashboard-ui";
import { RefreshButton } from "@/modules/dashboard/components/refresh-button";
import { getAbsenceCases,getPointHistory,getPointSummary } from "@/modules/program/services/queries";
import { PointSummaryCard } from "@/modules/program/components/point-summary";
import { AbsenceCases,PointHistory } from "@/modules/program/components/program-history";
export const metadata={title:"Puntos y constancia"};
function pageNumber(value?:string){const n=Number(value);return Number.isSafeInteger(n)&&n>0&&n<=10000?n:1;}
export default async function ConsistencyPage({searchParams}:{searchParams:Promise<{movimientos?:string;casos?:string}>}){
 const params=await searchParams;const [summary,history,cases]=await Promise.all([getPointSummary(),getPointHistory(pageNumber(params.movimientos)),getAbsenceCases(pageNumber(params.casos))]);
 return <><PageHeading eyebrow="Tu espacio" title="Puntos y constancia" description="Consulta tu progreso, los movimientos de tu saldo y las revisiones de asistencia." action={<RefreshButton/>}/><div className="grid items-start gap-6 xl:grid-cols-2"><div className="space-y-6"><PointSummaryCard result={summary}/><AbsenceCases data={cases}/></div><PointHistory data={history}/></div><div className="mt-6"><ModuleNotice>Los puntos registran tu constancia. Las recompensas y los canjes requieren aprobación institucional y permanecen deshabilitados.</ModuleNotice></div></>;
}
