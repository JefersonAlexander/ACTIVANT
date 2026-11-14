import { notFound } from "next/navigation";
import { requirePermission } from "@/modules/auth/server";
import { ScheduleManagement } from "@/modules/reservations/components/schedule-management";
import { UsersPage } from "@/modules/administration/components/users-page";
import { ReportPage } from "@/modules/administration/components/report-page";
import { ReservationsPage } from "@/modules/administration/components/reservations-page";
import { AuditPage } from "@/modules/administration/components/audit-page";
import { ConfigurationPage } from "@/modules/administration/components/configuration-page";
import { ContentManagement } from "@/modules/library/components/management";
import { pageNumber, type SearchParams } from "@/modules/administration/contracts";
export const metadata = { title: "Gestión institucional" };
export default async function AdminSection({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<SearchParams> }) {
  await requirePermission("admin");
  const { section } = await params; const query = await searchParams;
  if (section === "horarios") return <ScheduleManagement month={typeof query.mes === "string" ? query.mes : undefined} />;
  if (section === "usuarios") return <UsersPage search={typeof query.buscar === "string" ? query.buscar.slice(0,120) : ""} page={pageNumber(query.pagina)} />;
  if (section === "reservas") return <ReservationsPage params={query} />;
  if (section === "reportes") return <ReportPage params={query} />;
  if (section === "auditoria") return <AuditPage params={query} />;
  if (section === "configuracion") return <ConfigurationPage />;
  if (section === "contenidos") return <ContentManagement page={pageNumber(query.pagina)} />;
  notFound();
}
