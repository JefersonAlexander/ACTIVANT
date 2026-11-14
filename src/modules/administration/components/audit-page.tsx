import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel, QuietEmpty, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { dayKey, formatDate, formatTime } from "@/modules/dashboard/dates";
import { pageNumber, parseReportFilters, type SearchParams } from "../contracts";
import { getAudit, getFilterSlots } from "../services/queries";
import { DateSlotFilters, filterQuery, Pagination } from "./filters";
export async function AuditPage({ params }: { params: SearchParams }) {
  const parsed = parseReportFilters(params, dayKey(new Date()));
  if (!parsed.success) return <><PageHeading title="Auditoría" description="Trazabilidad de las operaciones administrativas." /><ReadError message="Selecciona un rango válido de hasta 93 días." /><Button asChild variant="outline" className="mt-4"><Link href="/admin/auditoria">Restablecer filtros</Link></Button></>;
  const filters = parsed.data, page = pageNumber(params.pagina);
  const [audit, slots] = await Promise.all([getAudit(filters, page), getFilterSlots(filters)]);
  return <><PageHeading eyebrow="Administración" title="Auditoría" description="Actor, operación y registro afectado. Las fechas filtran el momento de la operación, en Colombia." /><DateSlotFilters filters={filters} slots={slots.data ?? []} action="/admin/auditoria" />{slots.error && <ReadError message={slots.error} />}<Panel title="Operaciones registradas" description="Esta vista y su exportación omiten valores anteriores, valores nuevos, correos y motivos privados." action={<Button asChild variant="outline"><a href={`/admin/exportar?${filterQuery(filters, { tipo: "auditoria" })}`}>Exportar auditoría CSV</a></Button>}>
    {audit.error ? <ReadError message={audit.error} /> : !audit.data?.length ? <QuietEmpty icon={ShieldCheck} title="Sin operaciones en esta consulta" description="Ajusta las fechas o la franja para consultar otros registros." /> : <ul className="divide-y">{audit.data.map(row => <li key={row.id} className="space-y-2 py-4 text-sm"><p className="font-semibold">{row.entity_table} · {row.operation}</p><p className="text-muted-foreground">{formatDate(row.occurred_at)} · {formatTime(row.occurred_at)} · registro {row.id}</p><p className="break-all">Actor: {row.actor_id ?? `Proceso de base de datos (${row.database_actor})`}</p><p className="break-all text-xs text-muted-foreground">Referencia: {JSON.stringify(row.entity_key)}</p></li>)}</ul>}
    {!audit.error && <Pagination page={page} count={audit.count ?? 0} size={30} href="/admin/auditoria" filters={filters} />}
  </Panel></>;
}
