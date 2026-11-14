import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeading, Panel, ReadError } from "@/modules/dashboard/components/dashboard-ui";
import { getContent } from "@/modules/library/services/queries";
import { libraryCategories } from "@/modules/library/contracts";
export const metadata = { title: "Actividad de bienestar" };
export default async function ContentPage({ params }: { params: Promise<{id:string}> }) {
  const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const result=await getContent(id);
  if(result.error)return <ReadError message={result.error}/>;if(!result.data)notFound();const c=result.data;
  return <><Button asChild variant="ghost" className="mb-4"><Link href="/biblioteca"><ArrowLeft aria-hidden="true"/>Volver a la biblioteca</Link></Button><PageHeading title={c.title} description={`${libraryCategories[c.category as keyof typeof libraryCategories]??c.category} · ${c.duration_minutes} minutos`}/>{c.status!=="published"&&<Badge variant="outline" className="mb-4">Vista previa administrativa · {c.status==="draft"?"Borrador":"Archivado"}</Badge>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"><Panel title="Tu actividad">{c.video_asset_id?<video src={`/biblioteca/archivos/${c.video_asset_id}`} controls preload="metadata" poster={c.cover_asset_id?`/biblioteca/archivos/${c.cover_asset_id}`:undefined} className="aspect-video w-full rounded-xl bg-foreground" aria-label={`Video: ${c.title}`}>Tu navegador no permite reproducir este video.</video>:<>{c.cover_asset_id&&<div className="relative mb-5 aspect-video overflow-hidden rounded-xl bg-secondary"><Image src={`/biblioteca/archivos/${c.cover_asset_id}`} alt="" fill unoptimized sizes="(min-width:1280px) 60vw, 100vw" className="object-cover"/></div>}{c.external_url?<><p className="mb-4 text-sm leading-relaxed text-muted-foreground">El recurso se abrirá en {new URL(c.external_url).hostname}. Su disponibilidad y permisos dependen del proveedor autorizado.</p><Button asChild><a href={c.external_url} target="_blank" rel="noopener noreferrer nofollow">Abrir recurso autorizado<ExternalLink aria-hidden="true"/></a></Button></>:<p className="text-sm text-muted-foreground">Este borrador todavía no tiene un recurso asignado.</p>}</>}</Panel><Panel title="Acerca de la actividad"><p className="break-words whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{c.description}</p></Panel></div></>;
}
