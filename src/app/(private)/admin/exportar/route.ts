import { requirePermission, requireUser } from "@/modules/auth/server";
import { dayKey } from "@/modules/dashboard/dates";
import { parseReportFilters } from "@/modules/administration/contracts";
import { getAudit, getGymReport } from "@/modules/administration/services/queries";
import { createCsv } from "@/modules/administration/csv";
export async function GET(request: Request) {
  await requirePermission("admin");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = parseReportFilters(params, dayKey(new Date()));
  const kind = params.tipo;
  const fail = (message: string, status: number) => new Response(message, { status, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
  if (!parsed.success || !["franjas", "participacion", "auditoria"].includes(kind ?? "")) return fail("Revisa el tipo y los filtros de exportación (máximo 93 días).", 400);
  const filters = parsed.data;
  let headers: string[], rows: (string | number | null)[][];
  if (kind === "auditoria") {
    const result = await getAudit(filters, 1, true);
    if (result.error) return fail(result.error, 503);
    if ((result.count ?? 0) > 5000) return fail("La exportación supera 5.000 operaciones. Reduce el rango o selecciona una franja.", 413);
    headers = ["id", "fecha_servidor", "actor_uuid", "proceso", "operacion", "tabla", "referencia"];
    rows = (result.data ?? []).map(r => [r.id, r.occurred_at, r.actor_id, r.database_actor, r.operation, r.entity_table, JSON.stringify(r.entity_key)]);
  } else {
    const result = await getGymReport(filters);
    if (result.error || !result.data) return fail(result.error ?? "Consulta no disponible.", 503);
    if (kind === "franjas") {
      if (result.data.total_slots > 2000) return fail("La exportación supera 2.000 franjas. Reduce el rango.", 413);
      headers = ["franja_uuid", "inicio", "fin", "estado", "capacidad", "reservas_confirmadas", "ofertas_pendientes", "ocupacion_porcentaje", "asistencias_efectivas", "aprovechamiento_porcentaje", "inasistencias_confirmadas", "casos_por_revisar", "cancelaciones", "demanda"];
      rows = result.data.slots.map(r => [r.id, r.starts_at, r.ends_at, r.status, r.capacity, r.confirmed, r.held, r.occupancy_percent, r.effective_attendances, r.utilization_percent, r.absences, r.pending_reviews, r.cancelled, r.demand]);
    } else {
      headers = ["fecha_colombia", "asistencias_efectivas", "participantes", "cancelaciones"];
      rows = result.data.daily.map(r => [r.report_day, r.attendances, r.participants, r.cancellations]);
    }
  }
  const { client } = await requireUser();
  const audit = await client.rpc("admin_record_export", { p_kind: kind!, p_start: filters.desde, p_end: filters.hasta, p_slot_id: filters.franja || undefined });
  if (audit.error) return fail("No pudimos auditar la exportación. Inténtalo de nuevo.", 503);
  return new Response(createCsv(headers, rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="activant-${kind}-${filters.desde}-${filters.hasta}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
