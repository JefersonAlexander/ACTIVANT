import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatTime } from "@/modules/dashboard/dates";
import type { ReportFilters } from "../contracts";
export function filterQuery(filters: ReportFilters, extra: Record<string,string> = {}) { return new URLSearchParams({...filters,...extra}).toString(); }
export function DateSlotFilters({ filters, slots, action }: { filters: ReportFilters; slots: {id:string;starts_at:string;ends_at:string}[]; action: string }) {
  return <form action={action} className="mb-6 grid items-end gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_auto]" aria-label="Filtros de fecha y franja"><div className="space-y-2"><Label htmlFor="filter-start">Desde</Label><Input id="filter-start" name="desde" type="date" defaultValue={filters.desde} required /></div><div className="space-y-2"><Label htmlFor="filter-end">Hasta</Label><Input id="filter-end" name="hasta" type="date" defaultValue={filters.hasta} required /></div><div className="min-w-0 space-y-2"><Label htmlFor="filter-slot">Franja</Label><select id="filter-slot" name="franja" defaultValue={filters.franja} className="min-h-12 w-full min-w-0 rounded-lg border bg-white px-3 text-sm"><option value="">Todas las franjas</option>{slots.map(s=><option key={s.id} value={s.id}>{formatDate(s.starts_at)} · {formatTime(s.starts_at)} – {formatTime(s.ends_at)}</option>)}{filters.franja && !slots.some(s=>s.id===filters.franja) && <option value={filters.franja}>Franja seleccionada</option>}</select></div><Button type="submit">Aplicar filtros</Button><p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2 xl:col-span-4">Fechas inclusivas, en Colombia. Máximo 93 días; el selector muestra hasta 500 franjas del rango.</p></form>;
}
export function Pagination({ page, count, size, href, filters }: { page: number; count: number; size: number; href: string; filters?: Record<string,string> }) {
  return <nav aria-label="Páginas de resultados" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><span>Página {page} · {count} registros</span><div className="flex gap-2">{page > 1 && <Button asChild variant="outline"><Link href={`${href}?${new URLSearchParams({...filters,pagina:String(page-1)})}`}>Anterior</Link></Button>}{page*size < count && <Button asChild variant="outline"><Link href={`${href}?${new URLSearchParams({...filters,pagina:String(page+1)})}`}>Siguiente</Link></Button>}</div></nav>;
}
