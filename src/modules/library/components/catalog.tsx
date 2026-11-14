import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading, QuietEmpty, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { Pagination } from "@/modules/administration/components/filters";
import { getLibrary, getLibraryAccess } from "../services/queries";
import { libraryCategories } from "../contracts";
export async function LibraryCatalog({ category, search="", page=1 }: { category?: string; search?: string; page?: number }) {
  const [result,access]=await Promise.all([getLibrary({category,search,page}),getLibraryAccess()]);
  return <><PageHeading eyebrow="Bienestar que te acompaña" title="Biblioteca de bienestar" description="Encuentra rutinas, movilidad, clases y pausas para incorporar a tu día. Elige la actividad y el tiempo que tienes disponible."/>
    <form action="/biblioteca" aria-label="Filtros de biblioteca" className="mb-6 grid items-end gap-4 rounded-xl border bg-white p-4 sm:grid-cols-[1fr_1fr_auto]"><div className="space-y-2"><Label htmlFor="library-search">Buscar por título</Label><Input id="library-search" name="buscar" maxLength={100} defaultValue={search}/></div><div className="min-w-0 space-y-2"><Label htmlFor="library-category">Categoría</Label><select id="library-category" name="categoria" defaultValue={category??""} className="min-h-12 w-full min-w-0 rounded-lg border bg-white px-3 text-sm"><option value="">Todas las categorías</option>{Object.entries(libraryCategories).map(([code,label])=><option value={code} key={code}>{label}</option>)}</select></div><Button type="submit">Filtrar contenidos</Button></form>
    {result.error||access.error?<ReadError message={result.error??access.error!}/>:!access.data?<QuietEmpty icon={BookOpen} title="Tu vinculación necesita revisión" description="La biblioteca requiere una cuenta activa y una categoría de vinculación autorizada. Consulta al equipo de bienestar."/>:!result.data?.length?<QuietEmpty icon={BookOpen} title="No hay contenidos publicados para esta búsqueda" description="Prueba otra categoría o consulta más adelante. Aquí aparecerán únicamente recursos publicados y autorizados."/>:<>
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{result.data.map(c=><li key={c.id} className="overflow-hidden rounded-2xl border bg-white"><div className="relative aspect-[16/10] bg-secondary">{c.cover_asset_id&&<Image src={`/biblioteca/archivos/${c.cover_asset_id}`} alt="" fill unoptimized sizes="(min-width:1280px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover"/>}</div><div className="space-y-3 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline">{libraryCategories[c.category as keyof typeof libraryCategories]??c.category}</Badge><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true"/>{c.duration_minutes} min</span></div><h2 className="break-words text-lg leading-snug font-semibold"><Link href={`/biblioteca/${c.id}`} className="inline-block min-h-11 rounded-lg py-1 underline-offset-4 hover:underline">{c.title}</Link></h2><p className="line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">{c.description}</p><Button asChild variant="outline"><Link href={`/biblioteca/${c.id}`}>Ver actividad<span className="sr-only">: {c.title}</span></Link></Button></div></li>)}</ul><Pagination page={page} count={result.count??0} size={12} href="/biblioteca" filters={{buscar:search,categoria:category??""}}/>
    </>}
  </>;
}
