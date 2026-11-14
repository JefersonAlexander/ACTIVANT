import { z } from "zod";
import { getMyReservations } from "@/modules/reservations/services/queries";
import { MyReservationsView } from "@/modules/reservations/components/my-reservations";
import { PageHeading } from "@/modules/dashboard/components/dashboard-ui";
export const metadata = { title: "Mis reservas" };
export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const input = z.coerce.number().int().min(1).max(100000).safeParse((await searchParams).pagina ?? 1);
  const data = await getMyReservations(input.success ? input.data : 1);
  return <><PageHeading title="Mis reservas" description="Consulta tus horarios activos, cancela una reserva y revisa tu historial." /><MyReservationsView data={data} /></>;
}
